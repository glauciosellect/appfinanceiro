'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getPedidos, getContadorPorStatus, createPedido } from '@/lib/supabase/pedidos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Pedido, StatusPedido } from '@/types'

const STATUS_CONFIG: Record<StatusPedido, { label: string; color: string; bg: string }> = {
  pendente:             { label: 'Pendente',             color: 'text-blue-700',  bg: 'bg-blue-50'  },
  aguardando_pagamento: { label: 'Aguardando Pagamento',  color: 'text-amber-700', bg: 'bg-amber-50' },
  concluido:            { label: 'Concluído',             color: 'text-green-700', bg: 'bg-green-50' },
  cancelado:            { label: 'Cancelado',             color: 'text-gray-500',  bg: 'bg-gray-50'  },
}

function StatusBadge({ status }: { status: StatusPedido }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  )
}

export default function OrcamentosPage() {
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [contador, setContador] = useState<Record<StatusPedido, number>>({
    pendente: 0, aguardando_pagamento: 0, concluido: 0, cancelado: 0,
  })
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<StatusPedido | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [userId, setUserId] = useState('')
  const { toast: _toast } = useToast()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchTudo = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [_pedidos, _contador] = await Promise.all([
        getPedidos(userId, filtroStatus !== 'todos' ? { status: filtroStatus } : undefined),
        getContadorPorStatus(userId),
      ])
      setPedidos(_pedidos)
      setContador(_contador)
    } catch {
      _toast('Erro ao carregar orçamentos', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, filtroStatus, _toast])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  async function handleNovoPedido() {
    setCriando(true)
    try {
      const novo = await createPedido(userId)
      router.push(`/orcamentos/${novo.id}`)
    } catch {
      _toast('Erro ao criar orçamento', 'error')
      setCriando(false)
    }
  }

  const buscaLower = busca.trim().toLowerCase()
  const pedidosFiltrados = buscaLower
    ? pedidos.filter(p =>
        p.numero_sequencial.toLowerCase().includes(buscaLower) ||
        (p.clientes?.nome ?? '').toLowerCase().includes(buscaLower)
      )
    : pedidos

  const totalPedidos = contador.pendente + contador.aguardando_pagamento + contador.concluido + contador.cancelado

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orçamentos</h1>
          <p className="text-sm text-gray-500">{totalPedidos} orçamento(s) cadastrado(s)</p>
        </div>
        <Button onClick={handleNovoPedido} disabled={criando}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setFiltroStatus('todos')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filtroStatus === 'todos' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Todos: {totalPedidos}
        </button>
        {(Object.keys(STATUS_CONFIG) as StatusPedido[]).map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filtroStatus === s ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {STATUS_CONFIG[s].label}: {contador[s]}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por número ou cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Lista de Orçamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum orçamento encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Número</th>
                    <th className="text-left px-4 py-3">Cliente</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Data</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pedidosFiltrados.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/orcamentos/${p.id}`)}>
                      <td className="px-6 py-4 font-medium text-gray-900">{p.numero_sequencial}</td>
                      <td className="px-4 py-4 text-gray-700">{p.clientes?.nome ?? '—'}</td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">{formatDate(p.data_pedido)}</td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900">{formatCurrency(p.total)}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <StatusBadge status={p.status} />
                          {p.aceito_em && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-green-700 bg-green-50">
                              ✓ Aceito em {formatDate(p.aceito_em)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); router.push(`/orcamentos/${p.id}`) }}>
                          Abrir
                        </Button>
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
