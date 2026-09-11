import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Diferente da Focus NFe, a Contora não mantém um "próximo número" do lado
// dela pra sincronizar — o number/series vai explícito em cada draft (ver
// emitirNFe em lib/fiscal/contora.ts). Então isso é só configuração local:
// o próximo número emitido usa o que estiver salvo aqui.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { numero_proximo_nfe, serie_nfe } = await req.json() as {
    numero_proximo_nfe?: number
    serie_nfe?: string
  }

  if (!numero_proximo_nfe || numero_proximo_nfe < 1) {
    return NextResponse.json({ error: 'Número inválido' }, { status: 400 })
  }

  const { error } = await supabase.from('fiscal_config').update({
    numero_proximo_nfe,
    serie_nfe: serie_nfe ?? '1',
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
