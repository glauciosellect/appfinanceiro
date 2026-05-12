'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CreditCard, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCartoes, createCartao, updateCartao, deleteCartao, getFaturas, pagarFatura } from '@/lib/supabase/cartoes'
import { getContasCorrentes } from '@/lib/supabase/contas-correntes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Cartao, FaturaCartao, ContaCorrente, Bandeira } from '@/types'

const BANCOS_BR = ['Nubank','Banco Inter','C6 Bank','Banco do Brasil','Itaú','Bradesco','Santander','Caixa Econômica Federal','BTG Pactual','XP','Sicoob','Sicredi','Neon','PagBank','Mercado Pago','Outro']
const BANDEIRAS: { value: Bandeira; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'outro', label: 'Outro' },
]
const BANCO_COLORS: Record<string, string> = {
  'Nubank':                  'from-purple-800 to-purple-600',
  'Banco Inter':             'from-orange-600 to-orange-400',
  'C6 Bank':                 'from-gray-900 to-gray-700',
  'Banco do Brasil':         'from-yellow-600 to-yellow-400',
  'Itaú':                    'from-orange-700 to-amber-500',
  'Bradesco':                'from-red-700 to-red-500',
  'Santander':               'from-red-800 to-rose-600',
  'Caixa Econômica Federal': 'from-blue-800 to-cyan-600',
  'BTG Pactual':             'from-blue-950 to-blue-800',
  'XP':                      'from-gray-950 to-gray-800',
  'Sicoob':                  'from-green-800 to-green-600',
  'Sicredi':                 'from-green-700 to-emerald-500',
  'Neon':                    'from-teal-600 to-cyan-400',
  'PagBank':                 'from-yellow-500 to-green-500',
  'Mercado Pago':            'from-sky-600 to-blue-500',
  'Outro':                   'from-gray-700 to-gray-500',
}

const schemaCartao = z.object({
  banco: z.string().min(1, 'Selecione o banco'),
  bandeira: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro']),
  nome_titular: z.string().min(3, 'Mínimo 3 caracteres'),
  final_cartao: z.string().length(4, '4 dígitos').optional(),
  limite_total: z.number().positive('Limite inválido'),
  dia_vencimento: z.number().int().min(1).max(31),
  melhor_dia_compra: z.number().int().min(1).max(31),
  conta_corrente_id: z.string().optional(),
})
type CartaoForm = z.infer<typeof schemaCartao>

const STATUS_FATURA: Record<string, { label: string; color: string }> = {
  aberta: { label: 'Aberta', color: 'text-blue-600' },
  fechada: { label: 'Fechada', color: 'text-amber-600' },
  paga: { label: 'Paga', color: 'text-green-600' },
  parcial: { label: 'Parcial', color: 'text-orange-600' },
}

