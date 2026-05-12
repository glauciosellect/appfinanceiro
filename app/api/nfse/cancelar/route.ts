import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelarNFSe } from '@/lib/fiscal/focusnfe'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { ref, id } = await req.json() as { ref: string; id: string }
  if (!ref || !id) return NextResponse.json({ error: 'ref e id são obrigatórios' }, { status: 400 })

  const retorno = await cancelarNFSe(ref)

  await supabase
    .from('nfse')
    .update({ status: 'cancelada', retorno_focusnfe: retorno, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, retorno })
}
