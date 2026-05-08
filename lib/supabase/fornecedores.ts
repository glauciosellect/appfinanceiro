import { createClient } from '@/lib/supabase/client'
import type { Fornecedor, FornecedorFormData } from '@/types'

export async function getFornecedores(
  userId: string,
  filters?: { search?: string; tipo?: string; categoria?: string; ativo?: boolean }
): Promise<Fornecedor[]> {
  const supabase = createClient()
  let query = supabase
    .from('fornecedores')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('nome')

  if (filters?.search) {
    query = query.or(
      `nome.ilike.%${filters.search}%,cpf_cnpj.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    )
  }
  if (filters?.tipo)      query = query.eq('tipo', filters.tipo)
  if (filters?.categoria) query = query.eq('categoria', filters.categoria)
  if (filters?.ativo !== undefined) query = query.eq('ativo', filters.ativo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Fornecedor[]
}

export async function getFornecedorById(id: string): Promise<Fornecedor | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as Fornecedor
}

export async function createFornecedor(
  userId: string,
  formData: FornecedorFormData
): Promise<Fornecedor> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fornecedores')
    .insert({ ...formData, user_id: userId })
    .select()
    .single()
  if (error) throw error
  await registrarLog(userId, 'insert', 'fornecedores', data.id, null, data)
  return data as Fornecedor
}

export async function updateFornecedor(
  userId: string,
  id: string,
  formData: Partial<FornecedorFormData>
): Promise<Fornecedor> {
  const supabase = createClient()
  const anterior = await getFornecedorById(id)
  const { data, error } = await supabase
    .from('fornecedores')
    .update(formData)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  await registrarLog(userId, 'update', 'fornecedores', id, anterior, data)
  return data as Fornecedor
}

export async function deleteFornecedor(userId: string, id: string): Promise<void> {
  const supabase = createClient()
  const anterior = await getFornecedorById(id)
  const { error } = await supabase
    .from('fornecedores')
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
  await registrarLog(userId, 'delete', 'fornecedores', id, anterior, null)
}

export async function toggleAtivoFornecedor(
  userId: string,
  id: string,
  ativo: boolean
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('fornecedores')
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
