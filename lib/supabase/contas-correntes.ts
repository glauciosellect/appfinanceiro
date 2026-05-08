import { createClient } from '@/lib/supabase/client'
import type { ContaCorrente, ContaCorrenteFormData, MovimentacaoConta } from '@/types'

export async function getContasCorrentes(userId: string): Promise<ContaCorrente[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contas_correntes')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('ativo', true)
    .order('nome_apelido')
  if (error) throw error
  return (data ?? []) as ContaCorrente[]
}

export async function getContaById(userId: string, id: string): Promise<ContaCorrente | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contas_correntes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as ContaCorrente
}

export async function createConta(
  userId: string,
  formData: ContaCorrenteFormData
): Promise<ContaCorrente> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contas_correntes')
    .insert({
      ...formData,
      user_id: userId,
      saldo_atual: formData.saldo_inicial,
    })
    .select()
    .single()
  if (error) throw error

  // Criar movimentação inicial se saldo > 0
  if (formData.saldo_inicial > 0) {
    await supabase.from('movimentacoes_conta').insert({
      user_id: userId,
      conta_corrente_id: data.id,
      tipo: 'credito',
      valor: formData.saldo_inicial,
      saldo_anterior: 0,
      saldo_posterior: formData.saldo_inicial,
      descricao: 'Saldo inicial',
      data_movimentacao: new Date().toISOString().split('T')[0],
    })
  }

  return data as ContaCorrente
}

export async function updateConta(
  userId: string,
  id: string,
  formData: Partial<ContaCorrenteFormData>
): Promise<ContaCorrente> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('contas_correntes')
    .update(formData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as ContaCorrente
}

export async function deleteConta(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('contas_correntes')
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getExtratoConta(
  contaId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<MovimentacaoConta[]> {
  const supabase = createClient()
  let query = supabase
    .from('movimentacoes_conta')
    .select('*')
    .eq('conta_corrente_id', contaId)
    .order('data_movimentacao', { ascending: false })
    .order('created_at', { ascending: false })

  if (dateFrom) query = query.gte('data_movimentacao', dateFrom)
  if (dateTo)   query = query.lte('data_movimentacao', dateTo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as MovimentacaoConta[]
}

export async function transferirEntreContas(
  userId: string,
  origemId: string,
  destinoId: string,
  valor: number,
  data: string,
  descricao: string
): Promise<void> {
  const supabase = createClient()
  const origem = await getContaById(userId, origemId)
  const destino = await getContaById(userId, destinoId)
  if (!origem || !destino) throw new Error('Conta não encontrada')
  if (origem.saldo_atual < valor) throw new Error('Saldo insuficiente')

  const novoSaldoOrigem = origem.saldo_atual - valor
  const novoSaldoDestino = destino.saldo_atual + valor

  await supabase.from('movimentacoes_conta').insert([
    {
      user_id: userId,
      conta_corrente_id: origemId,
      tipo: 'transferencia_saida',
      valor,
      saldo_anterior: origem.saldo_atual,
      saldo_posterior: novoSaldoOrigem,
      descricao: `Transferência para ${destino.nome_apelido}: ${descricao}`,
      data_movimentacao: data,
    },
    {
      user_id: userId,
      conta_corrente_id: destinoId,
      tipo: 'transferencia_entrada',
      valor,
      saldo_anterior: destino.saldo_atual,
      saldo_posterior: novoSaldoDestino,
      descricao: `Transferência de ${origem.nome_apelido}: ${descricao}`,
      data_movimentacao: data,
    },
  ])

  await supabase
    .from('contas_correntes')
    .update({ saldo_atual: novoSaldoOrigem })
    .eq('id', origemId)

  await supabase
    .from('contas_correntes')
    .update({ saldo_atual: novoSaldoDestino })
    .eq('id', destinoId)
}

export async function getSaldoTotal(userId: string): Promise<number> {
  const contas = await getContasCorrentes(userId)
  return contas.reduce((sum, c) => sum + c.saldo_atual, 0)
}
