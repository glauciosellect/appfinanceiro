import { createClient } from '@/lib/supabase/client'
import type { Servico, ServicoFormData } from '@/types'
import { calcularMargemLucro } from './produtos'

export async function getServicos(
  userId: string,
  filters?: { ativo?: boolean; busca?: string }
): Promise<Servico[]> {
  const supabase = createClient()
  let query = supabase
    .from('servicos')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('nome')

  if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo)
  if (filters?.busca) query = query.ilike('nome', `%${filters.busca}%`)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Servico[]
}

export async function getServicoById(userId: string, id: string): Promise<Servico | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('servicos')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as Servico
}

export async function createServico(userId: string, formData: ServicoFormData): Promise<Servico> {
  const supabase = createClient()
  const margem_lucro = calcularMargemLucro(formData.preco_custo, formData.preco_unitario)
  const { data, error } = await supabase
    .from('servicos')
    .insert({ ...formData, user_id: userId, margem_lucro, ativo: true })
    .select()
    .single()
  if (error) throw error
  return data as Servico
}

export async function updateServico(
  userId: string,
  id: string,
  formData: Partial<ServicoFormData>
): Promise<Servico> {
  const supabase = createClient()
  const payload: Partial<ServicoFormData> & { margem_lucro?: number } = { ...formData }
  if (formData.preco_custo !== undefined && formData.preco_unitario !== undefined) {
    payload.margem_lucro = calcularMargemLucro(formData.preco_custo, formData.preco_unitario)
  }
  const { data, error } = await supabase
    .from('servicos')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Servico
}

export async function deleteServico(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('servicos')
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
