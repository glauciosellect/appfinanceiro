import { createClient } from './client'

export interface PerfilEmpresa {
  user_id: string
  // Identificação
  tipo_pessoa: 'juridica' | 'fisica'
  razao_social: string
  nome_fantasia: string
  cnpj_cpf: string
  inscricao_estadual: string
  inscricao_municipal: string
  regime_tributario: 'simples' | 'lucro_presumido' | 'lucro_real' | 'mei'
  // Endereço
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  // Contato
  telefone: string
  email_comercial: string
  site: string
  // Logo
  logo_url: string
  updated_at?: string
}

export const perfilVazio: Omit<PerfilEmpresa, 'user_id'> = {
  tipo_pessoa: 'juridica',
  razao_social: '',
  nome_fantasia: '',
  cnpj_cpf: '',
  inscricao_estadual: '',
  inscricao_municipal: '',
  regime_tributario: 'simples',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  telefone: '',
  email_comercial: '',
  site: '',
  logo_url: '',
}

export async function getPerfilEmpresa(userId: string): Promise<PerfilEmpresa | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('perfil_empresa')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as PerfilEmpresa
}

export async function upsertPerfilEmpresa(perfil: PerfilEmpresa): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('perfil_empresa')
    .upsert({ ...perfil, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return { error: error.message }
  return { error: null }
}

export async function uploadLogo(userId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient()
  const ext = file.name.split('.').pop()
  const path = `${userId}/logo.${ext}`

  const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from('logos').getPublicUrl(path)
  return { url: data.publicUrl + `?t=${Date.now()}`, error: null }
}
