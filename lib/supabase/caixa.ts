import { createClient } from '@/lib/supabase/client'
import type { CaixaSessao, CaixaMovimentacao, TipoMovimentacaoCaixa, Venda } from '@/types'

// Sessão aberta do usuário. Como este MVP é single-terminal (um caixa por
// vez), "já existe sessão aberta hoje" na prática é só "existe alguma sessão
// com status='aberto'" — não importa em qual dia ela foi aberta, porque só
// pode existir uma sessão aberta por vez (o fechamento é obrigatório antes de
// abrir outra). Não há filtro de data aqui de propósito.
export async function getSessaoAbertaHoje(userId: string): Promise<CaixaSessao | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('caixa_sessoes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'aberto')
    .order('aberto_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as CaixaSessao) ?? null
}

export async function abrirCaixa(
  userId: string,
  operador: string,
  fundoTrocoInicial: number,
  contaCorrenteId?: string
): Promise<CaixaSessao> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('caixa_sessoes')
    .insert({
      user_id: userId,
      operador,
      fundo_troco_inicial: fundoTrocoInicial,
      status: 'aberto',
      ...(contaCorrenteId ? { conta_corrente_id: contaCorrenteId } : {}),
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CaixaSessao
}

export async function registrarMovimentacaoCaixa(
  userId: string,
  caixaSessaoId: string,
  tipo: TipoMovimentacaoCaixa,
  valor: number,
  motivo: string
): Promise<CaixaMovimentacao> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('caixa_movimentacoes')
    .insert({
      user_id: userId,
      caixa_sessao_id: caixaSessaoId,
      tipo,
      valor,
      motivo,
      criado_por: userId,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CaixaMovimentacao
}

export async function getMovimentacoesCaixa(
  userId: string,
  caixaSessaoId: string
): Promise<CaixaMovimentacao[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('caixa_movimentacoes')
    .select('*')
    .eq('user_id', userId)
    .eq('caixa_sessao_id', caixaSessaoId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return (data ?? []) as CaixaMovimentacao[]
}

// Linha crua de vendas_pagamentos + o tipo da forma de pagamento vinda do
// join, usada só internamente para decidir o que conta como "em dinheiro".
type PagamentoComTipo = {
  valor: number
  forma_pagamento_id: string | null
  forma_pagamento_nome: string
  formas_pagamento: { tipo: string } | null
}

// Critério de "é dinheiro": preferimos o join formas_pagamento.tipo via
// forma_pagamento_id (fonte mais confiável, pois `tipo` é um enum
// controlado). O PDV sempre grava forma_pagamento_id, então esse caminho
// cobre o caso normal. Como forma_pagamento_id é nullable no tipo
// VendaPagamento (pagamentos legados/importados poderiam não ter o vínculo),
// mantemos um fallback defensivo comparando forma_pagamento_nome === 'Dinheiro'
// (valor de seed conhecido) para não perder essas linhas do cálculo.
function ehPagamentoEmDinheiro(p: PagamentoComTipo): boolean {
  if (p.forma_pagamento_id && p.formas_pagamento) {
    return p.formas_pagamento.tipo === 'dinheiro'
  }
  return p.forma_pagamento_nome === 'Dinheiro'
}

async function somarVendasEmDinheiro(userId: string, caixaSessaoId: string): Promise<number> {
  const supabase = createClient()
  const { data: vendas, error: errVendas } = await supabase
    .from('vendas')
    .select('id')
    .eq('user_id', userId)
    .eq('caixa_sessao_id', caixaSessaoId)
    .eq('status', 'concluida')
  if (errVendas) throw errVendas

  const vendaIds = (vendas ?? []).map((v: { id: string }) => v.id)
  if (vendaIds.length === 0) return 0

  const { data: pagamentos, error: errPagamentos } = await supabase
    .from('vendas_pagamentos')
    .select('valor, forma_pagamento_id, forma_pagamento_nome, formas_pagamento(tipo)')
    .in('venda_id', vendaIds)
  if (errPagamentos) throw errPagamentos

  return ((pagamentos ?? []) as unknown as PagamentoComTipo[])
    .filter(ehPagamentoEmDinheiro)
    .reduce((s, p) => s + p.valor, 0)
}

async function somarMovimentacoes(
  userId: string,
  caixaSessaoId: string,
  tipo: TipoMovimentacaoCaixa
): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('caixa_movimentacoes')
    .select('valor')
    .eq('user_id', userId)
    .eq('caixa_sessao_id', caixaSessaoId)
    .eq('tipo', tipo)
  if (error) throw error
  return ((data ?? []) as { valor: number }[]).reduce((s, m) => s + m.valor, 0)
}

export async function calcularSaldoEsperado(userId: string, caixaSessaoId: string): Promise<number> {
  const supabase = createClient()
  const { data: sessao, error: errSessao } = await supabase
    .from('caixa_sessoes')
    .select('fundo_troco_inicial')
    .eq('id', caixaSessaoId)
    .eq('user_id', userId)
    .single()
  if (errSessao) throw errSessao

  const [vendasDinheiro, suprimentos, sangrias] = await Promise.all([
    somarVendasEmDinheiro(userId, caixaSessaoId),
    somarMovimentacoes(userId, caixaSessaoId, 'suprimento'),
    somarMovimentacoes(userId, caixaSessaoId, 'sangria'),
  ])

  const fundoTrocoInicial = (sessao as { fundo_troco_inicial: number }).fundo_troco_inicial
  return fundoTrocoInicial + vendasDinheiro + suprimentos - sangrias
}

export async function fecharCaixa(
  userId: string,
  caixaSessaoId: string,
  saldoContado: number
): Promise<CaixaSessao> {
  const supabase = createClient()
  const saldoEsperado = await calcularSaldoEsperado(userId, caixaSessaoId)
  const diferenca = saldoContado - saldoEsperado

  const { data, error } = await supabase
    .from('caixa_sessoes')
    .update({
      status: 'fechado',
      fechado_em: new Date().toISOString(),
      saldo_esperado: saldoEsperado,
      saldo_contado: saldoContado,
      diferenca,
    })
    .eq('id', caixaSessaoId)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as CaixaSessao
}

export async function getRelatorioFechamento(
  userId: string,
  caixaSessaoId: string
): Promise<{
  sessao: CaixaSessao
  vendasPorFormaPagamento: { forma_pagamento_nome: string; total: number; quantidade: number }[]
  totalSangrias: number
  totalSuprimentos: number
  saldoEsperado: number
}> {
  const supabase = createClient()

  const { data: sessao, error: errSessao } = await supabase
    .from('caixa_sessoes')
    .select('*')
    .eq('id', caixaSessaoId)
    .eq('user_id', userId)
    .single()
  if (errSessao) throw errSessao

  const { data: vendas, error: errVendas } = await supabase
    .from('vendas')
    .select('id')
    .eq('user_id', userId)
    .eq('caixa_sessao_id', caixaSessaoId)
    .eq('status', 'concluida')
  if (errVendas) throw errVendas

  const vendaIds = (vendas ?? []).map((v: { id: string }) => v.id)

  let vendasPorFormaPagamento: { forma_pagamento_nome: string; total: number; quantidade: number }[] = []
  if (vendaIds.length > 0) {
    const { data: pagamentos, error: errPagamentos } = await supabase
      .from('vendas_pagamentos')
      .select('forma_pagamento_nome, valor')
      .in('venda_id', vendaIds)
    if (errPagamentos) throw errPagamentos

    const agrupado = new Map<string, { total: number; quantidade: number }>()
    for (const p of (pagamentos ?? []) as { forma_pagamento_nome: string; valor: number }[]) {
      const atual = agrupado.get(p.forma_pagamento_nome) ?? { total: 0, quantidade: 0 }
      atual.total += p.valor
      atual.quantidade += 1
      agrupado.set(p.forma_pagamento_nome, atual)
    }
    vendasPorFormaPagamento = Array.from(agrupado.entries()).map(([forma_pagamento_nome, v]) => ({
      forma_pagamento_nome,
      total: v.total,
      quantidade: v.quantidade,
    }))
  }

  const [totalSangrias, totalSuprimentos, saldoEsperado] = await Promise.all([
    somarMovimentacoes(userId, caixaSessaoId, 'sangria'),
    somarMovimentacoes(userId, caixaSessaoId, 'suprimento'),
    calcularSaldoEsperado(userId, caixaSessaoId),
  ])

  return {
    sessao: sessao as CaixaSessao,
    vendasPorFormaPagamento,
    totalSangrias,
    totalSuprimentos,
    saldoEsperado,
  }
}

// Vendas concluídas na sessão de caixa ATUALMENTE ABERTA (não confundir com
// getRelatorioFechamento, que só é chamado após o fechamento). Usado para
// exibir, ao vivo, a lista de vendas já feitas na sessão em andamento — tanto
// em /caixa quanto em /pdv, que compartilham o mesmo bloco "Caixa Aberto".
export async function getVendasDaSessao(
  userId: string,
  caixaSessaoId: string
): Promise<(Venda & { itensCount: number })[]> {
  const supabase = createClient()

  const { data: vendas, error: errVendas } = await supabase
    .from('vendas')
    .select('*, clientes(id, nome)')
    .eq('user_id', userId)
    .eq('caixa_sessao_id', caixaSessaoId)
    .eq('status', 'concluida')
    .order('created_at', { ascending: false })
  if (errVendas) throw errVendas

  const vendaIds = ((vendas ?? []) as Venda[]).map((v) => v.id)
  if (vendaIds.length === 0) return []

  const { data: itens, error: errItens } = await supabase
    .from('vendas_itens')
    .select('venda_id')
    .in('venda_id', vendaIds)
  if (errItens) throw errItens

  const contagemPorVenda = new Map<string, number>()
  for (const item of (itens ?? []) as { venda_id: string }[]) {
    contagemPorVenda.set(item.venda_id, (contagemPorVenda.get(item.venda_id) ?? 0) + 1)
  }

  return ((vendas ?? []) as Venda[]).map((v) => ({
    ...v,
    itensCount: contagemPorVenda.get(v.id) ?? 0,
  }))
}

export async function getSessaoPorId(userId: string, caixaSessaoId: string): Promise<CaixaSessao | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('caixa_sessoes')
    .select('*')
    .eq('id', caixaSessaoId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as CaixaSessao) ?? null
}

export async function getHistoricoSessoes(userId: string): Promise<CaixaSessao[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('caixa_sessoes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'fechado')
    .order('fechado_em', { ascending: false })
  if (error) throw error
  return (data ?? []) as CaixaSessao[]
}
