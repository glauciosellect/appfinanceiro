import { createClient } from '@/lib/supabase/client'

export type CondicaoPagamento = 'avista' | 'prazo' | 'consignado'

export const CONDICAO_LABEL: Record<CondicaoPagamento, string> = {
  avista: 'À vista',
  prazo: 'A prazo',
  consignado: 'Consignado',
}

export interface ItemEntradaPayload {
  produto_id: string
  quantidade: number
  custo_unitario: number
  preco_venda: number | null
  validade: string | null
}

export interface EntradaPayload {
  fornecedor_id: string
  data: string
  numero_documento: string
  condicao_pagamento: CondicaoPagamento
  vencimento: string | null
  parcelas: number
  observacao: string
  itens: ItemEntradaPayload[]
}

// Mensagens de RAISE EXCEPTION do banco chegam em error.message, já em português.
export async function registrarEntrada(payload: EntradaPayload): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await createClient().rpc('intro_registrar_entrada', { p: payload })
  if (error) return { id: null, erro: error.message }
  return { id: data as string, erro: null }
}

export async function estornarEntrada(id: string): Promise<string | null> {
  const { error } = await createClient().rpc('intro_estornar_entrada', { p_id: id })
  return error ? error.message : null
}

export async function ajustarLote(loteId: string, delta: number, motivo: string): Promise<string | null> {
  const { error } = await createClient().rpc('intro_ajustar_lote', { p_lote: loteId, p_delta: delta, p_motivo: motivo })
  return error ? error.message : null
}

export interface EntradaLinha {
  id: string
  data: string
  numero_documento: string | null
  condicao_pagamento: CondicaoPagamento
  total_custo: number
  status: 'ativa' | 'estornada'
  fornecedores: { nome: string } | null
}

export async function listarEntradas(userId: string): Promise<EntradaLinha[]> {
  const { data, error } = await createClient()
    .from('entradas_mercadoria')
    .select('id, data, numero_documento, condicao_pagamento, total_custo, status, fornecedores(nome)')
    .eq('user_id', userId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EntradaLinha[]
}
