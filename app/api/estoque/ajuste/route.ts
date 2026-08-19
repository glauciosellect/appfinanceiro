import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { produto_id, tipo, quantidade, motivo } = body as {
    produto_id?: string
    tipo?: 'entrada' | 'saida'
    quantidade?: number
    motivo?: string
  }

  if (!produto_id || (tipo !== 'entrada' && tipo !== 'saida')) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }
  if (!quantidade || typeof quantidade !== 'number' || quantidade <= 0) {
    return NextResponse.json({ error: 'Quantidade deve ser maior que zero' }, { status: 400 })
  }
  if (!motivo || !motivo.trim()) {
    return NextResponse.json({ error: 'Motivo é obrigatório' }, { status: 400 })
  }

  const { data: produto, error: produtoError } = await supabase
    .from('produtos_fiscais')
    .select('id, estoque, descricao, codigo')
    .eq('id', produto_id)
    .eq('user_id', user.id)
    .single()

  if (produtoError || !produto) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const estoqueAtual = produto.estoque ?? 0
  const novoEstoque = tipo === 'entrada' ? estoqueAtual + quantidade : estoqueAtual - quantidade

  if (tipo === 'saida' && novoEstoque < 0) {
    return NextResponse.json({ error: 'Estoque insuficiente para esta saída' }, { status: 400 })
  }

  const hoje = new Date().toISOString().slice(0, 10)

  const { error: insertError } = await supabase.from('movimentos_estoque').insert({
    user_id: user.id,
    produto_id: produto.id,
    produto_codigo: produto.codigo,
    produto_nome: produto.descricao,
    tipo,
    quantidade,
    motivo: motivo.trim(),
    nf_referencia: null,
    data: hoje,
  })

  if (insertError) {
    return NextResponse.json({ error: 'Erro ao registrar movimentação' }, { status: 500 })
  }

  const { error: updateError } = await supabase
    .from('produtos_fiscais')
    .update({ estoque: novoEstoque })
    .eq('id', produto.id)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Movimentação registrada, mas houve erro ao atualizar o estoque. Verifique a posição de estoque.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, novoEstoque })
}
