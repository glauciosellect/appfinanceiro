import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AMBIENTE = process.env.FOCUSNFE_AMBIENTE ?? 'homologacao'
const TOKEN = AMBIENTE === 'producao'
  ? (process.env.FOCUSNFE_TOKEN_PRODUCAO ?? '')
  : (process.env.FOCUSNFE_TOKEN_HOMOLOGACAO ?? '')
const BASE_URL = AMBIENTE === 'producao'
  ? 'https://api.focusnfe.com.br/v2'
  : 'https://homologacao.focusnfe.com.br/v2'

function authHeader() {
  const encoded = Buffer.from(`${TOKEN}:`).toString('base64')
  return { Authorization: `Basic ${encoded}` }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { chave } = await req.json() as { chave: string }
  const chaveLimpa = chave.replace(/\D/g, '')

  if (chaveLimpa.length !== 44) {
    return NextResponse.json({ error: 'Chave de acesso inválida. Deve ter 44 dígitos.' }, { status: 400 })
  }

  if (!TOKEN) {
    return NextResponse.json({ error: 'Token Focus NFe não configurado.' }, { status: 500 })
  }

  // Busca o CNPJ do perfil da empresa no Supabase
  const { data: perfil } = await supabase
    .from('perfil_empresa')
    .select('cnpj_cpf, razao_social, uf, regime_tributario')
    .eq('user_id', user.id)
    .single()

  const cnpjLimpo = (perfil?.cnpj_cpf ?? '').replace(/\D/g, '')

  // Se tiver CNPJ, garante que a empresa está registrada na Focus NFe com NF-e habilitado
  if (cnpjLimpo.length === 14) {
    await fetch(`${BASE_URL}/empresas/${cnpjLimpo}`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: perfil?.razao_social ?? '',
        cnpj: cnpjLimpo,
        inscricao_estadual: '',
        inscricao_municipal: '',
        regime_tributario: '1',
        cep: '', logradouro: '', numero: '', complemento: '',
        bairro: '', municipio: '', uf: perfil?.uf ?? '',
        telefone: '', email: '',
        habilita_nfe: true,
        habilita_nfse: true,
        habilita_nfce: false,
      }),
    }).catch(() => {/* ignora erro de cadastro */})
  }

  // Passo 1: Registrar ciência da operação (manifestação do destinatário)
  await fetch(`${BASE_URL}/nfe_destinatario?ref=${chaveLimpa}`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifestacao: 'ciencia_da_operacao' }),
  }).catch(() => {/* pode já ter sido manifestado */})

  // Passo 2: Polling — aguarda a Focus NFe baixar o XML da SEFAZ (até ~25s)
  interface StatusResp { status?: string; caminho_xml_nota_fiscal?: string; erros?: Array<{ mensagem: string }> }
  let statusResp: StatusResp = {}
  for (let i = 0; i < 8; i++) {
    await sleep(i === 0 ? 2000 : 3000)
    const r = await fetch(`${BASE_URL}/nfe_destinatario/${chaveLimpa}`, {
      headers: authHeader(),
    })
    if (r.ok) {
      statusResp = await r.json() as StatusResp
      const s = statusResp.status ?? ''
      if (s === 'baixado' || s === 'autorizado' || statusResp.caminho_xml_nota_fiscal) break
      if (s === 'erro' || s === 'cancelado') break
    }
  }

  // Passo 3: Download do XML
  const xmlRes = await fetch(`${BASE_URL}/nfe_destinatario/${chaveLimpa}/xml`, {
    headers: authHeader(),
  })

  if (xmlRes.ok) {
    const ct = xmlRes.headers.get('content-type') ?? ''
    const xml = ct.includes('json')
      ? (() => { return ''; })() // json inesperado — ignora
      : await xmlRes.text()
    if (xml && (xml.includes('<nfeProc') || xml.includes('<NFe'))) {
      return NextResponse.json({ ok: true, xml })
    }
  }

  // Diagnóstico
  const errFocus = statusResp.erros?.[0]?.mensagem
  const statusAtual = statusResp.status ?? 'não disponível'
  const ambienteMsg = AMBIENTE === 'homologacao'
    ? ' Atenção: ambiente de homologação não acessa NF-e reais.'
    : ''

  return NextResponse.json({
    error: errFocus
      ? `Focus NFe: ${errFocus}`
      : `Não foi possível baixar o XML (status Focus NFe: ${statusAtual}).${ambienteMsg}`,
    dica: cnpjLimpo.length !== 14
      ? 'Cadastre o CNPJ da sua empresa em Configurações antes de usar este recurso.'
      : 'Verifique se o token Focus NFe está em modo produção (FOCUSNFE_AMBIENTE=producao).',
  }, { status: 422 })
}
