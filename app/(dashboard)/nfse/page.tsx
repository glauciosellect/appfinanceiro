'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Download, XCircle, Receipt, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { notasDeServico } from '@/lib/fiscal/mock-data'
import type { NFSe, StatusNF } from '@/lib/fiscal/types'

const statusConfig: Record<StatusNF, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho',  className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  emitida:  { label: 'Emitida',   className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'   },
  cancelada:{ label: 'Cancelada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'           },
  erro:     { label: 'Erro',      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'           },
}

export default function NFSePage() {
  const [busca, setBusca] = useState('')

  const filtradas = notasDeServico.filter(
    (n) =>
      !busca ||
      n.tomador.toLowerCase().includes(busca.toLowerCase()) ||
      n.numero.includes(busca)
  )

  const totalLiquido = notasDeServico
    .filter((n) => n.status === 'emitida')
    .reduce((s, n) => s + n.valorLiquido, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NFS-e</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Nota Fiscal de Serviços — integrado à Prefeitura de Juiz de Fora / MG
          </p>
        </div>
        <Button variant="success" asChild>
          <Link href="/nfse/nova">
            <Plus className="h-4 w-4" />
            Emitir NFS-e
          </Link>
        </Button>
      </div>

      {/* Banner integração */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-green-800 dark:text-green-300 text-sm">
            Integração ativa com a Prefeitura de Juiz de Fora / MG
          </p>
          <p className="text-green-700 dark:text-green-400 text-sm">
            Emita NFS-e diretamente pelo Syncromoney — sem acessar o portal da prefeitura.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total líquido (mês)', value: formatCurrency(totalLiquido) },
          { label: 'ISS recolhido',       value: formatCurrency(notasDeServico.filter(n=>n.status==='emitida').reduce((s,n)=>s+n.valorIss,0)) },
          { label: 'NFS-e emitidas',      value: String(notasDeServico.filter(n=>n.status==='emitida').length) },
          { label: 'Total de notas',      value: String(notasDeServico.length) },
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
            <Input placeholder="Buscar por tomador ou número..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Notas Fiscais de Serviço</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Número', 'Tomador', 'Data', 'Valor Serviços', 'ISS (2%)', 'Valor Líquido', 'Status', 'Ações'].map((h) => (
                    <th key={h} className={cn('px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide', ['Valor Serviços','ISS (2%)','Valor Líquido','Ações'].includes(h) ? 'text-right' : 'text-left')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtradas.map((nota) => (
                  <NFSeLine key={nota.id} nota={nota} />
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <Receipt className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 dark:text-gray-500">Nenhuma NFS-e encontrada</p>
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

function NFSeLine({ nota }: { nota: NFSe }) {
  const st = statusConfig[nota.status]
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-green-500 shrink-0" />
          <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">{nota.numero}</span>
        </div>
        {nota.codigoVerificacao && (
          <p className="text-xs text-gray-400 mt-0.5">CÓD: {nota.codigoVerificacao}</p>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="font-medium text-gray-800 dark:text-gray-200">{nota.tomador}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{nota.cnpjTomador}</p>
      </td>
      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatDate(nota.dataEmissao)}</td>
      <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300">{formatCurrency(nota.valorServicos)}</td>
      <td className="px-6 py-4 text-right text-red-600 dark:text-red-400">{formatCurrency(nota.valorIss)}</td>
      <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(nota.valorLiquido)}</td>
      <td className="px-6 py-4">
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', st.className)}>{st.label}</span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"><Eye className="h-4 w-4" /></button>
          {nota.status === 'emitida' && (
            <>
              <button className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"><Download className="h-4 w-4" /></button>
              <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><XCircle className="h-4 w-4" /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
