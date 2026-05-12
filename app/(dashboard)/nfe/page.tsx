'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus, Search, Filter, Eye, Download, Send, XCircle, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { notasFiscaisEletronicas } from '@/lib/fiscal/mock-data'
import type { NFe, StatusNF } from '@/lib/fiscal/types'

const statusConfig: Record<StatusNF, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho',  className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  emitida:  { label: 'Emitida',   className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'   },
  cancelada:{ label: 'Cancelada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'           },
  erro:     { label: 'Erro',      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'           },
}

const notas = notasFiscaisEletronicas.filter((n) => n.tipo === 'saida')

export default function NFePage() {
  const [busca, setBusca] = useState('')

  const filtradas = notas.filter(
    (n) =>
      !busca ||
      n.destinatario.toLowerCase().includes(busca.toLowerCase()) ||
      n.numero.includes(busca) ||
      n.cnpjDestinatario.includes(busca)
  )

  const totalEmitido = notas
    .filter((n) => n.status === 'emitida')
    .reduce((s, n) => s + n.valorTotal, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NF-e</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Nota Fiscal Eletrônica — integrado à SEFAZ / Receita Federal
          </p>
        </div>
        <Button asChild>
          <Link href="/nfe/nova">
            <Plus className="h-4 w-4" />
            Emitir NF-e
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total emitido (mês)', value: formatCurrency(totalEmitido), sub: `${notas.filter(n => n.status === 'emitida').length} notas` },
          { label: 'Rascunhos',           value: String(notas.filter(n => n.status === 'rascunho').length), sub: 'aguardando emissão' },
          { label: 'Canceladas',          value: String(notas.filter(n => n.status === 'cancelada').length), sub: 'este mês' },
          { label: 'Total de notas',      value: String(notas.length), sub: 'no período' },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por destinatário, número ou CNPJ..."
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Notas Fiscais Eletrônicas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Número', 'Destinatário', 'Data', 'Valor Total', 'Status', 'Ações'].map((h) => (
                    <th key={h} className={cn(
                      'px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide',
                      h === 'Valor Total' || h === 'Ações' ? 'text-right' : 'text-left'
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtradas.map((nota) => (
                  <NFeLine key={nota.id} nota={nota} />
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 dark:text-gray-500">Nenhuma NF-e encontrada</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function NFeLine({ nota }: { nota: NFe }) {
  const st = statusConfig[nota.status]
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
            {nota.serie}/{nota.numero}
          </span>
        </div>
        {nota.chaveAcesso && (
          <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[160px]">
            {nota.chaveAcesso.slice(0, 22)}…
          </p>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="font-medium text-gray-800 dark:text-gray-200">{nota.destinatario}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{nota.cnpjDestinatario}</p>
      </td>
      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
        {formatDate(nota.dataEmissao)}
      </td>
      <td className="px-6 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">
        {formatCurrency(nota.valorTotal)}
      </td>
      <td className="px-6 py-4">
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', st.className)}>
          {st.label}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/nfe/${nota.id}`} title="Visualizar" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-flex">
            <Eye className="h-4 w-4" />
          </Link>
          {nota.status === 'rascunho' && (
            <button title="Transmitir para SEFAZ" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
              <Send className="h-4 w-4" />
            </button>
          )}
          {nota.status === 'emitida' && (
            <>
              <button title="Baixar DANFE" className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors">
                <Download className="h-4 w-4" />
              </button>
              <button title="Cancelar" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
