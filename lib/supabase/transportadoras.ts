import { createClient } from './client'
import type { Transportadora, TransportadoraFormData } from '@/types'

export async function getTransportadoras(
  userId: string,
  search?: string
): Promise<Transportadora[]> {
  const supabase = createClient()
  let query = supabase
    .from('transportadoras')
    .select('*')
    .eq('user_id', userId)
    .eq('ativo', true)
    .order('razao_social')

  if (search) {
    query = query.or(
      `razao_social.ilike.%${search}%,nome_fantasia.ilike.%${search}%,cnpj.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Transportadora[]
}

export async function createTransportadora(
  userId: string,
  formData: TransportadoraFormData
): Promise<Transportadora> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transportadoras')
    .insert({ ...formData, user_id: userId, ativo: true })
    .select()
    .single()
  if (error) throw error
  return data as Transportadora
}

export async function updateTransportadora(
  userId: string,
  id: string,
  formData: Partial<TransportadoraFormData>
): Promise<Transportadora> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('transportadoras')
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Transportadora
}

export async function deleteTransportadora(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('transportadoras')
    .update({ ativo: false })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}
