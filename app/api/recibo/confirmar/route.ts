import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Confirmação pública do recibo ("RECEBIDO"): o fornecedor não tem login.
// Esta rota existe só para capturar IP e aparelho no servidor (o navegador
// não consegue informar o próprio IP de forma confiável) e chamar a RPC
// SECURITY DEFINER, que valida o token, o documento e grava a evidência.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Limite simples por IP (por instância): protege de tentativas em massa.
const tentativas = new Map<string, { n: number; inicio: number }>()
const JANELA_MS = 10 * 60 * 1000
const MAX_TENTATIVAS = 15

function excedeu(ip: string): boolean {
  const agora = Date.now()
  const t = tentativas.get(ip)
  if (!t || agora - t.inicio > JANELA_MS) {
    tentativas.set(ip, { n: 1, inicio: agora })
    return false
  }
  t.n += 1
  return t.n > MAX_TENTATIVAS
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'desconhecido'
  if (excedeu(ip)) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 })
  }

  let body: { token?: unknown; nome?: unknown; documento?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 })
  }
  const { token, nome, documento } = body
  if (typeof token !== 'string' || !UUID.test(token) || typeof nome !== 'string' || typeof documento !== 'string') {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { data, error } = await supabase.rpc('intro_recibo_confirmar', {
    p_token: token,
    p_nome: nome.slice(0, 120),
    p_documento: documento.slice(0, 30),
    p_ip: ip,
    p_ua: req.headers.get('user-agent') ?? '',
  })
  if (error) {
    // Mensagens de RAISE EXCEPTION do banco são seguras e em português.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data)
}
