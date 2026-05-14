'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingDown, CheckCircle, AlertCircle, Clock, DollarSign, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getContasPagar,
  getParcelasPagar,
  createContaPagar,
  updateContaPagar,
  cancelarContaPagar,
  excluirContaPagar,
  registrarPagamento,
  getResumoPagar,
  atualizarParcelasAtrasadasPagar,
} from '@/lib/supabase/contas-pagar'
import { getFornecedores } from '@/lib/supabase/fornecedores'
import { getContasCorrentes } from '@/lib/supabase/contas-correntes'
import { getCartoes } from '@/lib/supabase/cartoes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ContaPagar, ParcelaPagar, Fornecedor, ContaCorrente, Cartao } from '@/types'

const schemaContaPagar = z.object({
  fornecedor_id: z.string().optional(),
  descricao: z.string().min(3, 'Mínimo 3 caracteres'),
  valor_total: z.number().positive('Valor inválido'),
  num_parcelas: z.number().int().min(1).max(60),
  juros_percentual: z.number().min(0),
  desconto_valor: z.number().min(0),
  data_primeira_parcela: z.string().min(1, 'Informe a data'),
  conta_corrente_id: z.string().optional(),
  cartao_id: z.string().optional(),
  observacoes: z.string().optional(),
})
type ContaPagarForm = z.infer<typeof schemaContaPagar>

const schemaEditarPagar = z.object({
  fornecedor_id: z.string().optional(),
  descricao: z.string().min(3, 'Mínimo 3 caracteres'),
  observacoes: z.string().optional(),
  conta_corrente_id: z.string().optional(),
  cartao_id: z.string().optional(),
})
type EditarPagarForm = z.infer<typeof schemaEditarPagar>

const schemaPagar = z.object({
  valor_pago: z.number().positive('Valor inválido'),
  juros: z.number().min(0),
  multa: z.number().min(0),
  desconto: z.number().min(0),
  forma_pagamento: z.enum(['conta', 'cartao']),
  conta_corrente_id: z.string().optional(),
  cartao_id: z.string().optional(),
  data_pagamento: z.string().min(1, 'Informe a data'),
  observacoes: z.string().optional(),
})
type PagarForm = z.infer<typeof schemaPagar>

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  aberto:   { label: 'Aberto',   color: 'text-blue-700',  bg: 'bg-blue-50'  },
  pago:     { label: 'Pago',     color: 'text-green-700', bg: 'bg-green-50' },
  atrasado: { label: 'Atrasado', color: 'text-red-700',   bg: 'bg-red-50'   },
  cancelado:{ label: 'Cancelado',color: 'text-gray-500',  bg: 'bg-gray-50'  },
  parcial:  { label: 'Parcial',  color: 'text-amber-700', bg: 'bg-amber-50' },
  quitado:  { label: 'Quitado',  color: 'text-green-700', bg: 'bg-green-50' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['aberto']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.label}
    </span>
  )
}

