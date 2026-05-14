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

  // Passo 1: Ciência da operação (manifestação do destinatário)
  await fetch(`${BASE_URL}/nfe_destinatario?ref=${chaveLimpa}`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ manifestacao: 'ciencia_da_operacao' }),
  }).catch(() => { /* ignora erro de manifestação, tenta download mesmo assim */ })

  // Passo 2: Download do XML da NF-e (retorna XML bruto ao cliente para parse)
  const xmlRes = await fetch(`${BASE_URL}/nfe_destinatario/${chaveLimpa}/xml`, {
    headers: authHeader(),
  })

  if (!xmlRes.ok) {
    let mensagem = `Erro ${xmlRes.status} ao consultar a SEFAZ.`
    try {
      const body = await xmlRes.json() as { erros?: Array<{ mensagem: string }> }
      if (body?.erros?.[0]?.mensagem) mensagem = body.erros[0].mensagem
    } catch { /* ignora */ }

    return NextResponse.json({
      error: mensagem,
      dica: 'Use o Upload do XML para importar esta nota.',
    }, { status: 422 })
  }

  const xml = await xmlRes.text()
  return NextResponse.json({ ok: true, xml })
}
