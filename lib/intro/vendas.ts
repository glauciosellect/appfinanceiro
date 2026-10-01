import { createClient } from '@/lib/supabase/client'

export type FormaPagamentoIntro = 'Dinheiro' | 'Pix' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Fiado'

export const FORMAS_PAGAMENTO: FormaPagamentoIntro[] = [
  'Dinheiro', 'Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Fiado',
]

export interface ItemVendaPayload {
  produto_id: string
  quantidade: number
  preco_unitario: number
  desconto_item: number
}

export interface PagamentoPayload {
  forma: FormaPagamentoIntro
  valor: number
  troco: number
  parcelas?: number | null
}

export interface VendaPayload {
  venda_id?: string | null
  modo: 'concluir' | 'espera'
  identificador?: string
  cliente_id?: string | null
  desconto: number
  vencimento_fiado?: string | null
  itens: ItemVendaPayload[]
  pagamentos?: PagamentoPayload[]
}

export interface ResultadoVenda {
  venda_id: string
  numero: string
  total: number
  // produtos vendidos sem saldo em estoque (o saldo fica negativo até a próxima entrada)
  sem_estoque?: { produto: string; quantidade: number }[]
}

// Mensagens de RAISE EXCEPTION do banco chegam em error.message, já em português.
export async function salvarVenda(payload: VendaPayload): Promise<{ resultado: ResultadoVenda | null; erro: string | null }> {
  const { data, error } = await createClient().rpc('intro_salvar_venda', { p: payload })
  if (error) return { resultado: null, erro: error.message }
  return { resultado: data as ResultadoVenda, erro: null }
}

export async function cancelarVendaIntro(vendaId: string, motivo: string): Promise<string | null> {
  const { error } = await createClient().rpc('intro_cancelar_venda', { p_id: vendaId, p_motivo: motivo })
  return error ? error.message : null
}

export interface VendaEmEspera {
  id: string
  numero_sequencial: string
  identificador_espera: string | null
  total: number
  desconto: number
  cliente_id: string | null
  vendas_itens: { produto_id: string; nome_produto: string; quantidade: number; preco_unitario: number; desconto_item: number }[]
}

export async function listarVendasEmEspera(userId: string): Promise<VendaEmEspera[]> {
  const { data, error } = await createClient()
    .from('vendas')
    .select('id, numero_sequencial, identificador_espera, total, desconto, cliente_id, vendas_itens(produto_id, nome_produto, quantidade, preco_unitario, desconto_item)')
    .eq('user_id', userId)
    .eq('status', 'em_espera')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VendaEmEspera[]
}

export async function excluirVendaEmEspera(userId: string, vendaId: string): Promise<string | null> {
  const { error } = await createClient()
    .from('vendas')
    .delete()
    .eq('id', vendaId)
    .eq('user_id', userId)
    .eq('status', 'em_espera')
  return error ? error.message : null
}

export interface VendaDoDia {
  id: string
  numero_sequencial: string
  created_at: string
  total: number
  clientes: { nome: string } | null
  vendas_itens: { nome_produto: string; quantidade: number; preco_unitario: number; desconto_item: number; subtotal: number }[]
  vendas_pagamentos: { forma_pagamento_nome: string; valor: number; troco: number }[]
}

// Vendas concluídas na sessão de caixa informada (para reenviar comprovante ou cancelar).
export async function listarVendasDaSessao(userId: string, sessaoId: string): Promise<VendaDoDia[]> {
  const { data, error } = await createClient()
    .from('vendas')
    .select('id, numero_sequencial, created_at, total, clientes(nome), vendas_itens(nome_produto, quantidade, preco_unitario, desconto_item, subtotal), vendas_pagamentos(forma_pagamento_nome, valor, troco)')
    .eq('user_id', userId)
    .eq('caixa_sessao_id', sessaoId)
    .eq('status', 'concluida')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as VendaDoDia[]
}

const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

// Texto do comprovante de venda (NÃO FISCAL) para compartilhar.
export function textoComprovante(
  loja: { nome_loja: string; cnpj_cpf: string; telefone: string },
  venda: Pick<VendaDoDia, 'numero_sequencial' | 'created_at' | 'total' | 'vendas_itens' | 'vendas_pagamentos'>
): string {
  const linhas = [
    loja.nome_loja || 'Comprovante de venda',
    loja.cnpj_cpf ? `CNPJ/CPF: ${loja.cnpj_cpf}` : '',
    loja.telefone ? `Tel.: ${loja.telefone}` : '',
    '',
    `Venda Nº ${venda.numero_sequencial} - ${new Date(venda.created_at).toLocaleString('pt-BR')}`,
    '',
    ...venda.vendas_itens.map((i) => `${Number(i.quantidade)}x ${i.nome_produto}  ${brl(Number(i.subtotal))}`),
    '',
    `TOTAL: ${brl(Number(venda.total))}`,
    ...venda.vendas_pagamentos.map((p) => `${p.forma_pagamento_nome}: ${brl(Number(p.valor))}${Number(p.troco) > 0 ? ` (troco ${brl(Number(p.troco))})` : ''}`),
    '',
    'Comprovante sem valor fiscal.',
  ]
  return linhas.filter((l, i, arr) => !(l === '' && arr[i - 1] === '') ).join('\n').trim()
}

// Compartilha pela tela padrão do aparelho; se indisponível, copia para a área de transferência.
export async function compartilharTexto(titulo: string, texto: string): Promise<'compartilhado' | 'copiado' | 'falhou'> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ title: titulo, text: texto })
      return 'compartilhado'
    }
    await navigator.clipboard.writeText(texto)
    return 'copiado'
  } catch (e) {
    // Usuário fechou a tela de compartilhamento: não é erro.
    if (e instanceof DOMException && e.name === 'AbortError') return 'compartilhado'
    return 'falhou'
  }
}
