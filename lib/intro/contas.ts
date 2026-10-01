import { createClient } from '@/lib/supabase/client'

export type TipoConta = 'pagar' | 'receber'

export interface ParcelaLinha {
  id: string
  contaId: string
  numero: number
  total: number
  valor: number
  vencimento: string
  paga: boolean
  dataBaixa: string | null
  descricao: string
  origem: string
  pessoaId: string | null
  pessoa: string | null
}

export interface ResumoFornecedor {
  fornecedor_id: string
  nome: string
  vencido: number
  a_vencer: number
  consignado_a_acertar: number
  total: number
}

type FiltroStatus = 'abertas' | 'pagas' | 'todas'

interface LinhaCrua {
  id: string
  numero_parcela: number
  total_parcelas: number
  valor: number
  data_vencimento: string
  status: string
  data_pagamento?: string | null
  data_recebimento?: string | null
  contas_pagar?: { id: string; descricao: string; origem: string; fornecedor_id: string | null; fornecedores: { nome: string } | null }
  contas_receber?: { id: string; descricao: string; origem: string; cliente_id: string | null; clientes: { nome: string } | null }
}

export async function listarParcelas(
  tipo: TipoConta,
  userId: string,
  filtro: { status: FiltroStatus; pessoaId?: string }
): Promise<ParcelaLinha[]> {
  const supabase = createClient()
  const pagar = tipo === 'pagar'
  const tabela = pagar ? 'parcelas_pagar' : 'parcelas_receber'
  const conta = pagar ? 'contas_pagar' : 'contas_receber'
  const pessoaCol = pagar ? 'fornecedor_id' : 'cliente_id'
  const select = pagar
    ? 'id, numero_parcela, total_parcelas, valor, data_vencimento, status, data_pagamento, contas_pagar!inner(id, descricao, origem, fornecedor_id, fornecedores(nome))'
    : 'id, numero_parcela, total_parcelas, valor, data_vencimento, status, data_recebimento, contas_receber!inner(id, descricao, origem, cliente_id, clientes(nome))'
  const baixada = pagar ? 'pago' : 'recebido'

  let q = supabase.from(tabela).select(select).eq('user_id', userId).order('data_vencimento', { ascending: true })
  if (filtro.status === 'abertas') q = q.in('status', ['aberto', 'atrasado'])
  else if (filtro.status === 'pagas') q = q.eq('status', baixada)
  else q = q.in('status', ['aberto', 'atrasado', baixada])
  if (filtro.pessoaId) q = q.eq(`${conta}.${pessoaCol}`, filtro.pessoaId)

  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as LinhaCrua[]).map((r) => {
    const c = pagar ? r.contas_pagar! : r.contas_receber!
    return {
      id: r.id,
      contaId: c.id,
      numero: r.numero_parcela,
      total: r.total_parcelas,
      valor: Number(r.valor),
      vencimento: r.data_vencimento,
      paga: r.status === baixada,
      dataBaixa: (pagar ? r.data_pagamento : r.data_recebimento) ?? null,
      descricao: c.descricao,
      origem: c.origem,
      pessoaId: pagar ? (c as NonNullable<LinhaCrua['contas_pagar']>).fornecedor_id : (c as NonNullable<LinhaCrua['contas_receber']>).cliente_id,
      pessoa: pagar ? (c as NonNullable<LinhaCrua['contas_pagar']>).fornecedores?.nome ?? null : (c as NonNullable<LinhaCrua['contas_receber']>).clientes?.nome ?? null,
    }
  })
}

export async function resumoFornecedores(): Promise<ResumoFornecedor[]> {
  const { data, error } = await createClient().rpc('intro_resumo_fornecedores')
  if (error) throw error
  return ((data ?? []) as ResumoFornecedor[]).map((r) => ({
    ...r,
    vencido: Number(r.vencido), a_vencer: Number(r.a_vencer),
    consignado_a_acertar: Number(r.consignado_a_acertar), total: Number(r.total),
  }))
}

export async function criarConta(p: {
  tipo: TipoConta
  fornecedor_id?: string | null
  cliente_id?: string | null
  descricao: string
  valor: number
  vencimento: string
  parcelas: number
}): Promise<string | null> {
  const { error } = await createClient().rpc('intro_criar_conta', { p })
  return error ? error.message : null
}

export async function baixarParcela(tipo: TipoConta, id: string, data: string): Promise<string | null> {
  const { error } = await createClient().rpc('intro_baixar_parcela', { p_tipo: tipo, p_id: id, p_data: data })
  return error ? error.message : null
}

export async function cancelarConta(tipo: TipoConta, id: string): Promise<string | null> {
  const { error } = await createClient().rpc('intro_cancelar_conta', { p_tipo: tipo, p_id: id })
  return error ? error.message : null
}
