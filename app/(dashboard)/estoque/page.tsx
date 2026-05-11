'use client'

export const dynamic = 'force-dynamic'

import { Package, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { produtosFiscais, movimentosDeEstoque } from '@/lib/fiscal/mock-data'

export default function EstoquePage() {
  const abaixoMinimo = produtosFiscais.filter((p) => p.estoque <= p.estoqueMinimo)
  const valorTotal = produtosFiscais.reduce((s, p) => s + p.estoque * p.precoUnitario, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle de Estoque</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Atualizado automaticamente a cada emissão de NF-e
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total de Produtos',   value: String(produtosFiscais.length),                                             sub: 'ativos no cadastro' },
          { label: 'Total em Estoque',    value: String(produtosFiscais.reduce((s, p) => s + p.estoque, 0)),                 sub: 'unidades' },
          { label: 'Abaixo do Mínimo',    value: String(abaixoMinimo.length),                                               sub: 'precisam reposição', alert: abaixoMinimo.length > 0 },
          { label: 'Valor em Estoque',    value: formatCurrency(valorTotal),                                                 sub: 'pelo preço de venda' },
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Código', 'Produto', 'Un.', 'Estoque Atual', 'Mínimo', 'Valor Unit.', 'Total', 'Situação'].map((h) => (
                    <th key={h} className={cn('px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide',
                      ['Estoque Atual','Mínimo','Valor Unit.','Total'].includes(h) ? 'text-right' : 'text-left')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {produtosFiscais.map((p) => {
                  const abaixo = p.estoque <= p.estoqueMinimo
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
                      <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{p.estoqueMinimo}</td>
                      <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(p.precoUnitario)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(p.estoque * p.precoUnitario)}</td>
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
        </CardContent>
      </Card>

      {/* Movimentações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações Recentes</CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">Entradas e saídas registradas automaticamente pelas notas fiscais</p>
        </CardHeader>
        <CardContent className="p-0">
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
                {movimentosDeEstoque.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{formatDate(m.data)}</td>
                    <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{m.produto}</td>
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
                      {m.nfReferencia && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {m.nfReferencia}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
