import { createClient } from '@/lib/supabase/client'
import type { ContaPagar, ParcelaPagar, StatusConta } from '@/types'
import { getOuCriarFatura, getCartaoById, calcularMesFatura } from './cartoes'

function gerarParcelasPagar(
  userId: string,
  contaId: string,
  valorTotal: number,
  numParcelas: number,
  jurosPercentual: number,
  dataPrimeira: string
): Omit<ParcelaPagar, 'id' | 'created_at' | 'updated_at'>[] {
  const fator = jurosPercentual > 0 ? 1 + jurosPercentual / 100 : 1
  const totalComJuros = valorTotal * fator
  const valorParcela = Math.floor((totalComJuros / numParcelas) * 100) / 100
  const ajuste = Math.round((totalComJuros - valorParcela * numParcelas) * 100) / 100
  const dataPrimeiraDate = new Date(dataPrimeira + 'T12:00:00')

  return Array.from({ length: numParcelas }, (_, i) => {
    const dataVenc = new Date(dataPrimeiraDate)
    dataVenc.setMonth(dataVenc.getMonth() + i)
    return {
      conta_pagar_id: contaId,
      user_id: userId,
      numero_parcela: i + 1,
      total_parcelas: numParcelas,
      valor: i === numParcelas - 1 ? valorParcela + ajuste : valorParcela,
      valor_pago: undefined,
      data_vencimento: dataVenc.toISOString().split('T')[0],
      data_pagamento: undefined,
      juros: 0,
      multa: 0,
      desconto: 0,
      status: 'aberto' as const,
      forma_pagamento_id: undefined,
      conta_corrente_id: undefined,
      cartao_id: undefined,
      observacoes: undefined,
    }
  })
}

