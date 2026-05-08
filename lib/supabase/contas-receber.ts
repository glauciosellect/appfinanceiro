import { createClient } from '@/lib/supabase/client'
import type { ContaReceber, ParcelaReceber, StatusConta } from '@/types'

function gerarParcelas(
  userId: string,
  contaId: string,
  valorTotal: number,
  valorEntrada: number,
  numParcelas: number,
  jurosPercentual: number,
  dataPrimeira: string
): Omit<ParcelaReceber, 'id' | 'created_at' | 'updated_at'>[] {
  const parcelas: Omit<ParcelaReceber, 'id' | 'created_at' | 'updated_at'>[] = []
  const valorBase = valorTotal - valorEntrada
  const fator = jurosPercentual > 0 ? 1 + jurosPercentual / 100 : 1
  const totalComJuros = valorBase * fator
  const valorParcela = Math.floor((totalComJuros / numParcelas) * 100) / 100
  const ajuste = Math.round((totalComJuros - valorParcela * numParcelas) * 100) / 100

  const dataPrimeiraDate = new Date(dataPrimeira + 'T12:00:00')

  // Entrada (se houver)
  if (valorEntrada > 0) {
    parcelas.push({
      conta_receber_id: contaId,
      user_id: userId,
      numero_parcela: 0,
      total_parcelas: numParcelas,
      valor: valorEntrada,
      valor_recebido: undefined,
      data_vencimento: dataPrimeira,
      data_recebimento: undefined,
      juros: 0,
      multa: 0,
      desconto: 0,
      status: 'entrada',
      forma_pagamento_id: undefined,
      conta_corrente_id: undefined,
      observacoes: 'Entrada',
    })
  }

  for (let i = 0; i < numParcelas; i++) {
    const dataVenc = new Date(dataPrimeiraDate)
    dataVenc.setMonth(dataVenc.getMonth() + i)
    const valor = i === numParcelas - 1 ? valorParcela + ajuste : valorParcela

    parcelas.push({
      conta_receber_id: contaId,
      user_id: userId,
      numero_parcela: i + 1,
      total_parcelas: numParcelas,
      valor,
      valor_recebido: undefined,
      data_vencimento: dataVenc.toISOString().split('T')[0],
      data_recebimento: undefined,
      juros: 0,
      multa: 0,
      desconto: 0,
      status: 'aberto',
      forma_pagamento_id: undefined,
      conta_corrente_id: undefined,
      observacoes: undefined,
    })
  }
  return parcelas
}

