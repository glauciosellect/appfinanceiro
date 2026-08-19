import { createClient } from '@/lib/supabase/client'
import type { Produto, ProdutoFormData } from '@/types'

export async function getProdutos(
  userId: string,
  filters?: { ativo?: boolean; busca?: string }
): Promise<Produto[]> {
  const supabase = createClient()
  let query = supabase
    .from('produtos')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('nome')

  if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo)
  if (filters?.busca) {
    query = query.or(
      `nome.ilike.%${filters.busca}%,barcode.ilike.%${filters.busca}%,plu.ilike.%${filters.busca}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Produto[]
}

export async function getProdutoById(userId: string, id: string): Promise<Produto | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as Produto
}

export async function getProdutoByBarcodeOuPlu(userId: string, codigo: string): Promise<Produto | null> {
  const supabase = createClient()
  const { data: porBarcode } = await supabase
    .from('produtos')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('barcode', codigo)
    .single()
  if (porBarcode) return porBarcode as Produto

  const { data: porPlu } = await supabase
    .from('produtos')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('plu', codigo)
    .single()
  if (porPlu) return porPlu as Produto

  return null
}

export async function createProduto(userId: string, formData: ProdutoFormData): Promise<Produto> {
  const supabase = createClient()
  const margem_lucro = calcularMargemLucro(formData.preco_custo, formData.preco_unitario)
  const { data, error } = await supabase
    .from('produtos')
    .insert({ ...formData, user_id: userId, margem_lucro, ativo: true })
    .select()
    .single()
  if (error) throw error
  return data as Produto
}

export async function updateProduto(
  userId: string,
  id: string,
  formData: Partial<ProdutoFormData>
): Promise<Produto> {
  const supabase = createClient()
  const payload: Partial<ProdutoFormData> & { margem_lucro?: number } = { ...formData }
  if (formData.preco_custo !== undefined && formData.preco_unitario !== undefined) {
    payload.margem_lucro = calcularMargemLucro(formData.preco_custo, formData.preco_unitario)
  }
  const { data, error } = await supabase
    .from('produtos')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Produto
}

export async function deleteProduto(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('produtos')
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export function calcularMargemLucro(precoCusto: number, precoVenda: number): number {
  return precoVenda > 0 ? ((precoVenda - precoCusto) / precoVenda) * 100 : 0
}

export async function gerarPluAutomatico(userId: string): Promise<string> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('produtos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  const proximo = (count ?? 0) + 1
  return String(proximo).padStart(6, '0')
}

// ============================================================
// PRODUTOS_FISCAIS — catálogo unificado (fonte única de produtos)
// ============================================================
// A tabela standalone `produtos` acima é deprecada: o item-picker do
// Orçamento (e o PDV) agora consulta produtos_fiscais.
export async function getProdutosFiscaisParaCatalogo(
  userId: string
): Promise<{ id: string; nome: string; preco: number }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('produtos_fiscais')
    .select('id, descricao, preco_venda, preco_custo')
    .eq('user_id', userId)
    .eq('ativo', true)
    .is('deleted_at', null)
    .order('descricao')
  if (error) throw error

  return ((data ?? []) as { id: string; descricao: string; preco_venda: number | null; preco_custo: number | null }[]).map(
    (p) => ({ id: p.id, nome: p.descricao, preco: p.preco_venda || p.preco_custo || 0 })
  )
}