export async function getContasPagar(
  userId: string,
  filters?: { status?: string; fornecedorId?: string; dateFrom?: string; dateTo?: string }
): Promise<ContaPagar[]> {
  const supabase = createClient()
  let query = supabase
    .from('contas_pagar')
    .select('*, fornecedores(id,nome,cpf_cnpj), categorias(id,nome,cor,icone)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('data_primeira_parcela', { ascending: false })

  if (filters?.status)      query = query.eq('status', filters.status)
  if (filters?.fornecedorId) query = query.eq('fornecedor_id', filters.fornecedorId)
  if (filters?.dateFrom)    query = query.gte('data_primeira_parcela', filters.dateFrom)
  if (filters?.dateTo)      query = query.lte('data_primeira_parcela', filters.dateTo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ContaPagar[]
}

export async function getParcelasPagar(
  userId: string,
  filters?: { status?: string; dateFrom?: string; dateTo?: string }
): Promise<(ParcelaPagar & { fornecedor_nome?: string; conta_descricao?: string })[]> {
  const supabase = createClient()
  let query = supabase
    .from('parcelas_pagar')
    .select('*, contas_pagar(id,descricao,valor_total,fornecedores(id,nome))')
    .eq('user_id', userId)
    .order('data_vencimento', { ascending: true })

  if (filters?.status)   query = query.eq('status', filters.status)
  if (filters?.dateFrom) query = query.gte('data_vencimento', filters.dateFrom)
  if (filters?.dateTo)   query = query.lte('data_vencimento', filters.dateTo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((p: Record<string, unknown>) => {
    const cp = p.contas_pagar as { descricao?: string; fornecedores?: { nome?: string } } | null
    return {
      ...p,
      fornecedor_nome: cp?.fornecedores?.nome,
      conta_descricao: cp?.descricao,
    }
  }) as (ParcelaPagar & { fornecedor_nome?: string; conta_descricao?: string })[]
}

export async function createContaPagar(
  userId: string,
  formData: Omit<ContaPagar, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'status' | 'fornecedores' | 'categorias'>
): Promise<ContaPagar> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contas_pagar')
    .insert({ ...formData, user_id: userId, status: 'aberto' })
    .select()
    .single()
  if (error) throw error

  const parcelas = gerarParcelasPagar(
    userId,
    data.id,
    formData.valor_total,
    formData.num_parcelas,
    formData.juros_percentual,
    formData.data_primeira_parcela
  )

  const { error: errParcelas } = await supabase.from('parcelas_pagar').insert(parcelas)
  if (errParcelas) throw errParcelas

  return data as ContaPagar
}

export async function updateContaPagar(
  userId: string,
  id: string,
  dados: { fornecedor_id?: string; descricao: string; observacoes?: string; conta_corrente_id?: string; cartao_id?: string }
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('contas_pagar')
    .update(dados)
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function cancelarContaPagar(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('parcelas_pagar')
    .update({ status: 'cancelado' })
    .eq('conta_pagar_id', id)
    .in('status', ['aberto', 'atrasado'])

  await supabase
    .from('contas_pagar')
    .update({ status: 'cancelado', deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
}

export async function excluirContaPagar(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('parcelas_pagar').delete().eq('conta_pagar_id', id)
  await supabase.from('contas_pagar').delete().eq('id', id).eq('user_id', userId)
}

export async function registrarPagamento(
  userId: string,
  parcelaId: string,
  dados: {
    valor_pago: number
    juros: number
    multa: number
    desconto: number
    forma_pagamento_id?: string
    conta_corrente_id?: string
    cartao_id?: string
    data_pagamento: string
    observacoes?: string
  }
): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('parcelas_pagar')
    .update({ ...dados, status: 'pago' })
    .eq('id', parcelaId)

  // Pagar via conta corrente
  if (dados.conta_corrente_id) {
    const { data: conta } = await supabase
      .from('contas_correntes')
      .select('saldo_atual')
      .eq('id', dados.conta_corrente_id)
      .single()

    if (conta) {
      const novoSaldo = conta.saldo_atual - dados.valor_pago
      await supabase
        .from('contas_correntes')
        .update({ saldo_atual: novoSaldo })
        .eq('id', dados.conta_corrente_id)

      await supabase.from('movimentacoes_conta').insert({
        user_id: userId,
        conta_corrente_id: dados.conta_corrente_id,
        tipo: 'debito',
        valor: dados.valor_pago,
        saldo_anterior: conta.saldo_atual,
        saldo_posterior: novoSaldo,
        descricao: `Pagamento — parcela #${parcelaId}`,
        data_movimentacao: dados.data_pagamento,
        parcela_pagar_id: parcelaId,
      })
    }
  }

  // Pagar via cartão de crédito
  if (dados.cartao_id) {
    const cartao = await getCartaoById(userId, dados.cartao_id)
    if (cartao) {
      const dataCompra = new Date(dados.data_pagamento)
      const mesFatura = calcularMesFatura(cartao, dataCompra)
      const fatura = await getOuCriarFatura(userId, cartao, mesFatura)

      await supabase
        .from('faturas_cartao')
        .update({ valor_total: fatura.valor_total + dados.valor_pago })
        .eq('id', fatura.id)

      await supabase
        .from('cartoes')
        .update({ limite_disponivel: Math.max(0, cartao.limite_disponivel - dados.valor_pago) })
        .eq('id', cartao.id)
    }
  }

  // Verificar se conta foi quitada
  const { data: parcela } = await supabase
    .from('parcelas_pagar')
    .select('conta_pagar_id')
    .eq('id', parcelaId)
    .single()

  if (parcela) {
    const { data: abertas } = await supabase
      .from('parcelas_pagar')
      .select('id')
      .eq('conta_pagar_id', parcela.conta_pagar_id)
      .in('status', ['aberto', 'atrasado'])

    const novoStatus: StatusConta = (abertas ?? []).length === 0 ? 'quitado' : 'parcial'
    await supabase
      .from('contas_pagar')
      .update({ status: novoStatus })
      .eq('id', parcela.conta_pagar_id)
  }
}

export async function getResumoPagar(userId: string): Promise<{
  totalAberto: number
  totalAtrasado: number
  totalPagoMes: number
  qtdVenceHoje: number
}> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const [abertos, atrasados, pagosMes, venceHoje] = await Promise.all([
    supabase.from('parcelas_pagar').select('valor').eq('user_id', userId).eq('status', 'aberto'),
    supabase.from('parcelas_pagar').select('valor').eq('user_id', userId).eq('status', 'atrasado'),
    supabase
      .from('parcelas_pagar')
      .select('valor_pago')
      .eq('user_id', userId)
      .eq('status', 'pago')
      .gte('data_pagamento', inicioMes),
    supabase
      .from('parcelas_pagar')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['aberto', 'atrasado'])
      .eq('data_vencimento', hoje),
  ])

  return {
    totalAberto:   (abertos.data ?? []).reduce((s: number, p: {valor: number}) => s + p.valor, 0),
    totalAtrasado: (atrasados.data ?? []).reduce((s: number, p: {valor: number}) => s + p.valor, 0),
    totalPagoMes:  (pagosMes.data ?? []).reduce(
      (s: number, p: {valor_pago: number | null}) => s + (p.valor_pago ?? 0), 0
    ),
    qtdVenceHoje: (venceHoje.data ?? []).length,
  }
}

export async function atualizarParcelasAtrasadasPagar(userId: string): Promise<void> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  await supabase
    .from('parcelas_pagar')
    .update({ status: 'atrasado' })
    .eq('user_id', userId)
    .eq('status', 'aberto')
    .lt('data_vencimento', hoje)
}
