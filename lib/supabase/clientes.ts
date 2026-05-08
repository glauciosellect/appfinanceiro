import { createClient } from '@/lib/supabase/client'
import type { Cliente, ClienteFormData } from '@/types'

export async function getClientes(
  userId: string,
  filters?: { search?: string; tipo?: string; ativo?: boolean }
): Promise<Cliente[]> {
  const supabase = createClient()
  let query = supabase
    .from('clientes')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('nome')

  if (filters?.search) {
    query = query.or(
      `nome.ilike.%${filters.search}%,cpf_cnpj.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }
  if (filters?.tipo) query = query.eq('tipo', filters.tipo)
  if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Cliente[]
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Cliente
}

export async function createCliente(userId: string, formData: ClienteFormData): Promise<Cliente> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clientes')
    .insert({ ...formData, user_id: userId })
    .select()
    .single()
  if (error) throw error
  await registrarLog(userId, 'insert', 'clientes', data.id, null, data)
  return data as Cliente
}

export async function updateCliente(
  userId: string,
  id: string,
  formData: Partial<ClienteFormData>
): Promise<Cliente> {
  const supabase = createClient()
  const anterior = await getClienteById(id)
  const { data, error } = await supabase
    .from('clientes')
    .update(formData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  await registrarLog(userId, 'update', 'clientes', id, anterior, data)
  return data as Cliente
}

export async function deleteCliente(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const anterior = await getClienteById(id)
  const { error } = await supabase
    .from('clientes')
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
  await registrarLog(userId, 'delete', 'clientes', id, anterior, null)
}

export async function toggleAtivoCliente(
  userId: string,
  id: string,
  ativo: boolean
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('clientes')
    .update({ ativo })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

async function registrarLog(
  userId: string,
  acao: string,
  tabela: string,
  registroId: string,
  anterior: unknown,
  novo: unknown
) {
  const supabase = createClient()
  await supabase.from('logs').insert({
    user_id: userId,
    acao,
    tabela,
    registro_id: registroId,
    dados_anteriores: anterior,
    dados_novos: novo,
  })
}
