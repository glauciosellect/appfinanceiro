'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Printer, Download, FileText, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { listNFe, type NFeRecord } from '@/lib/supabase/nfe'

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho',  className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  emitida:  { label: 'Emitida',   className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'   },
  cancelada:{ label: 'Cancelada', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'           },
  erro:     { label: 'Erro',      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'           },
}

export default function NFePage() {
  const [notas, setNotas] = useState<NFeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      try {
        const lista = await listNFe(data.user.id)
        setNotas(lista)
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    })
  }, [])

  async function handleExcluir(id: string) {
    if (!confirm('Excluir esta NF-e do sistema? Esta ação não pode ser desfeita.')) return
    const supabase = createClient()
    await supabase.from('nfe_emitidas').delete().eq('id', id)
    setNotas(prev => prev.filter(n => n.id !== id))
  }

  const filtradas = notas.filter(
    (n) =>
      !busca ||
      n.destinatario.toLowerCase().includes(busca.toLowerCase()) ||
      String(n.numero).includes(busca) ||
      (n.cnpj_destinatario ?? '').includes(busca)
  )

  const emitidas = notas.filter((n) => n.status === 'emitida')
  const totalEmitido = emitidas.reduce((s, n) => s + n.valor_total, 0)

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
          { label: 'Total emitido',  value: formatCurrency(totalEmitido), sub: `${emitidas.length} notas` },
          { label: 'Rascunhos',      value: String(notas.filter(n => n.status === 'rascunho').length), sub: 'aguardando emissão' },
          { label: 'Canceladas',     value: String(notas.filter(n => n.status === 'cancelada').length), sub: 'notas canceladas' },
          { label: 'Total de notas', value: String(notas.length), sub: 'no período' },
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
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">Carregando…</div>
          ) : (
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
                    <NFeLine key={nota.id} nota={nota} onExcluir={handleExcluir} />
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NFeLine({ nota, onExcluir }: { nota: NFeRecord; onExcluir: (id: string) => void }) {
  const st = statusConfig[nota.status] ?? { label: nota.status, className: 'bg-gray-100 text-gray-700' }
  const numeroFmt = `${nota.serie}/${String(nota.numero).padStart(6, '0')}`
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
            {numeroFmt}
          </span>
        </div>
        {nota.chave_acesso && (
          <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[160px]">
            {nota.chave_acesso.slice(0, 22)}…
          </p>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="font-medium text-gray-800 dark:text-gray-200">{nota.destinatario}</p>
        {nota.cnpj_destinatario && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{nota.cnpj_destinatario}</p>
        )}
      </td>
      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
        {formatDate(nota.data_emissao)}
      </td>
      <td className="px-6 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">
        {formatCurrency(nota.valor_total)}
      </td>
      <td className="px-6 py-4">
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', st.className)}>
          {st.label}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/nfe/${nota.id}`}
            title="Visualizar / Imprimir"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-flex"
          >
            <Printer className="h-4 w-4" />
          </Link>
          {nota.danfe_url && (
            <button
              title="Baixar DANFE"
              onClick={() => window.open(nota.danfe_url!, '_blank')}
              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {nota.xml_url && (
            <button
              title="Baixar XML"
              onClick={async () => {
                const filename = `nfe_${nota.numero || nota.id}.xml`
                const res = await fetch(`/api/fiscal/download-xml?url=${encodeURIComponent(nota.xml_url!)}&filename=${filename}`)
                const blob = await res.blob()
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = filename
                link.click()
                URL.revokeObjectURL(link.href)
              }}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
          <Link
            href={`/nfe/nova?reenviar=${nota.id}`}
            title="Editar / Reenviar"
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors inline-flex"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            title="Excluir"
            onClick={() => onExcluir(nota.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
