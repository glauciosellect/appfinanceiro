'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Package, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

interface Produto {
  id: string
  codigo: string
  descricao: string
  ncm: string
  unidade: string
  preco_unitario: number
  estoque: number
  estoque_minimo: number
}

interface Movimento {
  id: string
  data: string
  produto_nome: string
  produto_codigo: string
  tipo: 'entrada' | 'saida'
  quantidade: number
  motivo: string
  nf_referencia?: string
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/estoque')
      .then((r) => r.json())
      .then(({ produtos, movimentos }) => {
        setProdutos(produtos ?? [])
        setMovimentos(movimentos ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const abaixoMinimo = produtos.filter((p) => p.estoque <= p.estoque_minimo)
  const valorTotal = produtos.reduce((s, p) => s + p.estoque * p.preco_unitario, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400 text-sm">
        Carregando estoque...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle de Estoque</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Atualizado automaticamente a cada importação de NF-e
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Produtos',   value: String(produtos.length),                                              sub: 'ativos no cadastro' },
          { label: 'Total em Estoque',    value: String(produtos.reduce((s, p) => s + p.estoque, 0)),                  sub: 'unidades' },
          { label: 'Abaixo do Mínimo',    value: String(abaixoMinimo.length),                                          sub: 'precisam reposição', alert: abaixoMinimo.length > 0 },
          { label: 'Valor em Estoque',    value: formatCurrency(valorTotal),                                            sub: 'pelo preço de compra' },
        ].map(({ label, value, sub, alert }) => (
          <Card key={label} className={cn(alert && 'border-yellow-300 dark:border-yellow-700')}>
            <CardContent className="pt-6">
              <p className={cn('text-sm mb-1', alert ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400')}>{label}</p>
              <p className={cn('text-2xl font-bold', alert ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-900 dark:text-white')}>{value}</p>
              {alert && value !== '0' ? (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Atenção necessária
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Posição de estoque */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posição de Estoque</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {produtos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="font-medium text-gray-500 dark:text-gray-400">Nenhum produto no estoque</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Importe uma NF-e de entrada para adicionar produtos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    {['Código', 'Produto', 'Un.', 'Estoque Atual', 'Mínimo', 'Valor Unit.', 'Total', 'Situação'].map((h) => (
                      <th key={h} className={cn('px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide',
                        ['Estoque Atual', 'Mínimo', 'Valor Unit.', 'Total'].includes(h) ? 'text-right' : 'text-left')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {produtos.map((p) => {
                    const abaixo = p.estoque <= p.estoque_minimo
                    return (
                      <tr key={p.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors', abaixo && 'bg-yellow-50/50 dark:bg-yellow-900/10')}>
                        <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{p.codigo}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800 dark:text-gray-200">{p.descricao}</p>
                          <p className="text-xs text-gray-400">NCM: {p.ncm}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{p.unidade}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={cn('text-lg font-bold', abaixo ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-800 dark:text-gray-200')}>{p.estoque}</span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{p.estoque_minimo}</td>
                        <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(p.preco_unitario)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(p.estoque * p.preco_unitario)}</td>
                        <td className="px-6 py-4">
                          {abaixo ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              <AlertTriangle className="h-3 w-3" />Baixo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações Recentes</CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">Entradas e saídas registradas pelas notas fiscais</p>
        </CardHeader>
        <CardContent className="p-0">
          {movimentos.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              Nenhuma movimentação registrada ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    {['Data', 'Produto', 'Tipo', 'Qtd', 'Motivo', 'NF Referência'].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {movimentos.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{formatDate(m.data)}</td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{m.produto_nome}</p>
                        <p className="text-xs text-gray-400 font-mono">{m.produto_codigo}</p>
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn('flex items-center gap-1.5 text-sm font-medium w-fit', m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600')}>
                          {m.tipo === 'entrada' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                          {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-semibold text-gray-800 dark:text-gray-200">
                        {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{m.motivo}</td>
                      <td className="px-6 py-3">
                        {m.nf_referencia && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {m.nf_referencia}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