export async function getContasReceber(
  userId: string,
  filters?: { status?: string; clienteId?: string; dateFrom?: string; dateTo?: string }
): Promise<ContaReceber[]> {
  const supabase = createClient()
  let query = supabase
    .from('contas_receber')
    .select('*, clientes(id,nome,cpf_cnpj), categorias(id,nome,cor,icone)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('data_primeira_parcela', { ascending: false })

  if (filters?.status)    query = query.eq('status', filters.status)
  if (filters?.clienteId) query = query.eq('cliente_id', filters.clienteId)
  if (filters?.dateFrom)  query = query.gte('data_primeira_parcela', filters.dateFrom)
  if (filters?.dateTo)    query = query.lte('data_primeira_parcela', filters.dateTo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ContaReceber[]
}

export async function getParcelasReceber(
  userId: string,
  filters?: { status?: string; dateFrom?: string; dateTo?: string; clienteId?: string }
): Promise<(ParcelaReceber & { cliente_nome?: string; conta_descricao?: string })[]> {
  const supabase = createClient()
  let query = supabase
    .from('parcelas_receber')
    .select('*, contas_receber(id,descricao,valor_total,clientes(id,nome))')
    .eq('user_id', userId)
    .order('data_vencimento', { ascending: true })

  if (filters?.status)   query = query.eq('status', filters.status)
  if (filters?.dateFrom) query = query.gte('data_vencimento', filters.dateFrom)
  if (filters?.dateTo)   query = query.lte('data_vencimento', filters.dateTo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((p: Record<string, unknown>) => {
    const cr = p.contas_receber as { descricao?: string; clientes?: { nome?: string } } | null
    return {
      ...p,
      cliente_nome: cr?.clientes?.nome,
      conta_descricao: cr?.descricao,
    }
  }) as (ParcelaReceber & { cliente_nome?: string; conta_descricao?: string })[]
}

export async function createContaReceber(
  userId: string,
  formData: Omit<ContaReceber, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'status' | 'clientes' | 'categorias'>
): Promise<ContaReceber> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contas_receber')
    .insert({ ...formData, user_id: userId, status: 'aberto' })
    .select()
    .single()
  if (error) throw error

  const parcelas = gerarParcelas(
    userId,
    data.id,
    formData.valor_total,
    formData.valor_entrada,
    formData.num_parcelas,
    formData.juros_percentual,
    formData.data_primeira_parcela
  )

  const { error: errParcelas } = await supabase.from('parcelas_receber').insert(parcelas)
  if (errParcelas) throw errParcelas

  return data as ContaReceber
}

export async function updateContaReceber(
  userId: string,
  id: string,
  dados: { cliente_id?: string; descricao: string; observacoes?: string; conta_corrente_id?: string }
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('contas_receber')
    .update(dados)
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function cancelarContaReceber(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('parcelas_receber')
    .update({ status: 'cancelado' })
    .eq('conta_receber_id', id)
    .in('status', ['aberto', 'atrasado'])

  await supabase
    .from('contas_receber')
    .update({ status: 'cancelado', deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
}

export async function registrarRecebimento(
  userId: string,
  parcelaId: string,
  dados: {
    valor_recebido: number
    juros: number
    multa: number
    desconto: number
    forma_pagamento_id?: string
    conta_corrente_id?: string
    data_recebimento: string
    observacoes?: string
  }
): Promise<void> {
  const supabase = createClient()

  // Atualizar parcela
  await supabase
    .from('parcelas_receber')
    .update({
      ...dados,
      status: 'recebido',
    })
    .eq('id', parcelaId)

  // Movimentar conta se informado
  if (dados.conta_corrente_id) {
    const { data: conta } = await supabase
      .from('contas_correntes')
      .select('saldo_atual')
      .eq('id', dados.conta_corrente_id)
      .single()

    if (conta) {
      const novoSaldo = conta.saldo_atual + dados.valor_recebido
      await supabase
        .from('contas_correntes')
        .update({ saldo_atual: novoSaldo })
        .eq('id', dados.conta_corrente_id)

      await supabase.from('movimentacoes_conta').insert({
        user_id: userId,
        conta_corrente_id: dados.conta_corrente_id,
        tipo: 'credito',
        valor: dados.valor_recebido,
        saldo_anterior: conta.saldo_atual,
        saldo_posterior: novoSaldo,
        descricao: `Recebimento — parcela #${parcelaId}`,
        data_movimentacao: dados.data_recebimento,
        parcela_receber_id: parcelaId,
      })
    }
  }

  // Verificar se conta foi quitada
  const { data: parcela } = await supabase
    .from('parcelas_receber')
    .select('conta_receber_id')
    .eq('id', parcelaId)
    .single()

  if (parcela) {
    const { data: abertas } = await supabase
      .from('parcelas_receber')
      .select('id')
      .eq('conta_receber_id', parcela.conta_receber_id)
      .in('status', ['aberto', 'atrasado'])

    const novoStatus: StatusConta = (abertas ?? []).length === 0 ? 'quitado' : 'parcial'
    await supabase
      .from('contas_receber')
      .update({ status: novoStatus })
      .eq('id', parcela.conta_receber_id)
  }
}

export async function getResumoReceber(userId: string): Promise<{
  totalAberto: number
  totalAtrasado: number
  totalRecebidoMes: number
  qtdVenceHoje: number
}> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0]

  const [abertos, atrasados, recebidosMes, venceHoje] = await Promise.all([
    supabase
      .from('parcelas_receber')
      .select('valor')
      .eq('user_id', userId)
      .eq('status', 'aberto'),
    supabase
      .from('parcelas_receber')
      .select('valor')
      .eq('user_id', userId)
      .eq('status', 'atrasado'),
    supabase
      .from('parcelas_receber')
      .select('valor_recebido')
      .eq('user_id', userId)
      .eq('status', 'recebido')
      .gte('data_recebimento', inicioMes),
    supabase
      .from('parcelas_receber')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['aberto', 'atrasado'])
      .eq('data_vencimento', hoje),
  ])

  return {
    totalAberto: (abertos.data ?? []).reduce((s: number, p: {valor: number}) => s + p.valor, 0),
    totalAtrasado: (atrasados.data ?? []).reduce((s: number, p: {valor: number}) => s + p.valor, 0),
    totalRecebidoMes: (recebidosMes.data ?? []).reduce(
      (s: number, p: {valor_recebido: number | null}) => s + (p.valor_recebido ?? 0), 0
    ),
    qtdVenceHoje: (venceHoje.data ?? []).length,
  }
}

// Atualiza status de parcelas vencidas para 'atrasado'
export async function atualizarParcelasAtrasadas(userId: string): Promise<void> {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  await supabase
    .from('parcelas_receber')
    .update({ status: 'atrasado' })
    .eq('user_id', userId)
    .eq('status', 'aberto')
    .lt('data_vencimento', hoje)
}
