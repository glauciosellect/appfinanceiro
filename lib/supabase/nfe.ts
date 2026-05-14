import { createClient } from '@/lib/supabase/client'

export interface NFeRecord {
  id: string
  user_id: string
  numero: number
  serie: string
  chave_acesso: string | null
  natureza_operacao: string
  data_emissao: string
  destinatario: string
  cnpj_destinatario: string | null
  email_destinatario: string | null
  logradouro_destinatario: string | null
  numero_destinatario: string | null
  bairro_destinatario: string | null
  municipio_destinatario: string | null
  uf_destinatario: string | null
  cep_destinatario: string | null
  valor_total: number
  status: string
  tipo: string
  danfe_url: string | null
  xml_url: string | null
  itens: unknown
  transportadora: string | null
  focus_ref: string | null
  ambiente: string
  erro_mensagem: string | null
  created_at: string
}

export interface SalvarNFeInput {
  natureza_operacao: string
  data_emissao: string
  destinatario: string
  cnpj_destinatario?: string
  email_destinatario?: string
  valor_total: number
  itens: unknown
  transportadora?: string
  danfe_url?: string
}

export async function salvarNFe(userId: string, dados: SalvarNFeInput): Promise<NFeRecord> {
  const supabase = createClient()

  // Próximo número sequencial do usuário
  const { data: maxRow } = await supabase
    .from('nfe_emitidas')
    .select('numero')
    .eq('user_id', userId)
    .order('numero', { ascending: false })
    .limit(1)
    .single()

  const proximo = maxRow ? (maxRow.numero as number) + 1 : 1

  const { data, error } = await supabase
    .from('nfe_emitidas')
    .insert({
      user_id: userId,
      numero: proximo,
      serie: '1',
      natureza_operacao: dados.natureza_operacao,
      data_emissao: dados.data_emissao,
      destinatario: dados.destinatario,
      cnpj_destinatario: dados.cnpj_destinatario ?? null,
      email_destinatario: dados.email_destinatario ?? null,
      valor_total: dados.valor_total,
      status: 'emitida',
      tipo: 'saida',
      itens: dados.itens,
      transportadora: dados.transportadora ?? null,
      danfe_url: dados.danfe_url ?? null,
      ambiente: 'homologacao',
    })
    .select()
    .single()

  if (error) throw error
  return data as NFeRecord
}

export async function getNFe(userId: string, id: string): Promise<NFeRecord | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nfe_emitidas')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .single()
  if (error) return null
  return data as NFeRecord
}

export async function listNFe(userId: string): Promise<NFeRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nfe_emitidas')
    .select('*')
    .eq('user_id', userId)
    .eq('tipo', 'saida')
    .order('numero', { ascending: false })

  if (error) throw error
  return (data ?? []) as NFeRecord[]
}
