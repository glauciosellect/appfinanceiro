import { createClient } from '@/lib/supabase/client'

export type TipoColuna = 'texto' | 'moeda' | 'numero' | 'data'

export interface Coluna {
  key: string
  label: string
  tipo: TipoColuna
  somar?: boolean
}

export interface DefinicaoRelatorio {
  id: string
  titulo: string
  descricao: string
  periodo: 'intervalo' | 'ate' | 'nenhum'
  colunas: Coluna[]
}

// Cada relatório é calculado no banco (intro_relatorio); aqui só ficam as colunas.
export const RELATORIOS: DefinicaoRelatorio[] = [
  {
    id: 'vendas_periodo', titulo: 'Vendas do período', periodo: 'intervalo',
    descricao: 'Cada venda concluída, com cliente e formas de pagamento.',
    colunas: [
      { key: 'numero', label: 'Venda', tipo: 'texto' },
      { key: 'data', label: 'Data e hora', tipo: 'texto' },
      { key: 'cliente', label: 'Cliente', tipo: 'texto' },
      { key: 'formas', label: 'Pagamento', tipo: 'texto' },
      { key: 'total', label: 'Total', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'vendas_forma', titulo: 'Vendas por forma de pagamento', periodo: 'intervalo',
    descricao: 'Quanto entrou por Pix, crédito, débito, dinheiro e fiado.',
    colunas: [
      { key: 'forma', label: 'Forma de pagamento', tipo: 'texto' },
      { key: 'lancamentos', label: 'Lançamentos', tipo: 'numero', somar: true },
      { key: 'total', label: 'Total', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'vendas_produto', titulo: 'Vendas por produto', periodo: 'intervalo',
    descricao: 'Quantidade, valor vendido, custo e lucro bruto de cada produto.',
    colunas: [
      { key: 'produto', label: 'Produto', tipo: 'texto' },
      { key: 'quantidade', label: 'Qtd', tipo: 'numero', somar: true },
      { key: 'vendido', label: 'Vendido', tipo: 'moeda', somar: true },
      { key: 'custo', label: 'Custo', tipo: 'moeda', somar: true },
      { key: 'lucro', label: 'Lucro bruto', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'vendas_fornecedor', titulo: 'Vendas por fornecedor', periodo: 'intervalo',
    descricao: 'O que cada fornecedor vendeu na sua loja (próprio e consignado), com custo e lucro.',
    colunas: [
      { key: 'fornecedor', label: 'Fornecedor', tipo: 'texto' },
      { key: 'quantidade', label: 'Qtd', tipo: 'numero', somar: true },
      { key: 'vendido', label: 'Vendido', tipo: 'moeda', somar: true },
      { key: 'custo', label: 'Custo', tipo: 'moeda', somar: true },
      { key: 'lucro', label: 'Lucro bruto', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'movimentacao_financeira', titulo: 'Movimentação financeira (entradas e saídas)', periodo: 'intervalo',
    descricao: 'Tudo o que entrou e saiu no período: vendas recebidas, contas recebidas (inclui fiado) e contas pagas. Venda fiado só aparece quando for recebida.',
    colunas: [
      { key: 'data', label: 'Data', tipo: 'data' },
      { key: 'tipo', label: 'Tipo', tipo: 'texto' },
      { key: 'historico', label: 'Histórico', tipo: 'texto' },
      { key: 'pessoa', label: 'Cliente / Fornecedor', tipo: 'texto' },
      { key: 'entrada', label: 'Entrada', tipo: 'moeda', somar: true },
      { key: 'saida', label: 'Saída', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'contas_pagas', titulo: 'Contas pagas', periodo: 'intervalo',
    descricao: 'Contas a pagar baixadas no período (pagamentos a fornecedores e outras despesas).',
    colunas: [
      { key: 'pago_em', label: 'Pago em', tipo: 'data' },
      { key: 'vencimento', label: 'Vencimento', tipo: 'data' },
      { key: 'fornecedor', label: 'Fornecedor', tipo: 'texto' },
      { key: 'descricao', label: 'Descrição', tipo: 'texto' },
      { key: 'origem', label: 'Origem', tipo: 'texto' },
      { key: 'valor', label: 'Valor pago', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'contas_recebidas', titulo: 'Contas recebidas', periodo: 'intervalo',
    descricao: 'Contas a receber baixadas no período (fiado recebido e outros recebimentos).',
    colunas: [
      { key: 'recebido_em', label: 'Recebido em', tipo: 'data' },
      { key: 'vencimento', label: 'Vencimento', tipo: 'data' },
      { key: 'cliente', label: 'Cliente', tipo: 'texto' },
      { key: 'descricao', label: 'Descrição', tipo: 'texto' },
      { key: 'origem', label: 'Origem', tipo: 'texto' },
      { key: 'valor', label: 'Valor recebido', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'estoque_fornecedor', titulo: 'Estoque por fornecedor', periodo: 'nenhum',
    descricao: 'Posição atual do estoque de cada fornecedor.',
    colunas: [
      { key: 'fornecedor', label: 'Fornecedor', tipo: 'texto' },
      { key: 'unidades', label: 'Unidades', tipo: 'numero', somar: true },
      { key: 'consignado', label: 'Consignado', tipo: 'numero', somar: true },
      { key: 'valor_custo', label: 'Valor a custo', tipo: 'moeda', somar: true },
      { key: 'valor_venda', label: 'Valor de venda', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'validade', titulo: 'Validade dos produtos', periodo: 'ate',
    descricao: 'Lotes em estoque que vencem até a data escolhida (inclui os já vencidos).',
    colunas: [
      { key: 'produto', label: 'Produto', tipo: 'texto' },
      { key: 'fornecedor', label: 'Fornecedor', tipo: 'texto' },
      { key: 'validade', label: 'Validade', tipo: 'data' },
      { key: 'saldo', label: 'Saldo', tipo: 'numero', somar: true },
      { key: 'tipo', label: 'Tipo', tipo: 'texto' },
      { key: 'dias', label: 'Dias p/ vencer', tipo: 'numero' },
    ],
  },
  {
    id: 'caixa_fechamentos', titulo: 'Fechamentos de caixa', periodo: 'intervalo',
    descricao: 'Conferência de cada caixa fechado: esperado, contado e diferença.',
    colunas: [
      { key: 'abertura', label: 'Abertura', tipo: 'texto' },
      { key: 'fechamento', label: 'Fechamento', tipo: 'texto' },
      { key: 'operador', label: 'Operador', tipo: 'texto' },
      { key: 'troco_inicial', label: 'Troco inicial', tipo: 'moeda' },
      { key: 'esperado', label: 'Esperado', tipo: 'moeda', somar: true },
      { key: 'contado', label: 'Contado', tipo: 'moeda', somar: true },
      { key: 'diferenca', label: 'Diferença', tipo: 'moeda', somar: true },
    ],
  },
  {
    id: 'acertos', titulo: 'Acertos com fornecedores', periodo: 'intervalo',
    descricao: 'Acertos de consignação emitidos e se o fornecedor já confirmou o recebimento.',
    colunas: [
      { key: 'numero', label: 'Nº', tipo: 'numero' },
      { key: 'fornecedor', label: 'Fornecedor', tipo: 'texto' },
      { key: 'periodo', label: 'Período', tipo: 'texto' },
      { key: 'vendido', label: 'Vendido', tipo: 'moeda', somar: true },
      { key: 'a_receber', label: 'A receber', tipo: 'moeda', somar: true },
      { key: 'situacao', label: 'Situação', tipo: 'texto' },
    ],
  },
]

export type LinhaRelatorio = Record<string, string | number | null>

export async function executarRelatorio(tipo: string, ini: string, fim: string): Promise<{ linhas: LinhaRelatorio[]; erro: string | null }> {
  const { data, error } = await createClient().rpc('intro_relatorio', { p_tipo: tipo, p_ini: ini, p_fim: fim })
  if (error) return { linhas: [], erro: error.message }
  return { linhas: (data ?? []) as LinhaRelatorio[], erro: null }
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export function formatarCelula(valor: string | number | null | undefined, tipo: TipoColuna): string {
  if (valor === null || valor === undefined || valor === '') return tipo === 'texto' || tipo === 'data' ? '' : '—'
  if (tipo === 'moeda') return brl.format(Number(valor))
  if (tipo === 'numero') return numero.format(Number(valor))
  if (tipo === 'data') return new Date(String(valor) + 'T00:00:00').toLocaleDateString('pt-BR')
  return String(valor)
}

export function totais(colunas: Coluna[], linhas: LinhaRelatorio[]): Record<string, number> {
  const t: Record<string, number> = {}
  for (const c of colunas) {
    if (c.somar) t[c.key] = linhas.reduce((s, l) => s + (Number(l[c.key]) || 0), 0)
  }
  return t
}

// CSV para Excel brasileiro: separador ";", números com vírgula e BOM UTF-8.
export function baixarCsv(nomeArquivo: string, def: DefinicaoRelatorio, linhas: LinhaRelatorio[]): void {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const num = (v: string | number | null, tipo: TipoColuna) => {
    if (v === null || v === undefined || v === '') return ''
    if (tipo === 'moeda' || tipo === 'numero') return String(Number(v)).replace('.', ',')
    if (tipo === 'data') return new Date(String(v) + 'T00:00:00').toLocaleDateString('pt-BR')
    return String(v)
  }
  const linhasCsv = [
    def.colunas.map((c) => esc(c.label)).join(';'),
    ...linhas.map((l) => def.colunas.map((c) => esc(num(l[c.key], c.tipo))).join(';')),
  ]
  const blob = new Blob(['﻿' + linhasCsv.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeArquivo}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export interface DashboardDados {
  hoje_total: number
  hoje_qtd: number
  semana_total: number
  mes_total: number
  mes_qtd: number
  vendas_7d: { data: string; total: number }[]
  por_forma_hoje: { forma: string; total: number }[]
  caixa_aberto: boolean
  a_pagar_vencido: number
  a_pagar_7d: number
  a_receber_vencido: number
  a_receber_7d: number
  consignado_a_acertar: { fornecedor_id: string; nome: string; valor: number }[]
  lotes_vencidos: number
  lotes_vencendo: number
  dias_alerta: number
  estoque_baixo: number
  mais_vendidos: { produto: string; quantidade: number; total: number }[]
}

export async function carregarDashboard(): Promise<{ dados: DashboardDados | null; erro: string | null }> {
  const { data, error } = await createClient().rpc('intro_dashboard')
  if (error) return { dados: null, erro: error.message }
  return { dados: data as DashboardDados, erro: null }
}
