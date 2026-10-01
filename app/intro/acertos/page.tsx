'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileCheck2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { listarAcertos, type AcertoLinha } from '@/lib/intro/acertos'

const STATUS: Record<string, { label: string; cls: string }> = {
  enviado: { label: 'Aguardando fornecedor', cls: 'bg-amber-50 text-amber-700' },
  recebido: { label: 'Recebido', cls: 'bg-green-50 text-green-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
}

export default function AcertosPage() {
  const [acertos, setAcertos] = useState<AcertoLinha[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return
      try { setAcertos(await listarAcertos(user.id)) } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao carregar.') }
      setLoading(false)
    }
    carregar()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acerto com fornecedor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Fechamento do que foi vendido em consignação, com recibo para o fornecedor confirmar.</p>
        </div>
        <Button asChild><Link href="/intro/acertos/novo"><Plus className="h-4 w-4 mr-1" />Novo acerto</Link></Button>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3 text-left">Nº</th><th className="px-4 py-3 text-left">Fornecedor</th><th className="px-4 py-3 text-left">Período</th>
            <th className="px-4 py-3 text-right">Vendido</th><th className="px-4 py-3 text-right">A receber</th><th className="px-4 py-3 text-left">Situação</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {acertos.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3"><Link href={`/intro/acertos/${a.id}`} className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline">{a.numero}</Link></td>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{a.fornecedores?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(a.periodo_ini)} a {formatDate(a.periodo_fim)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(Number(a.total_vendido))}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(a.total_repasse))}</td>
                <td className="px-4 py-3"><span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS[a.status].cls)}>{STATUS[a.status].label}</span></td>
              </tr>
            ))}
            {!loading && acertos.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center"><FileCheck2 className="h-10 w-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nenhum acerto feito ainda.</p></td></tr>
            )}
          </tbody>
        </table>
      </div></CardContent></Card>
    </div>
  )
}