export default function ContasPagarPage() {
  const [aba, setAba] = useState<'contas' | 'parcelas'>('parcelas')
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [parcelas, setParcelas] = useState<(ParcelaPagar & { fornecedor_nome?: string; conta_descricao?: string })[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [contasCorrente, setContasCorrente] = useState<ContaCorrente[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [resumo, setResumo] = useState({ totalAberto: 0, totalAtrasado: 0, totalPagoMes: 0, qtdVenceHoje: 0 })
  const [loading, setLoading] = useState(true)
  const [dialogNova, setDialogNova] = useState(false)
  const [contaEditando, setContaEditando] = useState<ContaPagar | null>(null)
  const [parcelaSelecionada, setParcelaSelecionada] = useState<ParcelaPagar | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [userId, setUserId] = useState('')
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'total'>('mes')
  const { toast: _toast } = useToast()

  const formNova = useForm<ContaPagarForm>({
    resolver: zodResolver(schemaContaPagar),
    defaultValues: { num_parcelas: 1, juros_percentual: 0, desconto_valor: 0 },
  })
  const formEditar = useForm<EditarPagarForm>({ resolver: zodResolver(schemaEditarPagar) })

  const formPagar = useForm<PagarForm>({
    resolver: zodResolver(schemaPagar),
    defaultValues: { data_pagamento: new Date().toISOString().split('T')[0], juros: 0, multa: 0, desconto: 0, forma_pagamento: 'conta' },
  })

  const valorTotal = formNova.watch('valor_total') || 0
  const numParcelas = formNova.watch('num_parcelas') || 1
  const juros = formNova.watch('juros_percentual') || 0
  const totalComJuros = valorTotal * (1 + juros / 100)
  const valorParcela = numParcelas > 0 ? totalComJuros / numParcelas : 0

  const formaPagamento = formPagar.watch('forma_pagamento')

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchTudo = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      await atualizarParcelasAtrasadasPagar(userId)
      const [_contas, _parcelas, _forn, _contas_cc, _cartoes, _resumo] = await Promise.all([
        getContasPagar(userId, filtroStatus !== 'todos' ? { status: filtroStatus } : undefined),
        getParcelasPagar(userId, filtroStatus !== 'todos' ? { status: filtroStatus } : undefined),
        getFornecedores(userId, { ativo: true }),
        getContasCorrentes(userId),
        getCartoes(userId),
        getResumoPagar(userId),
      ])
      setContas(_contas)
      setParcelas(_parcelas)
      setFornecedores(_forn)
      setContasCorrente(_contas_cc)
      setCartoes(_cartoes)
      setResumo(_resumo)
    } catch {
      _toast('Erro ao carregar dados', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, filtroStatus, _toast])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  async function handleCriarConta(values: ContaPagarForm) {
    try {
      await createContaPagar(userId, {
        ...values,
        categoria_id: undefined,
        centro_custo_id: undefined,
        forma_pagamento_id: undefined,
        multa_percentual: 0,
      })
      _toast('Conta a pagar criada!', 'success')
      setDialogNova(false)
      formNova.reset({ num_parcelas: 1, juros_percentual: 0, desconto_valor: 0 })
      fetchTudo()
    } catch {
      _toast('Erro ao criar conta', 'error')
    }
  }

  function abrirEdicao(c: ContaPagar) {
    setContaEditando(c)
    formEditar.reset({
      fornecedor_id: c.fornecedor_id ?? '',
      descricao: c.descricao,
      observacoes: c.observacoes ?? '',
      conta_corrente_id: c.conta_corrente_id ?? '',
      cartao_id: c.cartao_id ?? '',
    })
  }

  async function handleEditarConta(values: EditarPagarForm) {
    if (!contaEditando) return
    try {
      await updateContaPagar(userId, contaEditando.id, {
        fornecedor_id: values.fornecedor_id || undefined,
        descricao: values.descricao,
        observacoes: values.observacoes || undefined,
        conta_corrente_id: values.conta_corrente_id || undefined,
        cartao_id: values.cartao_id || undefined,
      })
      _toast('Conta atualizada!', 'success')
      setContaEditando(null)
      fetchTudo()
    } catch {
      _toast('Erro ao atualizar conta', 'error')
    }
  }

  async function handleRegistrarPagamento(values: PagarForm) {
    if (!parcelaSelecionada) return
    try {
      await registrarPagamento(userId, parcelaSelecionada.id, {
        valor_pago: values.valor_pago,
        juros: values.juros,
        multa: values.multa,
        desconto: values.desconto,
        conta_corrente_id: values.forma_pagamento === 'conta' ? values.conta_corrente_id : undefined,
        cartao_id: values.forma_pagamento === 'cartao' ? values.cartao_id : undefined,
        data_pagamento: values.data_pagamento,
        observacoes: values.observacoes,
      })
      _toast('Pagamento registrado!', 'success')
      setParcelaSelecionada(null)
      fetchTudo()
    } catch {
      _toast('Erro ao registrar pagamento', 'error')
    }
  }

  // ── Filtro de período ────────────────────────────────────────────────────
  const periodoLabels: Record<string, string> = { hoje: 'Hoje', semana: 'Semana', mes: 'Mês', total: 'Total' }
  function calcRange() {
    const d = (dt: Date) => dt.toISOString().split('T')[0]
    const hoje = new Date()
    if (periodo === 'hoje') { const s = d(hoje); return { ini: s, fim: s } }
    if (periodo === 'semana') {
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - hoje.getDay())
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
      return { ini: d(ini), fim: d(fim) }
    }
    if (periodo === 'mes') {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      return { ini: d(ini), fim: d(fim) }
    }
    return null
  }
  const range = calcRange()
  const parcelasPeriodo = range
    ? parcelas.filter(p => p.data_vencimento >= range.ini && p.data_vencimento <= range.fim)
    : parcelas
  const kpiAberto   = parcelasPeriodo.filter(p => p.status === 'aberto' || p.status === 'atrasado').reduce((s, p) => s + p.valor, 0)
  const kpiAtrasado = parcelasPeriodo.filter(p => p.status === 'atrasado').reduce((s, p) => s + p.valor, 0)
  const kpiPago     = parcelasPeriodo.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const kpiVence    = parcelasPeriodo.filter(p => p.status === 'aberto' || p.status === 'atrasado').length

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
          <p className="text-sm text-gray-500">Gestão de pagamentos e despesas</p>
        </div>
        <Button onClick={() => setDialogNova(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />
          Nova Conta a Pagar
        </Button>
      </div>

      {/* Filtro de período */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(['hoje', 'semana', 'mes', 'total'] as const).map((p) => (
          <button key={p} onClick={() => setPeriodo(p)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              periodo === p
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {periodoLabels[p]}
          </button>
        ))}
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-xl"><DollarSign className="h-5 w-5 text-blue-600" /></div><div><p className="text-xs text-gray-500">Em Aberto</p><p className="font-bold text-gray-900">{formatCurrency(kpiAberto)}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 bg-red-50 rounded-xl"><AlertCircle className="h-5 w-5 text-red-600" /></div><div><p className="text-xs text-gray-500">Atrasado</p><p className="font-bold text-red-600">{formatCurrency(kpiAtrasado)}</p></div></div></CardContent></Card>
        <Card className="cursor-pointer hover:ring-2 hover:ring-green-400 transition-all" onClick={() => setFiltroStatus(filtroStatus === 'pago' ? 'todos' : 'pago')}><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 bg-green-50 rounded-xl"><CheckCircle className="h-5 w-5 text-green-600" /></div><div><p className="text-xs text-gray-500">Pago ({periodoLabels[periodo].toLowerCase()}){filtroStatus === 'pago' ? ' ✓' : ''}</p><p className="font-bold text-green-600">{formatCurrency(kpiPago)}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 bg-amber-50 rounded-xl"><Clock className="h-5 w-5 text-amber-600" /></div><div><p className="text-xs text-gray-500">A vencer ({periodoLabels[periodo].toLowerCase()})</p><p className="font-bold text-amber-600">{kpiVence} parcelas</p></div></div></CardContent></Card>
      </div>

      {/* Abas + Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {(['parcelas', 'contas'] as const).map((tab) => (
            <button key={tab} onClick={() => setAba(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${aba === tab ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {tab === 'parcelas' ? 'Parcelas' : 'Contas'}
            </button>
          ))}
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            {aba === 'parcelas' ? 'Parcelas a Pagar' : 'Contas a Pagar'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : aba === 'parcelas' ? (
            parcelasPeriodo.length === 0 ? (
              <div className="py-16 text-center text-gray-400"><TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="font-medium">Nenhuma parcela em {periodoLabels[periodo].toLowerCase()}</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left px-6 py-3">Fornecedor</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Descrição</th>
                    <th className="text-center px-4 py-3">Parcela</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-right px-4 py-3">Valor</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">Ação</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {parcelasPeriodo.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">{p.fornecedor_nome ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.conta_descricao ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{p.numero_parcela}/{p.total_parcelas}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(p.data_vencimento)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(p.valor)}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(p.status === 'aberto' || p.status === 'atrasado') && (
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => { setParcelaSelecionada(p); formPagar.setValue('valor_pago', p.valor) }}>
                                Pagar
                              </Button>
                            )}
                            <button
                              title="Excluir nota completa"
                              onClick={() => {
                                if (confirm('EXCLUIR permanentemente esta conta e todas as suas parcelas? Esta ação não pode ser desfeita.')) {
                                  excluirContaPagar(userId, p.conta_pagar_id).then(() => { _toast('Conta excluída', 'success'); fetchTudo() })
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            contas.length === 0 ? (
              <div className="py-16 text-center text-gray-400"><TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="font-medium">Nenhuma conta encontrada</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="text-left px-6 py-3">Fornecedor</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-center px-4 py-3">Parcelas</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">Ação</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {contas.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">{c.fornecedores?.nome ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{c.descricao}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(c.valor_total)}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{c.num_parcelas}x</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {c.status !== 'cancelado' && c.status !== 'quitado' && (
                              <button onClick={() => abrirEdicao(c)}
                                className="text-xs text-blue-500 hover:underline">Editar</button>
                            )}
                            {(c.status === 'aberto' || c.status === 'atrasado' || c.status === 'parcial') && (
                              <button onClick={() => cancelarContaPagar(userId, c.id).then(() => { _toast('Cancelado', 'success'); fetchTudo() })}
                                className="text-xs text-amber-600 hover:underline">Cancelar</button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('EXCLUIR permanentemente esta conta e todas as suas parcelas? Esta ação não pode ser desfeita.')) {
                                  excluirContaPagar(userId, c.id).then(() => { _toast('Conta excluída', 'success'); fetchTudo() })
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir permanentemente">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Dialog: Nova Conta a Pagar */}
      <Dialog open={dialogNova} onOpenChange={setDialogNova}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
          <form onSubmit={formNova.handleSubmit(handleCriarConta)} className="space-y-4">
            <div>
              <Label>Fornecedor (opcional)</Label>
              <Select value={formNova.watch('fornecedor_id') ?? ''} onValueChange={(v) => formNova.setValue('fornecedor_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor..." /></SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input {...formNova.register('descricao')} placeholder="Descrição do pagamento" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor Total (R$)</Label><Input {...formNova.register('valor_total', { valueAsNumber: true })} type="number" step="0.01" min="0.01" placeholder="0,00" /></div>
              <div><Label>Nº de Parcelas</Label><Input {...formNova.register('num_parcelas', { valueAsNumber: true })} type="number" min="1" max="60" /></div>
              <div><Label>Juros (%)</Label><Input {...formNova.register('juros_percentual', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" /></div>
              <div><Label>Data da 1ª Parcela</Label><Input {...formNova.register('data_primeira_parcela')} type="date" /></div>
            </div>
            {valorTotal > 0 && numParcelas > 0 && (
              <div className="bg-red-50 rounded-xl p-3 text-sm">
                <span className="text-red-700 font-medium">{numParcelas}x de {formatCurrency(valorParcela)}</span>
              </div>
            )}
            <div>
              <Label>Conta para Débito</Label>
              <Select
                value={formNova.watch('conta_corrente_id') ?? formNova.watch('cartao_id') ?? ''}
                onValueChange={(v) => {
                  const isCartao = cartoes.some(c => c.id === v)
                  if (isCartao) {
                    formNova.setValue('cartao_id', v)
                    formNova.setValue('conta_corrente_id', undefined)
                  } else {
                    formNova.setValue('conta_corrente_id', v)
                    formNova.setValue('cartao_id', undefined)
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contasCorrente.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_apelido}</SelectItem>)}
                  {cartoes.map((c) => <SelectItem key={c.id} value={c.id}>💳 {c.banco} ****{c.final_cartao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogNova(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700">Criar Conta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Conta a Pagar */}
      <Dialog open={!!contaEditando} onOpenChange={(o) => !o && setContaEditando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Conta a Pagar</DialogTitle></DialogHeader>
          {contaEditando && (
            <div className="mb-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-500">
              Total: <strong className="text-gray-900">{formatCurrency(contaEditando.valor_total)}</strong>
              {' · '}{contaEditando.num_parcelas}x
              {' · '}Vence em <strong className="text-gray-900">{formatDate(contaEditando.data_primeira_parcela)}</strong>
              <p className="text-xs mt-1 text-amber-600">Valor, parcelas e datas só podem ser alterados cancelando e recriando.</p>
            </div>
          )}
          <form onSubmit={formEditar.handleSubmit(handleEditarConta)} className="space-y-4">
            <div>
              <Label>Fornecedor</Label>
              <Select value={formEditar.watch('fornecedor_id') ?? '__none__'} onValueChange={(v) => formEditar.setValue('fornecedor_id', v === '__none__' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o fornecedor..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhum —</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input {...formEditar.register('descricao')} placeholder="Descrição do pagamento" />
              {formEditar.formState.errors.descricao && (
                <p className="text-xs text-red-500 mt-1">{formEditar.formState.errors.descricao.message}</p>
              )}
            </div>
            <div>
              <Label>Conta para Débito</Label>
              <Select
                value={formEditar.watch('conta_corrente_id') ?? formEditar.watch('cartao_id') ?? '__none__'}
                onValueChange={(v) => {
                  if (v === '__none__') {
                    formEditar.setValue('conta_corrente_id', undefined)
                    formEditar.setValue('cartao_id', undefined)
                    return
                  }
                  const isCartao = cartoes.some(c => c.id === v)
                  if (isCartao) {
                    formEditar.setValue('cartao_id', v)
                    formEditar.setValue('conta_corrente_id', undefined)
                  } else {
                    formEditar.setValue('conta_corrente_id', v)
                    formEditar.setValue('cartao_id', undefined)
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {contasCorrente.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_apelido}</SelectItem>)}
                  {cartoes.map((c) => <SelectItem key={c.id} value={c.id}>💳 {c.banco} ****{c.final_cartao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Input {...formEditar.register('observacoes')} placeholder="Opcional" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setContaEditando(null)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700">Salvar Alterações</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Pagamento */}
      <Dialog open={!!parcelaSelecionada} onOpenChange={(o) => !o && setParcelaSelecionada(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          {parcelaSelecionada && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm space-y-1">
              <p><span className="text-gray-500">Descrição:</span> <strong>{(parcelaSelecionada as ParcelaPagar & { conta_descricao?: string }).conta_descricao ?? '—'}</strong></p>
              <p><span className="text-gray-500">Parcela:</span> <strong>{parcelaSelecionada.numero_parcela}/{parcelaSelecionada.total_parcelas}</strong></p>
              <p><span className="text-gray-500">Valor:</span> <strong className="text-red-600">{formatCurrency(parcelaSelecionada.valor)}</strong></p>
            </div>
          )}
          <form onSubmit={formPagar.handleSubmit(handleRegistrarPagamento)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Valor Pago (R$)</Label><Input {...formPagar.register('valor_pago', { valueAsNumber: true })} type="number" step="0.01" min="0.01" /></div>
              <div><Label>Data do Pagamento</Label><Input {...formPagar.register('data_pagamento')} type="date" /></div>
              <div><Label>Juros (R$)</Label><Input {...formPagar.register('juros', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0,00" /></div>
              <div><Label>Multa (R$)</Label><Input {...formPagar.register('multa', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0,00" /></div>
            </div>
            <div>
              <Label>Pagar via</Label>
              <div className="flex gap-4 mt-1">
                {(['conta', 'cartao'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" value={t} {...formPagar.register('forma_pagamento')} className="accent-blue-600" />
                    <span className="text-sm">{t === 'conta' ? 'Conta Corrente' : 'Cartão de Crédito'}</span>
                  </label>
                ))}
              </div>
            </div>
            {formaPagamento === 'conta' ? (
              <div>
                <Label>Conta</Label>
                <Select value={formPagar.watch('conta_corrente_id') ?? ''} onValueChange={(v) => formPagar.setValue('conta_corrente_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{contasCorrente.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome_apelido} — {formatCurrency(c.saldo_atual)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Cartão</Label>
                <Select value={formPagar.watch('cartao_id') ?? ''} onValueChange={(v) => formPagar.setValue('cartao_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{cartoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.banco} ****{c.final_cartao}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setParcelaSelecionada(null)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700"><CheckCircle className="h-4 w-4 mr-2" />Confirmar Pagamento</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
