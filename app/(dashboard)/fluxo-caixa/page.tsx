'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getContasCorrentes, getSaldoTotal } from '@/lib/supabase/contas-correntes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeftRight, TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ContaCorrente, FluxoCaixaItem } from '@/types'

function getMonthRange(offset = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: start.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
  }
}

export default function FluxoCaixaPage() {
  const [visao, setVisao] = useState<'mes' | 'trimestre' | 'ano' | 'custom'>('mes')
  const [mesOffset, setMesOffset] = useState(0)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [contaFiltro, setContaFiltro] = useState('todas')
  const [contas, setContas] = useState<ContaCorrente[]>([])
  const [fluxo, setFluxo] = useState<FluxoCaixaItem[]>([])
  const [saldoTotal, setSaldoTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchContas = useCallback(async () => {
    if (!userId) return
    const [_contas, _saldo] = await Promise.all([
      getContasCorrentes(userId),
      getSaldoTotal(userId),
    ])
    setContas(_contas)
    setSaldoTotal(_saldo)
  }, [userId])

  useEffect(() => { fetchContas() }, [fetchContas])

  const fetchFluxo = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const supabase = createClient()
      let dateFrom: string, dateTo: string

      if (visao === 'mes') {
        const range = getMonthRange(mesOffset)
        dateFrom = range.start
        dateTo = range.end
      } else if (visao === 'trimestre') {
        const start = new Date()
        start.setMonth(start.getMonth() - 2, 1)
        const end = new Date()
        end.setMonth(end.getMonth() + 1, 0)
        dateFrom = start.toISOString().split('T')[0]
        dateTo = end.toISOString().split('T')[0]
      } else if (visao === 'ano') {
        const y = new Date().getFullYear()
        dateFrom = `${y}-01-01`
        dateTo = `${y}-12-31`
      } else {
        dateFrom = customStart
        dateTo = customEnd
      }

      if (!dateFrom || !dateTo) { setLoading(false); return }

      let query = supabase
        .from('movimentacoes_conta')
        .select('*, contas_correntes(nome_apelido)')
        .eq('user_id', userId)
        .gte('data_movimentacao', dateFrom)
        .lte('data_movimentacao', dateTo)
        .order('data_movimentacao', { ascending: true })

      if (contaFiltro !== 'todas') query = query.eq('conta_corrente_id', contaFiltro)

      const { data: movsData } = await query

      // Parcelas futuras (projetadas)
      const [parcelasReceber, parcelasPagar] = await Promise.all([
        supabase
          .from('parcelas_receber')
          .select('valor, data_vencimento, contas_receber(descricao, clientes(nome))')
          .eq('user_id', userId)
          .in('status', ['aberto', 'atrasado'])
          .gte('data_vencimento', dateFrom)
          .lte('data_vencimento', dateTo),
        supabase
          .from('parcelas_pagar')
          .select('valor, data_vencimento, contas_pagar(descricao, fornecedores(nome))')
          .eq('user_id', userId)
          .in('status', ['aberto', 'atrasado'])
          .gte('data_vencimento', dateFrom)
          .lte('data_vencimento', dateTo),
      ])

      const itens: FluxoCaixaItem[] = []

      for (const m of movsData ?? []) {
        const isCredito = m.tipo === 'credito' || m.tipo === 'transferencia_entrada'
        itens.push({
          data: m.data_movimentacao,
          descricao: m.descricao,
          conta_nome: m.contas_correntes?.nome_apelido ?? '',
          entrada: isCredito ? m.valor : 0,
          saida: !isCredito ? m.valor : 0,
          saldo: m.saldo_posterior,
          realizado: true,
        })
      }

      for (const p of parcelasReceber.data ?? []) {
        const cr = (p.contas_receber as unknown) as { descricao?: string; clientes?: { nome?: string } } | null
        const clienteNome = cr?.clientes?.nome ?? ''
        itens.push({
          data: p.data_vencimento,
          descricao: `${clienteNome} — ${cr?.descricao ?? ''}`,
          conta_nome: '',
          entrada: p.valor,
          saida: 0,
          saldo: 0,
          realizado: false,
        })
      }

      for (const p of parcelasPagar.data ?? []) {
        const cp = (p.contas_pagar as unknown) as { descricao?: string; fornecedores?: { nome?: string } } | null
        const fornNome = cp?.fornecedores?.nome ?? ''
        itens.push({
          data: p.data_vencimento,
          descricao: `${fornNome} — ${cp?.descricao ?? ''}`,
          conta_nome: '',
          entrada: 0,
          saida: p.valor,
          saldo: 0,
          realizado: false,
        })
      }

      itens.sort((a, b) => a.data.localeCompare(b.data))
      setFluxo(itens)
    } finally {
      setLoading(false)
    }
  }, [userId, visao, mesOffset, contaFiltro, customStart, customEnd])

  useEffect(() => { fetchFluxo() }, [fetchFluxo])

  const totalEntradas = fluxo.filter(i => i.realizado).reduce((s, i) => s + i.entrada, 0)
  const totalSaidas = fluxo.filter(i => i.realizado).reduce((s, i) => s + i.saida, 0)
  const totalEntradasProj = fluxo.filter(i => !i.realizado).reduce((s, i) => s + i.entrada, 0)
  const totalSaidasProj = fluxo.filter(i => !i.realizado).reduce((s, i) => s + i.saida, 0)

  // Agrupar por dia para o gráfico
  const graficoDados = Object.values(
    fluxo.reduce<Record<string, { data: string; entradas: number; saidas: number }>>((acc, item) => {
      const d = item.data
      if (!acc[d]) acc[d] = { data: formatDate(d), entradas: 0, saidas: 0 }
      acc[d].entradas += item.entrada
      acc[d].saidas += item.saida
      return acc
    }, {})
  )

  const hoje = new Date().toISOString().split('T')[0]
  const { label: mesLabel } = getMonthRange(mesOffset)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fluxo de Caixa</h1>
          <p className="text-sm text-gray-500 capitalize">{visao === 'mes' ? mesLabel : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Radio de visão */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
            {([
              ['mes', 'Mês'],
              ['trimestre', 'Trimestre'],
              ['ano', 'Ano'],
              ['custom', 'Período'],
            ] as const).map(([v, l]) => (
              <button key={v} onClick={() => setVisao(v)}
                className={`px-3 py-2 font-medium transition-colors ${visao === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Navegação de mês */}
          {visao === 'mes' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setMesOffset(o => o - 1)}
                className="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">‹</button>
              <button onClick={() => setMesOffset(0)}
                className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">Hoje</button>
              <button onClick={() => setMesOffset(o => o + 1)}
                className="px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">›</button>
            </div>
          )}

          {/* Período customizado */}
          {visao === 'custom' && (
            <div className="flex gap-2 items-center">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-36" />
              <span className="text-gray-400">até</span>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-36" />
            </div>
          )}

          {/* Filtro de conta */}
          <Select value={contaFiltro} onValueChange={setContaFiltro}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {contas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_apelido}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl"><DollarSign className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-xs text-gray-500">Saldo Atual</p><p className="font-bold text-gray-900">{formatCurrency(saldoTotal)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-xl"><TrendingUp className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-xs text-gray-500">Entradas (real)</p><p className="font-bold text-green-600">{formatCurrency(totalEntradas)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-xl"><TrendingDown className="h-5 w-5 text-red-600" /></div>
              <div><p className="text-xs text-gray-500">Saídas (real)</p><p className="font-bold text-red-600">{formatCurrency(totalSaidas)}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl"><Calendar className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Projetado</p>
                <p className={`font-bold ${totalEntradasProj - totalSaidasProj >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalEntradasProj - totalSaidasProj)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      {graficoDados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-600" />
              Entradas x Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={graficoDados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4,4,0,0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4,4,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Extrato Detalhado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : fluxo.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma movimentação no período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left px-6 py-3">Data</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Conta</th>
                    <th className="text-right px-4 py-3">Entradas</th>
                    <th className="text-right px-4 py-3">Saídas</th>
                    <th className="text-center px-4 py-3">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fluxo.map((item, idx) => {
                    const isHoje = item.data === hoje
                    return (
                      <tr key={idx} className={`hover:bg-gray-50 ${!item.realizado ? 'italic text-gray-400' : ''} ${isHoje ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-6 py-3 whitespace-nowrap">{formatDate(item.data)}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{item.descricao}</td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{item.conta_nome || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">
                          {item.entrada > 0 ? formatCurrency(item.entrada) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-red-600">
                          {item.saida > 0 ? formatCurrency(item.saida) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item.realizado ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.realizado ? 'Realizado' : 'Projetado'}
                          </span>
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
    </div>
  )
}
