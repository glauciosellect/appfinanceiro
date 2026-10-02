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

// Quantidades vendidas sem estoque que ainda não foram cobertas por uma entrada (por produto).
export async function carregarPendencias(userId: string): Promise<Record<string, number>> {
  const { data, error } = await createClient()
    .from('vendas_sem_estoque')
    .select('produto_id, pendente')
    .eq('user_id', userId)
    .gt('pendente', 0)
  if (error) throw error
  const mapa: Record<string, number> = {}
  for (const r of (data ?? []) as { produto_id: string; pendente: number }[]) {
    mapa[r.produto_id] = (mapa[r.produto_id] ?? 0) + Number(r.pendente)
  }
  return mapa
}

// Saldo REAL de cada produto, em tempo real: soma dos lotes em estoque menos o que foi
// vendido sem estoque e ainda não foi coberto. Pode ser negativo.
export async function carregarSaldosPorProduto(userId: string): Promise<Record<string, number>> {
  const supabase = createClient()
  const [lotes, pend] = await Promise.all([
    supabase.from('lotes_estoque').select('produto_id, qtd_saldo').eq('user_id', userId).eq('status', 'ativo').gt('qtd_saldo', 0),
    carregarPendencias(userId).catch(() => ({} as Record<string, number>)),
  ])
  if (lotes.error) throw lotes.error
  const saldos: Record<string, number> = {}
  for (const r of (lotes.data ?? []) as { produto_id: string; qtd_saldo: number }[]) {
    saldos[r.produto_id] = (saldos[r.produto_id] ?? 0) + Number(r.qtd_saldo)
  }
  for (const [produtoId, qtd] of Object.entries(pend)) {
    saldos[produtoId] = (saldos[produtoId] ?? 0) - qtd
  }
  return saldos
}

// Ajusta o estoque de um produto para a quantidade realmente existente (intro_ajustar_estoque_produto).
export async function ajustarEstoqueProduto(
  produtoId: string,
  novaQuantidade: number,
  motivo: string,
  fornecedorId: string | null
): Promise<string | null> {
  const { error } = await createClient().rpc('intro_ajustar_estoque_produto', {
    p_produto: produtoId,
    p_nova: novaQuantidade,
    p_motivo: motivo,
    p_fornecedor: fornecedorId,
  })
  return error ? error.message : null
}
