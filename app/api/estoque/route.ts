import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const [{ data: produtos }, { data: movimentos }] = await Promise.all([
    supabase
      .from('produtos_fiscais')
      .select('*')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('descricao'),
    supabase
      .from('movimentos_estoque')
      .select('*')
      .eq('user_id', user.id)
      .order('data', { ascending: false })
      .limit(50),
  ])

  return NextResponse.json({ produtos: produtos ?? [], movimentos: movimentos ?? [] })
}
