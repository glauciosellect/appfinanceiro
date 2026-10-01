import { createClient } from '@/lib/supabase/client'
import { hojeISO } from '@/lib/intro/produtos'

export interface LoteEstoque {
  id: string
  produto_id: string
  fornecedor_id: string
  consignado: boolean
  custo_unitario: number
  validade: string | null
  qtd_inicial: number
  qtd_saldo: number
  status: string
  created_at: string
  produtos_fiscais: { descricao: string; unidade: string; preco_venda: number; barcode: string | null; plu: string | null } | null
  fornecedores: { nome: string } | null
}

// Lotes com saldo (o que está fisicamente na loja).
export async function carregarLotesComSaldo(userId: string): Promise<LoteEstoque[]> {
  const { data, error } = await createClient()
    .from('lotes_estoque')
    .select(
      'id, produto_id, fornecedor_id, consignado, custo_unitario, validade, qtd_inicial, qtd_saldo, status, created_at, produtos_fiscais(descricao, unidade, preco_venda, barcode, plu), fornecedores(nome)'
    )
    .eq('user_id', userId)
    .gt('qtd_saldo', 0)
    .order('validade', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as LoteEstoque[]
}

export type SituacaoValidade = 'sem' | 'ok' | 'vencendo' | 'vencido'

// diasAlerta vem de intro_config.dias_alerta_validade.
export function situacaoValidade(validade: string | null, diasAlerta: number): SituacaoValidade {
  if (!validade) return 'sem'
  const hoje = hojeISO()
  if (validade < hoje) return 'vencido'
  const limite = new Date(hoje + 'T00:00:00')
  limite.setDate(limite.getDate() + diasAlerta)
  return new Date(validade + 'T00:00:00') <= limite ? 'vencendo' : 'ok'
}

export function diasParaVencer(validade: string): number {
  const ms = new Date(validade + 'T00:00:00').getTime() - new Date(hojeISO() + 'T00:00:00').getTime()
  return Math.round(ms / 86400000)
}
