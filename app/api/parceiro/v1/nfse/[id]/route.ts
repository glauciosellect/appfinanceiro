import { NextRequest, NextResponse } from 'next/server'
import { autenticarParceiro, getSupabaseAdmin } from '@/lib/parceiro/auth'

// Consulta uma nota específica emitida por este parceiro — sempre filtrado
// por parceiro_empresa_id, nunca só por id, para que um parceiro nunca
// consiga ler a nota de outro (mesmo isolamento de qualquer tabela
// multi-tenant do resto do app).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const empresa = await autenticarParceiro(req)
  if (!empresa) return NextResponse.json({ error: 'Chave de API inválida.' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('nfse')
    .select('*')
    .eq('id', id)
    .eq('parceiro_empresa_id', empresa.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 })
  return NextResponse.json({ nota: data })
}
