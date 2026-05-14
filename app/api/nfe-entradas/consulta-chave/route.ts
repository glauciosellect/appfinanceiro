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
    return NextResponse.json({ error: 'Token Focus NFe não configurado nas variáveis de ambiente.' }, { status: 500 })
  }

  // Passo 1: Registrar ciência da operação (manifestação do destinatário)
  await fetch(`${BASE_URL}/nfe_destinatario?ref=${chaveLimpa}`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifestacao: 'ciencia_da_operacao' }),
  }).catch(() => {/* ignora — pode já ter sido feito antes */})

  // Passo 2: Polling — aguarda a Focus NFe baixar o XML da SEFAZ (até 20s)
  interface StatusResp { status?: string; caminho_xml_nota_fiscal?: string }
  let statusResp: StatusResp = {}
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    await sleep(tentativa === 0 ? 1500 : 2500)
    const r = await fetch(`${BASE_URL}/nfe_destinatario/${chaveLimpa}`, {
      headers: authHeader(),
    })
    if (r.ok) {
      statusResp = await r.json() as StatusResp
      if (statusResp.status === 'baixado' || statusResp.caminho_xml_nota_fiscal) break
    }
  }

  // Passo 3: Download do XML
  const xmlRes = await fetch(`${BASE_URL}/nfe_destinatario/${chaveLimpa}/xml`, {
    headers: authHeader(),
  })

  if (xmlRes.ok) {
    const contentType = xmlRes.headers.get('content-type') ?? ''
    let xml: string
    if (contentType.includes('json')) {
      // Alguns endpoints retornam o XML dentro de um campo JSON
      const body = await xmlRes.json() as { xml?: string; nfe_xml?: string }
      xml = body.xml ?? body.nfe_xml ?? ''
    } else {
      xml = await xmlRes.text()
    }
    if (xml && xml.includes('<nfeProc') || xml.includes('<NFe')) {
      return NextResponse.json({ ok: true, xml })
    }
  }

  // Fallback: tenta o endpoint alternativo /nfe/{chave}/xml
  const fallbackRes = await fetch(`${BASE_URL}/nfe/${chaveLimpa}/xml`, {
    headers: authHeader(),
  })
  if (fallbackRes.ok) {
    const xml = await fallbackRes.text()
    if (xml.includes('<nfeProc') || xml.includes('<NFe')) {
      return NextResponse.json({ ok: true, xml })
    }
  }

  // Verifica se o ambiente está em homologação (não acessa NF-e reais)
  const ambienteMsg = AMBIENTE === 'homologacao'
    ? ' (atenção: ambiente de homologação não acessa NF-e reais da SEFAZ — configure FOCUSNFE_AMBIENTE=producao)'
    : ''

  return NextResponse.json({
    error: `Não foi possível baixar o XML desta NF-e via Focus NFe.${ambienteMsg}`,
    status: statusResp.status ?? 'não disponível',
    dica: 'Verifique se o CNPJ destinatário está cadastrado na Focus NFe em produção.',
  }, { status: 422 })
}
