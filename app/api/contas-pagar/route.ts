import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function gerarParcelas(
  userId: string, contaId: string, valorTotal: number,
  numParcelas: number, jurosPercentual: number, dataPrimeira: string
) {
  const fator = jurosPercentual > 0 ? 1 + jurosPercentual / 100 : 1
  const total = valorTotal * fator
  const valorParcela = Math.floor((total / numParcelas) * 100) / 100
  const ajuste = Math.round((total - valorParcela * numParcelas) * 100) / 100
  const base = new Date(dataPrimeira + 'T12:00:00')

  return Array.from({ length: numParcelas }, (_, i) => {
    const d = new Date(base)
    d.setMonth(d.getMonth() + i)
    return {
      conta_pagar_id: contaId,
      user_id: userId,
      numero_parcela: i + 1,
      total_parcelas: numParcelas,
      valor: i === numParcelas - 1 ? valorParcela + ajuste : valorParcela,
      data_vencimento: d.toISOString().split('T')[0],
      juros: 0, multa: 0, desconto: 0,
      status: 'aberto',
    }
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const {
    descricao, valor_total, num_parcelas = 1,
    juros_percentual = 0, multa_percentual = 0, desconto_valor = 0,
    data_primeira_parcela, forma_pagamento_id, conta_corrente_id,
    cartao_id, fornecedor_id, categoria_id, centro_custo_id, observacoes,
  } = body

  const { data: conta, error } = await supabase
    .from('contas_pagar')
    .insert({
      user_id: user.id, descricao, valor_total, num_parcelas,
      juros_percentual, multa_percentual, desconto_valor,
      data_primeira_parcela, forma_pagamento_id: forma_pagamento_id || null,
      conta_corrente_id: conta_corrente_id || null, cartao_id: cartao_id || null,
      fornecedor_id: fornecedor_id || null, categoria_id: categoria_id || null,
      centro_custo_id: centro_custo_id || null, observacoes: observacoes || null,
      status: 'aberto',
    })
    .select('id')
    .single()

  if (error || !conta) {
    return NextResponse.json({ error: error?.message ?? 'Erro ao criar conta' }, { status: 500 })
  }

  const parcelas = gerarParcelas(user.id, conta.id, valor_total, num_parcelas, juros_percentual, data_primeira_parcela)
  const { error: errParcelas } = await supabase.from('parcelas_pagar').insert(parcelas)
  if (errParcelas) {
    return NextResponse.json({ error: errParcelas.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: conta.id })
}
