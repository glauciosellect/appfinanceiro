'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Printer, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { CONDICAO_LABEL, estornarEntrada, type CondicaoPagamento } from '@/lib/intro/entradas'

interface Entrada {
  id: string
  data: string
  numero_documento: string | null
  condicao_pagamento: CondicaoPagamento
  vencimento: string | null
  parcelas: number
  total_custo: number
  observacao: string | null
  status: 'ativa' | 'estornada'
  fornecedores: { nome: string } | null
}
interface Item {
  id: string
  quantidade: number
  custo_unitario: number
  preco_venda: number | null
  validade: string | null
  produtos_fiscais: { descricao: string; unidade: string } | null
}
interface Lote { id: string; qtd_inicial: number; qtd_saldo: number }
interface Parcela { id: string; numero_parcela: number; valor: number; data_vencimento: string; status: string }

export default function EntradaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [entrada, setEntrada] = useState<Entrada | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [loading, setLoading] = useState(true)
  const [estornando, setEstornando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const [e, i, l, c] = await Promise.all([
      supabase.from('entradas_mercadoria')
        .select('id, data, numero_documento, condicao_pagamento, vencimento, parcelas, total_custo, observacao, status, fornecedores(nome)')
        .eq('id', id).maybeSingle(),
      supabase.from('entradas_itens')
        .select('id, quantidade, custo_unitario, preco_venda, validade, produtos_fiscais(descricao, unidade)')
        .eq('entrada_id', id),
      supabase.from('lotes_estoque').select('id, qtd_inicial, qtd_saldo').eq('entrada_id', id),
      supabase.from('contas_pagar').select('id, parcelas_pagar(id, numero_parcela, valor, data_vencimento, status)').eq('entrada_id', id).maybeSingle(),
    ])
    setEntrada((e.data as unknown as Entrada | null) ?? null)
    setItens((i.data ?? []) as unknown as Item[])
    setLotes((l.data ?? []) as Lote[])
    const conta = c.data as unknown as { parcelas_pagar: Parcela[] } | null
    setParcelas((conta?.parcelas_pagar ?? []).sort((a, b) => a.numero_parcela - b.numero_parcela))
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  const podeEstornar = entrada?.status === 'ativa' && lotes.length > 0 && lotes.every((l) => Number(l.qtd_saldo) === Number(l.qtd_inicial))

  async function estornar() {
    if (!confirm('Estornar esta entrada? O estoque será retirado e a conta a pagar cancelada.')) return
    setEstornando(true)
    setErro('')
    const msg = await estornarEntrada(id)
    setEstornando(false)
    if (msg) { setErro(msg); return }
    carregar()
  }

  if (loading) return <p className="text-sm text-gray-500">Carregando...</p>
  if (!entrada) return <p className="text-sm text-gray-500">Entrada não encontrada.</p>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/intro/entrada" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-1">Entrada de {formatDate(entrada.data)}</h1>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
        {podeEstornar && (
          <Button variant="outline" onClick={estornar} disabled={estornando} className="text-red-600">
            <Undo2 className="h-4 w-4 mr-1" />{estornando ? 'Estornando...' : 'Estornar'}
          </Button>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {entrada.status === 'estornada' && (
        <p className="rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-2 text-sm text-gray-600">Esta entrada foi estornada: o estoque e a conta a pagar foram desfeitos.</p>
      )}
      {entrada.status === 'ativa' && !podeEstornar && (
        <p className="text-xs text-gray-500 print:hidden">Não é possível estornar: já houve venda ou ajuste de algum item desta entrada.</p>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-gray-500">Fornecedor</p><p className="font-medium text-gray-900 dark:text-white">{entrada.fornecedores?.nome ?? '—'}</p></div>
          <div><p className="text-xs text-gray-500">Condição</p><p className="font-medium text-gray-900 dark:text-white">{CONDICAO_LABEL[entrada.condicao_pagamento]}</p></div>
          <div><p className="text-xs text-gray-500">Documento</p><p className="font-medium text-gray-900 dark:text-white">{entrada.numero_documento ?? '—'}</p></div>
          <div><p className="text-xs text-gray-500">Total (custo)</p><p className="font-bold text-gray-900 dark:text-white">{formatCurrency(Number(entrada.total_custo))}</p></div>
          {entrada.observacao && <div className="col-span-full"><p className="text-xs text-gray-500">Observação</p><p>{entrada.observacao}</p></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Produtos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 text-left">Produto</th>
                  <th className="px-4 py-2 text-right">Qtd</th>
                  <th className="px-4 py-2 text-right">Custo</th>
                  <th className="px-4 py-2 text-right">Venda</th>
                  <th className="px-4 py-2 text-left">Validade</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {itens.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{it.produtos_fiscais?.descricao}</td>
                    <td className="px-4 py-2 text-right">{Number(it.quantidade)} {it.produtos_fiscais?.unidade}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(Number(it.custo_unitario))}</td>
                    <td className="px-4 py-2 text-right text-green-700">{it.preco_venda ? formatCurrency(Number(it.preco_venda)) : '—'}</td>
                    <td className="px-4 py-2">{it.validade ? formatDate(it.validade) : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Math.round(Number(it.quantidade) * Number(it.custo_unitario) * 100) / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {entrada.condicao_pagamento !== 'consignado' && parcelas.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Contas a pagar geradas</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {parcelas.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">Parcela {p.numero_parcela}</td>
                    <td className="px-4 py-2">{formatDate(p.data_vencimento)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(Number(p.valor))}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                        p.status === 'pago' ? 'bg-green-50 text-green-700' : p.status === 'cancelado' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700')}>
                        {p.status === 'pago' ? 'Pago' : p.status === 'cancelado' ? 'Cancelado' : 'Em aberto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      {entrada.condicao_pagamento === 'consignado' && (
        <p className="text-sm text-gray-500">Consignado: nenhuma conta foi gerada. O valor devido ao fornecedor cresce conforme os produtos forem vendidos.</p>
      )}
    </div>
  )
}
