'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useState } from 'react'
import { Plus, Search, Eye, FileText, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notasFiscaisEletronicas } from '@/lib/fiscal/mock-data'

const entradas = notasFiscaisEletronicas.filter((n) => n.tipo === 'entrada')

export default function NFeEntradasPage() {
  const [busca, setBusca] = useState('')

  const filtradas = entradas.filter(
    (n) => !busca || n.numero.includes(busca) || n.naturezaOperacao.toLowerCase().includes(busca.toLowerCase())
  )

  const totalEntradas = entradas.reduce((s, n) => s + n.valorTotal, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NF-e de Entrada</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Compras de fornecedores — estoque atualizado automaticamente
          </p>
        </div>
        <Button asChild>
          <Link href="/nfe-entradas/nova"><Plus className="h-4 w-4" />Registrar Entrada</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'NF-e de Entrada no Mês', value: String(entradas.length) },
          { label: 'Total de Compras',        value: formatCurrency(totalEntradas) },
          { label: 'Fornecedores',            value: String(new Set(entradas.map(n => n.cnpjDestinatario)).size) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por número ou operação..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">Notas de Entrada</CardTitle></CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Número','Fornecedor','Data','Natureza','Valor Total','Ações'].map((h) => (
                    <th key={h} className={`px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${['Valor Total','Ações'].includes(h) ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtradas.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{n.serie}/{n.numero}</span>
                      </div>
                      {n.chaveAcesso && (
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{n.chaveAcesso.slice(0, 22)}…</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-700 dark:text-gray-300">Fornecedor Externo</p>
                      <p className="text-xs text-gray-400">CNPJ registrado na NF-e</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(n.dataEmissao)}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{n.naturezaOperacao}</td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800 dark:text-gray-200">{formatCurrency(n.valorTotal)}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center">
                    <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 dark:text-gray-500">Nenhuma entrada encontrada</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
