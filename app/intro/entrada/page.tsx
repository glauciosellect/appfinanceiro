'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PackagePlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { listarEntradas, CONDICAO_LABEL, type EntradaLinha } from '@/lib/intro/entradas'

export default function EntradasPage() {
  const [entradas, setEntradas] = useState<EntradaLinha[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return
      try {
        setEntradas(await listarEntradas(user.id))
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar as entradas.')
      }
      setLoading(false)
    }
    carregar()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Entrada de mercadoria</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Tudo que os fornecedores entregaram na loja.</p>
        </div>
        <Link href="/intro/entrada/nova">
          <Button><Plus className="h-4 w-4 mr-1" />Nova entrada</Button>
        </Link>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Condição</th>
                  <th className="px-4 py-3 text-right">Total (custo)</th>
                  <th className="px-4 py-3 text-left">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {entradas.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <Link href={`/intro/entrada/${e.id}`} className="text-emerald-700 dark:text-emerald-400 font-medium hover:underline">{formatDate(e.data)}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{e.fornecedores?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{e.numero_documento ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{CONDICAO_LABEL[e.condicao_pagamento]}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(Number(e.total_custo))}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                        e.status === 'ativa' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {e.status === 'ativa' ? 'Ativa' : 'Estornada'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && entradas.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center">
                    <PackagePlus className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400">Nenhuma entrada registrada ainda.</p>
                    <Link href="/intro/entrada/nova" className="mt-3 inline-block text-emerald-600 font-medium text-sm hover:underline">Registrar a primeira entrada</Link>
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
