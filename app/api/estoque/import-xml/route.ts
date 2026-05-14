import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ItemImport {
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  margem: number        // % de margem de lucro definida na importação
  precoVenda: number    // valorUnitario * (1 + margem/100)
}

interface ImportPayload {
  numero: string
  serie: string
  dataEmissao: string
  fornecedorNome: string
  fornecedorCnpj: string
  naturezaOperacao: string
  valorTotal: number
  itens: ItemImport[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body: ImportPayload = await req.json()
  const nfRef = `NF-e ${body.serie}/${body.numero} — ${body.fornecedorNome}`
  const erros: string[] = []

  for (const item of body.itens) {
    const { data: existente } = await supabase
      .from('produtos_fiscais')
      .select('id, estoque')
      .eq('user_id', user.id)
      .eq('codigo', item.codigo)
      .single()

    let produtoId: string

    if (existente) {
      // Produto já existe: incrementa estoque e atualiza preços
      const { error } = await supabase
        .from('produtos_fiscais')
        .update({
          estoque: (existente.estoque as number) + item.quantidade,
          preco_unitario: item.valorUnitario,
          margem_lucro: item.margem,
          preco_venda: item.precoVenda,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id)

      if (error) { erros.push(`Erro ao atualizar ${item.codigo}: ${error.message}`); continue }
      produtoId = existente.id as string
    } else {
      // Produto novo: cria com todos os dados de preço
      const { data: novo, error } = await supabase
        .from('produtos_fiscais')
        .insert({
          user_id: user.id,
          codigo: item.codigo,
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          preco_unitario: item.valorUnitario,
          margem_lucro: item.margem,
          preco_venda: item.precoVenda,
          estoque: item.quantidade,
          estoque_minimo: 0,
          ativo: true,
        })
        .select('id')
        .single()

      if (error || !novo) { erros.push(`Erro ao criar ${item.codigo}: ${error?.message}`); continue }
      produtoId = novo.id as string
    }

    await supabase.from('movimentos_estoque').insert({
      user_id: user.id,
      produto_id: produtoId,
      produto_codigo: item.codigo,
      produto_nome: item.descricao,
      tipo: 'entrada',
      quantidade: item.quantidade,
      motivo: `Compra — ${body.naturezaOperacao}`,
      nf_referencia: nfRef,
      data: body.dataEmissao ? new Date(body.dataEmissao).toISOString() : new Date().toISOString(),
    })
  }

  if (erros.length > 0) return NextResponse.json({ ok: false, erros }, { status: 207 })
  return NextResponse.json({ ok: true })
}
