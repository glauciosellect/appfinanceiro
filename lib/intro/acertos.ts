import { createClient } from '@/lib/supabase/client'

export type AcaoSobra = 'manter' | 'devolver' | 'trocar'

export interface PreviaItem {
  produto_id: string
  produto: string
  custo_unitario: number
  quantidade: number
  total_vendido: number
  valor_repasse: number
}

export interface PreviaSobra {
  lote_id: string
  produto_id: string
  produto: string
  controla_validade: boolean
  quantidade: number
  validade: string | null
  custo_unitario: number
}

export interface Previa {
  itens: PreviaItem[]
  sobras: PreviaSobra[]
  total_vendido: number
  total_repasse: number
  primeira_venda_pendente: string | null
}

export interface SobraEscolha {
  lote_id: string
  acao: AcaoSobra
  quantidade: number
  nova_validade: string | null
}

export async function previaAcerto(fornecedorId: string, ini: string, fim: string): Promise<{ previa: Previa | null; erro: string | null }> {
  const { data, error } = await createClient().rpc('intro_previa_acerto', { p_fornecedor: fornecedorId, p_ini: ini, p_fim: fim })
  if (error) return { previa: null, erro: error.message }
  const d = data as Previa
  return {
    previa: {
      ...d,
      total_vendido: Number(d.total_vendido),
      total_repasse: Number(d.total_repasse),
      itens: d.itens.map((i) => ({ ...i, quantidade: Number(i.quantidade), custo_unitario: Number(i.custo_unitario), total_vendido: Number(i.total_vendido), valor_repasse: Number(i.valor_repasse) })),
      sobras: d.sobras.map((s) => ({ ...s, quantidade: Number(s.quantidade), custo_unitario: Number(s.custo_unitario) })),
    },
    erro: null,
  }
}

export async function fecharAcerto(p: {
  fornecedor_id: string
  ini: string
  fim: string
  sobras: SobraEscolha[]
}): Promise<{ id: string | null; erro: string | null }> {
  const { data, error } = await createClient().rpc('intro_fechar_acerto', { p })
  if (error) return { id: null, erro: error.message }
  return { id: (data as { id: string }).id, erro: null }
}

// Caminho da tela "Novo acerto" já preenchida com o fornecedor e o período de um acerto
// (usado em "Editar": o acerto enviado é cancelado e refeito).
export function urlRefazerAcerto(fornecedorId: string, ini: string, fim: string): string {
  return `/intro/acertos/novo?fornecedor=${fornecedorId}&ini=${ini}&fim=${fim}`
}

export const AVISO_EDITAR_ACERTO =
  'Um acerto já enviado não pode ser alterado: para editar, ele será CANCELADO e você fará um novo com o mesmo fornecedor e período. O link que você já enviou deixa de valer. Continuar?'

export async function cancelarAcerto(id: string): Promise<string | null> {
  const { error } = await createClient().rpc('intro_cancelar_acerto', { p_id: id })
  return error ? error.message : null
}

export interface SnapshotAcerto {
  numero: number
  emitido_em: string
  periodo: { ini: string; fim: string }
  loja: { nome: string; cnpj_cpf: string; telefone: string; endereco: string; logo_url: string }
  fornecedor: { nome: string; cpf_cnpj: string; telefone: string }
  itens: { produto: string; quantidade: number; custo_unitario: number; total_vendido?: number; valor_repasse: number }[]
  sobras: { produto: string; quantidade: number; validade: string | null; acao: AcaoSobra; nova_validade: string | null }[]
  // só existe no registro do lojista; a página pública do fornecedor não recebe esse valor
  total_vendido?: number
  total_repasse: number
  texto_recibo: string
}

export interface ReciboDados {
  status: 'enviado' | 'recebido' | 'cancelado'
  numero: number
  snapshot: SnapshotAcerto
  hash: string | null
  enviado_em: string
  recebido_em: string | null
  recebido_nome: string | null
  recebido_documento: string | null
}

export interface AcertoLinha {
  id: string
  fornecedor_id: string
  numero: number
  periodo_ini: string
  periodo_fim: string
  total_vendido: number
  total_repasse: number
  status: 'enviado' | 'recebido' | 'cancelado'
  token_publico: string
  recebido_em: string | null
  fornecedores: { nome: string } | null
}

export async function listarAcertos(userId: string): Promise<AcertoLinha[]> {
  const { data, error } = await createClient()
    .from('acertos_fornecedor')
    .select('id, fornecedor_id, numero, periodo_ini, periodo_fim, total_vendido, total_repasse, status, token_publico, recebido_em, fornecedores(nome)')
    .eq('user_id', userId)
    .order('numero', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AcertoLinha[]
}

export async function getAcerto(userId: string, id: string): Promise<(ReciboDados & { token_publico: string; id: string }) | null> {
  const { data, error } = await createClient()
    .from('acertos_fornecedor')
    .select('id, status, numero, snapshot, hash_sha256, enviado_em, recebido_em, recebido_nome, recebido_documento, token_publico')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  const d = data as unknown as ReciboDados & { hash_sha256: string | null; token_publico: string; id: string }
  return { ...d, hash: d.hash_sha256 }
}

// Leitura pública (fornecedor, sem login): a RPC devolve só a linha do token.
export async function getReciboPublico(token: string): Promise<ReciboDados | null> {
  const { data, error } = await createClient().rpc('intro_recibo_publico', { p_token: token })
  if (error || !data) return null
  return data as ReciboDados
}

export function linkRecibo(token: string): string {
  return `${window.location.origin}/recibo/${token}`
}

const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
const dataBR = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')

// Mensagem enviada ao fornecedor pela tela de compartilhamento do aparelho.
export function mensagemAcerto(s: SnapshotAcerto, link: string): string {
  return [
    `Olá, ${s.fornecedor.nome}! Segue o acerto nº ${s.numero} da ${s.loja.nome || 'loja'}`,
    `Período: ${dataBR(s.periodo.ini)} a ${dataBR(s.periodo.fim)}`,
    `Valor a receber: ${brl(s.total_repasse)}`,
    '',
    'Confira os produtos e confirme o recebimento (RECEBIDO) pelo link:',
    link,
  ].join('\n')
}
