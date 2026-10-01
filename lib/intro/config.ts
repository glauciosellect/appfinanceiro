import { createClient } from '@/lib/supabase/client'

export interface IntroConfig {
  user_id: string
  nome_loja: string
  cnpj_cpf: string
  telefone: string
  endereco: string
  logo_url: string
  texto_recibo: string
  margem_padrao: number
  dias_alerta_validade: number
}

export const TEXTO_RECIBO_PADRAO =
  'Declaro ter recebido o valor e/ou as mercadorias acima discriminados, dando plena quitação.'

export function configPadrao(userId: string): IntroConfig {
  return {
    user_id: userId,
    nome_loja: '',
    cnpj_cpf: '',
    telefone: '',
    endereco: '',
    logo_url: '',
    texto_recibo: TEXTO_RECIBO_PADRAO,
    margem_padrao: 30,
    dias_alerta_validade: 15,
  }
}

export async function getIntroConfig(userId: string): Promise<IntroConfig> {
  const { data } = await createClient()
    .from('intro_config')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as IntroConfig | null) ?? configPadrao(userId)
}

export async function salvarIntroConfig(cfg: IntroConfig): Promise<string | null> {
  const { error } = await createClient()
    .from('intro_config')
    .upsert({ ...cfg, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return error ? error.message : null
}
