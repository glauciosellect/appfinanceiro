import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { numero_proximo_nfse, serie_nfse } = await req.json() as {
    numero_proximo_nfse?: number
    serie_nfse?: string
  }

  if (!numero_proximo_nfse || numero_proximo_nfse < 1) {
    return NextResponse.json({ error: 'Número inválido' }, { status: 400 })
  }

  const { error } = await supabase.from('fiscal_config').update({
    numero_proximo_nfse,
    serie_nfse: serie_nfse ?? 'RPS',
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
