import { createClient } from '@/lib/supabase/client'
import type { FiscalConfig, Pedido, PedidoFormData, PedidoItem, PedidoItemFormData, StatusPedido } from '@/types'

export async function getPedidos(
  userId: string,
  filters?: { status?: StatusPedido; clienteId?: string; busca?: string }
): Promise<Pedido[]> {
  const supabase = createClient()
  let query = supabase
    .from('pedidos')
    .select('*, clientes(id, nome, telefone)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.clienteId) query = query.eq('cliente_id', filters.clienteId)
  if (filters?.busca) {
    query = query.or(`numero_sequencial.ilike.%${filters.busca}%,referencia.ilike.%${filters.busca}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Pedido[]
}

export async function getPedidoById(userId: string, id: string): Promise<Pedido | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, clientes(id, nome, telefone)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as Pedido
}

export async function getPedidoComItens(
  userId: string,
  id: string
): Promise<{ pedido: Pedido; itens: PedidoItem[] } | null> {
  const pedido = await getPedidoById(userId, id)
  if (!pedido) return null

  const supabase = createClient()
  const { data, error } = await supabase
    .from('pedido_itens')
    .select('*')
    .eq('pedido_id', id)
    .eq('user_id', userId)
    .order('created_at')
  if (error) throw error

  return { pedido, itens: (data ?? []) as PedidoItem[] }
}

export async function getContadorPorStatus(userId: string): Promise<Record<StatusPedido, number>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('status')
    .eq('user_id', userId)
    .is('deleted_at', null)
  if (error) throw error

  const contador: Record<StatusPedido, number> = {
    pendente: 0,
    aguardando_pagamento: 0,
    concluido: 0,
    cancelado: 0,
  }
  for (const row of (data ?? []) as { status: StatusPedido }[]) {
    contador[row.status] = (contador[row.status] ?? 0) + 1
  }
  return contador
}

export async function gerarNumeroSequencial(userId: string): Promise<string> {
  const supabase = createClient()
  const anoAtual = new Date().getFullYear()
  const { count, error } = await supabase
    .from('pedidos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('numero_sequencial', `%-${anoAtual}`)
  if (error) throw error
  const proximo = (count ?? 0) + 1
  return `${String(proximo).padStart(3, '0')}-${anoAtual}`
}

export async function createPedido(userId: string, formData?: Partial<PedidoFormData>): Promise<Pedido> {
  const supabase = createClient()
  const numero_sequencial = await gerarNumeroSequencial(userId)
  const hoje = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('pedidos')
    .insert({
      user_id: userId,
      numero_sequencial,
      cliente_id: formData?.cliente_id,
      data_pedido: formData?.data_pedido ?? hoje,
      referencia: formData?.referencia,
      observacoes: formData?.observacoes,
      status: 'pendente',
      desconto_tipo: formData?.desconto_tipo ?? 'percentual',
      desconto_valor: formData?.desconto_valor ?? 0,
      subtotal: 0,
      total: 0,
    })
    .select('*, clientes(id, nome, telefone)')
    .single()
  if (error) throw error
  return data as Pedido
}

export async function updatePedido(
  userId: string,
  id: string,
  formData: Partial<PedidoFormData>
): Promise<Pedido> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .update(formData)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*, clientes(id, nome, telefone)')
    .single()
  if (error) throw error
  return data as Pedido
}

export async function updateStatusPedido(userId: string, id: string, status: StatusPedido): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function excluirPedido(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

function calcularSubtotalItem(item: {
  quantidade: number
  preco_unitario: number
  desconto_tipo: 'percentual' | 'valor'
  desconto_valor: number
}): number {
  const bruto = item.quantidade * item.preco_unitario
  const desconto =
    item.desconto_tipo === 'percentual' ? bruto * (item.desconto_valor / 100) : item.desconto_valor
  return bruto - desconto
}

export async function addItemPedido(
  userId: string,
  pedidoId: string,
  item: PedidoItemFormData
): Promise<PedidoItem> {
  const supabase = createClient()
  const subtotal = calcularSubtotalItem(item)

  const { data, error } = await supabase
    .from('pedido_itens')
    .insert({ ...item, pedido_id: pedidoId, user_id: userId, subtotal })
    .select()
    .single()
  if (error) throw error

  await recalcularTotaisPedido(userId, pedidoId)
  return data as PedidoItem
}

export async function updateItemPedido(
  userId: string,
  itemId: string,
  item: Partial<PedidoItemFormData>
): Promise<PedidoItem> {
  const supabase = createClient()

  const { data: atual, error: errAtual } = await supabase
    .from('pedido_itens')
    .select('*')
    .eq('id', itemId)
    .eq('user_id', userId)
    .single()
  if (errAtual) throw errAtual

  const merged = { ...atual, ...item }
  const subtotal = calcularSubtotalItem(merged)

  const { data, error } = await supabase
    .from('pedido_itens')
    .update({ ...item, subtotal })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error

  await recalcularTotaisPedido(userId, atual.pedido_id)
  return data as PedidoItem
}

export async function removeItemPedido(userId: string, pedidoId: string, itemId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('pedido_itens')
    .delete()
    .eq('id', itemId)
    .eq('pedido_id', pedidoId)
    .eq('user_id', userId)
  if (error) throw error

  await recalcularTotaisPedido(userId, pedidoId)
}

export async function recalcularTotaisPedido(userId: string, pedidoId: string): Promise<Pedido> {
  const supabase = createClient()

  const { data: itens, error: errItens } = await supabase
    .from('pedido_itens')
    .select('subtotal')
    .eq('pedido_id', pedidoId)
    .eq('user_id', userId)
  if (errItens) throw errItens

  const subtotal = (itens ?? []).reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0)

  const { data: pedido, error: errPedido } = await supabase
    .from('pedidos')
    .select('desconto_tipo, desconto_valor')
    .eq('id', pedidoId)
    .eq('user_id', userId)
    .single()
  if (errPedido) throw errPedido

  const desconto =
    pedido.desconto_tipo === 'percentual'
      ? subtotal * (pedido.desconto_valor / 100)
      : pedido.desconto_valor
  const total = subtotal - desconto

  const { data, error } = await supabase
    .from('pedidos')
    .update({ subtotal, total })
    .eq('id', pedidoId)
    .eq('user_id', userId)
    .select('*, clientes(id, nome, telefone)')
    .single()
  if (error) throw error
  return data as Pedido
}

// ============================================================
// ORÇAMENTO PÚBLICO (link de compartilhamento/aceite, sem auth)
// ============================================================

export async function getOrcamentoPublico(
  token: string
): Promise<{ pedido: Pedido; itens: PedidoItem[]; fiscalConfig: FiscalConfig | Record<string, never> } | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_orcamento_publico', { p_token: token })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row || !row.pedido) return null

  return {
    pedido: { ...row.pedido, clientes: row.cliente ?? null } as Pedido,
    itens: (row.itens ?? []) as PedidoItem[],
    fiscalConfig: (row.fiscal_config ?? {}) as FiscalConfig | Record<string, never>,
  }
}

export async function aceitarOrcamentoPublico(token: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('aceitar_orcamento_por_token', { p_token: token, p_ip: '' })
  if (error) throw error
}