export default function CartoesPage() {
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [faturas, setFaturas] = useState<FaturaCartao[]>([])
  const [contasCorrente, setContasCorrente] = useState<ContaCorrente[]>([])
  const [cartaoSelecionado, setCartaoSelecionado] = useState<Cartao | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogCartao, setDialogCartao] = useState(false)
  const [editandoCartao, setEditandoCartao] = useState<Cartao | undefined>()
  const [userId, setUserId] = useState('')
  const { toast: _toast } = useToast()

  const formCartao = useForm<CartaoForm>({ resolver: zodResolver(schemaCartao) })

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchCartoes = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [_cartoes, _contas] = await Promise.all([
        getCartoes(userId),
        getContasCorrentes(userId),
      ])
      setCartoes(_cartoes)
      setContasCorrente(_contas)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchCartoes() }, [fetchCartoes])

  async function fetchFaturas(cartao: Cartao) {
    setCartaoSelecionado(cartao)
    const data = await getFaturas(cartao.id)
    setFaturas(data)
  }

  async function handleSalvarCartao(values: CartaoForm) {
    try {
      if (editandoCartao) {
        await updateCartao(userId, editandoCartao.id, values)
        _toast('Cartão atualizado!', 'success')
      } else {
        await createCartao(userId, { ...values, limite_disponivel: values.limite_total, ativo: true, final_cartao: values.final_cartao ?? '' })
        _toast('Cartão criado!', 'success')
      }
      setDialogCartao(false)
      fetchCartoes()
    } catch {
      _toast('Erro ao salvar cartão', 'error')
    }
  }

  async function handlePagarFatura(faturaId: string, valor: number, contaId: string) {
    try {
      await pagarFatura(userId, faturaId, valor, contaId)
      _toast('Fatura paga!', 'success')
      if (cartaoSelecionado) fetchFaturas(cartaoSelecionado)
      fetchCartoes()
    } catch {
      _toast('Erro ao pagar fatura', 'error')
    }
  }

  function openNovoCartao() {
    setEditandoCartao(undefined)
    formCartao.reset({ bandeira: 'visa', dia_vencimento: 10, melhor_dia_compra: 1 })
    setDialogCartao(true)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartões de Crédito</h1>
          <p className="text-sm text-gray-500">{cartoes.length} cartão(ões) cadastrado(s)</p>
        </div>
        <Button onClick={openNovoCartao}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cartão
        </Button>
      </div>

      {/* Cards de cartões */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2].map(i => <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : cartoes.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-gray-400">
          <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum cartão cadastrado</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cartoes.map((c) => {
            const usadoPct = c.limite_total > 0 ? ((c.limite_total - c.limite_disponivel) / c.limite_total) * 100 : 0
            const gradiente = BANCO_COLORS[c.banco] ?? BANCO_COLORS['Outro']
            return (
              <div
                key={c.id}
                className={`cursor-pointer rounded-2xl bg-gradient-to-br ${gradiente} p-5 text-white shadow-lg hover:shadow-xl transition-all ${cartaoSelecionado?.id === c.id ? 'ring-2 ring-white/50' : ''}`}
                onClick={() => fetchFaturas(c)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm opacity-80">{c.banco}</p>
                    <p className="font-bold text-lg">{c.nome_titular}</p>
                  </div>
                  <Badge className="bg-white/20 text-white border-0 text-xs uppercase">
                    {c.bandeira}
                  </Badge>
                </div>
                <p className="text-xl font-mono tracking-widest mb-4">**** **** **** {c.final_cartao ?? '????'}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs opacity-80">
                    <span>Disponível: {formatCurrency(c.limite_disponivel)}</span>
                    <span>Limite: {formatCurrency(c.limite_total)}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-1.5">
                    <div className="bg-white rounded-full h-1.5" style={{ width: `${Math.min(usadoPct, 100)}%` }} />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={(e) => { e.stopPropagation(); setEditandoCartao(c); formCartao.reset({ ...c }); setDialogCartao(true) }}
                    className="text-xs opacity-80 hover:opacity-100">Editar</button>
                  <span className="opacity-40">|</span>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Excluir cartão?')) deleteCartao(userId, c.id).then(() => { _toast('Cartão excluído', 'success'); fetchCartoes() }) }}
                    className="text-xs opacity-80 hover:opacity-100">Excluir</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Faturas */}
      {cartaoSelecionado && (
        <Card>
          <CardHeader>
            <CardTitle>Faturas — {cartaoSelecionado.banco} ****{cartaoSelecionado.final_cartao}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {faturas.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Nenhuma fatura encontrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                    <th className="text-left px-6 py-3">Referência</th>
                    <th className="text-left px-4 py-3">Vencimento</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">Pago</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">Ação</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {faturas.map((f) => {
                      const cfg = STATUS_FATURA[f.status] ?? STATUS_FATURA['aberta']
                      return (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium capitalize">
                            {new Date(f.mes_referencia + 'T12:00:00').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(f.data_vencimento)}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(f.valor_total)}</td>
                          <td className="px-4 py-3 text-right text-green-600">{formatCurrency(f.valor_pago)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            {(f.status === 'aberta' || f.status === 'fechada' || f.status === 'parcial') && f.valor_total > f.valor_pago && (
                              <Select onValueChange={(contaId) => handlePagarFatura(f.id, f.valor_total - f.valor_pago, contaId)}>
                                <SelectTrigger className="h-7 text-xs w-32">
                                  <SelectValue placeholder="Pagar via..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {contasCorrente.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.nome_apelido}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
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
      )}

      {/* Dialog: Novo/Editar Cartão */}
      <Dialog open={dialogCartao} onOpenChange={setDialogCartao}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editandoCartao ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle></DialogHeader>
          <form onSubmit={formCartao.handleSubmit(handleSalvarCartao)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Banco</Label>
                <Select value={formCartao.watch('banco') ?? ''} onValueChange={(v) => formCartao.setValue('banco', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{BANCOS_BR.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bandeira</Label>
                <Select value={formCartao.watch('bandeira') ?? 'visa'} onValueChange={(v) => formCartao.setValue('bandeira', v as Bandeira)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BANDEIRAS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Nome do Titular</Label><Input {...formCartao.register('nome_titular')} placeholder="Como no cartão" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Final do Cartão (4 dígitos)</Label><Input {...formCartao.register('final_cartao')} maxLength={4} placeholder="1234" /></div>
              <div><Label>Limite Total (R$)</Label><Input {...formCartao.register('limite_total', { valueAsNumber: true })} type="number" step="0.01" min="1" placeholder="0,00" /></div>
              <div><Label>Dia Vencimento</Label><Input {...formCartao.register('dia_vencimento', { valueAsNumber: true })} type="number" min="1" max="31" /></div>
              <div><Label>Melhor Dia Compra</Label><Input {...formCartao.register('melhor_dia_compra', { valueAsNumber: true })} type="number" min="1" max="31" /></div>
            </div>
            <div>
              <Label>Conta Corrente (para pagamento)</Label>
              <Select value={formCartao.watch('conta_corrente_id') ?? ''} onValueChange={(v) => formCartao.setValue('conta_corrente_id', v)}>
                <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>{contasCorrente.map(c => <SelectItem key={c.id} value={c.id}>{c.nome_apelido}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogCartao(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">{editandoCartao ? 'Salvar' : 'Criar Cartão'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
