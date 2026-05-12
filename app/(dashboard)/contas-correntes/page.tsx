'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Landmark, ArrowLeftRight, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getContasCorrentes,
  createConta,
  updateConta,
  deleteConta,
  getExtratoConta,
  transferirEntreContas,
} from '@/lib/supabase/contas-correntes'
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
import type { ContaCorrente, MovimentacaoConta } from '@/types'

const BANCOS_BR = [
  'Nubank','Banco Inter','C6 Bank','Banco do Brasil','Itaú','Bradesco',
  'Santander','Caixa Econômica Federal','Sicoob','Sicredi','BTG Pactual',
  'XP Investimentos','Neon','PagBank','Mercado Pago','Outro',
]

const schemaContaForm = z.object({
  nome_apelido: z.string().min(2, 'Mínimo 2 caracteres'),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  digito: z.string().optional(),
  tipo_conta: z.enum(['corrente', 'poupanca', 'investimento', 'caixa']),
  saldo_inicial: z.number().min(0, 'Saldo não pode ser negativo'),
  chave_pix: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.tipo_conta !== 'caixa' && !data.banco) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Selecione o banco', path: ['banco'] })
  }
})
type ContaFormValues = z.infer<typeof schemaContaForm>

const schemaTransferencia = z.object({
  origem_id: z.string().min(1, 'Selecione a conta de origem'),
  destino_id: z.string().min(1, 'Selecione a conta de destino'),
  valor: z.number().positive('Valor deve ser positivo'),
  data: z.string().min(1, 'Informe a data'),
  descricao: z.string().min(1, 'Informe a descrição'),
})
type TransferenciaFormValues = z.infer<typeof schemaTransferencia>

const TIPO_LABELS: Record<string, string> = {
  corrente: 'Corrente', poupanca: 'Poupança',
  investimento: 'Investimento', caixa: 'Caixa',
}
const TIPO_MOV_LABEL: Record<string, string> = {
  credito: 'Crédito', debito: 'Débito',
  transferencia_entrada: 'Transf. Entrada', transferencia_saida: 'Transf. Saída',
}

export default function ContasCorrentesPage() {
  const [contas, setContas] = useState<ContaCorrente[]>([])
  const [extrato, setExtrato] = useState<MovimentacaoConta[]>([])
  const [contaSelecionada, setContaSelecionada] = useState<ContaCorrente | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingExtrato, setLoadingExtrato] = useState(false)
  const [dialogConta, setDialogConta] = useState(false)
  const [dialogTransf, setDialogTransf] = useState(false)
  const [editandoConta, setEditandoConta] = useState<ContaCorrente | undefined>()
  const [userId, setUserId] = useState('')
  const { toast: _toast } = useToast()

  const formConta = useForm<ContaFormValues>({ resolver: zodResolver(schemaContaForm) })
  const formTransf = useForm<TransferenciaFormValues>({
    resolver: zodResolver(schemaTransferencia),
    defaultValues: { data: new Date().toISOString().split('T')[0] },
  })

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchContas = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getContasCorrentes(userId)
      setContas(data)
    } catch {
      _toast('Erro ao carregar contas', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, _toast])

  useEffect(() => { fetchContas() }, [fetchContas])

  async function fetchExtrato(conta: ContaCorrente) {
    setContaSelecionada(conta)
    setLoadingExtrato(true)
    try {
      const data = await getExtratoConta(conta.id)
      setExtrato(data)
    } finally {
      setLoadingExtrato(false)
    }
  }

  async function handleSalvarConta(values: ContaFormValues) {
    try {
      if (editandoConta) {
        await updateConta(userId, editandoConta.id, values)
        _toast('Conta atualizada!', 'success')
      } else {
        await createConta(userId, values)
        _toast('Conta criada!', 'success')
      }
      setDialogConta(false)
      formConta.reset()
      fetchContas()
    } catch {
      _toast('Erro ao salvar conta', 'error')
    }
  }

  async function handleTransferencia(values: TransferenciaFormValues) {
    if (values.origem_id === values.destino_id) {
      _toast('Origem e destino devem ser diferentes', 'error')
      return
    }
    try {
      await transferirEntreContas(
        userId,
        values.origem_id,
        values.destino_id,
        values.valor,
        values.data,
        values.descricao
      )
      _toast('Transferência realizada!', 'success')
      setDialogTransf(false)
      formTransf.reset({ data: new Date().toISOString().split('T')[0] })
      fetchContas()
      if (contaSelecionada) fetchExtrato(contaSelecionada)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na transferência'
      _toast(msg, 'error')
    }
  }

  const saldoTotal = contas.reduce((s, c) => s + c.saldo_atual, 0)

  function openNovaConta() {
    setEditandoConta(undefined)
    formConta.reset({ tipo_conta: 'corrente', saldo_inicial: 0 })
    setDialogConta(true)
  }

  function openEditarConta(c: ContaCorrente) {
    setEditandoConta(c)
    formConta.reset({
      nome_apelido: c.nome_apelido,
      banco: c.banco,
      agencia: c.agencia ?? '',
      conta: c.conta ?? '',
      digito: c.digito ?? '',
      tipo_conta: c.tipo_conta,
      saldo_inicial: c.saldo_inicial,
      chave_pix: c.chave_pix ?? '',
    })
    setDialogConta(true)
  }

  async function handleDeleteConta(id: string) {
    if (!confirm('Excluir esta conta? Esta ação não pode ser desfeita.')) return
    try {
      await deleteConta(userId, id)
      _toast('Conta excluída', 'success')
      if (contaSelecionada?.id === id) setContaSelecionada(null)
      fetchContas()
    } catch {
      _toast('Erro ao excluir conta', 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas Correntes</h1>
          <p className="text-sm text-gray-500">
            Saldo total: <span className="font-semibold text-green-600">{formatCurrency(saldoTotal)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogTransf(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Transferir
          </Button>
          <Button onClick={openNovaConta}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* Cards de contas */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : contas.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <Landmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma conta cadastrada</p>
            <p className="text-sm mt-1">Clique em &quot;Nova Conta&quot; para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map((c) => (
            <Card
              key={c.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                contaSelecionada?.id === c.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => fetchExtrato(c)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{c.nome_apelido}</p>
                    <p className="text-xs text-gray-500">{c.banco}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {TIPO_LABELS[c.tipo_conta]}
                    </Badge>
                    {c.chave_pix && (
                      <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded-full max-w-[120px] truncate" title={c.chave_pix}>
                        PIX: {c.chave_pix}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${c.saldo_atual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(c.saldo_atual)}
                </p>
                {c.agencia && (
                  <p className="text-xs text-gray-400 mt-1">
                    Ag: {c.agencia} · Cc: {c.conta}{c.digito ? `-${c.digito}` : ''}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditarConta(c) }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteConta(c.id) }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Extrato */}
      {contaSelecionada && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                Extrato — {contaSelecionada.nome_apelido}
              </CardTitle>
              <p className="text-sm text-gray-500">{extrato.length} movimentações</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingExtrato ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : extrato.length === 0 ? (
              <p className="text-center text-gray-400 py-10">Nenhuma movimentação ainda</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                      <th className="text-left px-6 py-3">Data</th>
                      <th className="text-left px-4 py-3">Descrição</th>
                      <th className="text-left px-4 py-3">Tipo</th>
                      <th className="text-right px-4 py-3">Valor</th>
                      <th className="text-right px-6 py-3">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {extrato.map((m) => {
                      const isCredito = m.tipo === 'credito' || m.tipo === 'transferencia_entrada'
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-gray-500">{formatDate(m.data_movimentacao)}</td>
                          <td className="px-4 py-3 text-gray-900">{m.descricao}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${isCredito ? 'text-green-600' : 'text-red-600'}`}>
                              {TIPO_MOV_LABEL[m.tipo]}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${isCredito ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredito ? '+' : '-'}{formatCurrency(m.valor)}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-gray-900">
                            {formatCurrency(m.saldo_posterior)}
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

      {/* Dialog: Nova/Editar Conta */}
      <Dialog open={dialogConta} onOpenChange={setDialogConta}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoConta ? 'Editar Conta' : 'Nova Conta Corrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={formConta.handleSubmit(handleSalvarConta)} className="space-y-4">
            <div>
              <Label>Apelido da Conta</Label>
              <Input {...formConta.register('nome_apelido')} placeholder="Ex: Conta Principal" />
              {formConta.formState.errors.nome_apelido && (
                <p className="text-xs text-red-500 mt-1">{formConta.formState.errors.nome_apelido.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {formConta.watch('tipo_conta') !== 'caixa' && (
                <div>
                  <Label>Banco</Label>
                  <Select
                    value={formConta.watch('banco') ?? ''}
                    onValueChange={(v) => formConta.setValue('banco', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {BANCOS_BR.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {formConta.formState.errors.banco && (
                    <p className="text-xs text-red-500 mt-1">{formConta.formState.errors.banco.message}</p>
                  )}
                </div>
              )}
              <div className={formConta.watch('tipo_conta') === 'caixa' ? 'col-span-2' : ''}>
                <Label>Tipo</Label>
                <Select
                  value={formConta.watch('tipo_conta') ?? 'corrente'}
                  onValueChange={(v) => {
                    formConta.setValue('tipo_conta', v as never)
                    if (v === 'caixa') {
                      formConta.setValue('banco', '')
                      formConta.setValue('agencia', '')
                      formConta.setValue('conta', '')
                      formConta.setValue('digito', '')
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formConta.watch('tipo_conta') !== 'caixa' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Agência</Label>
                  <Input {...formConta.register('agencia')} placeholder="0000" />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input {...formConta.register('conta')} placeholder="00000" />
                </div>
                <div>
                  <Label>Dígito</Label>
                  <Input {...formConta.register('digito')} placeholder="0" />
                </div>
              </div>
            )}
            <div>
              <Label>Saldo Inicial (R$)</Label>
              <Input
                {...formConta.register('saldo_inicial', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input
                {...formConta.register('chave_pix')}
                placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogConta(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {editandoConta ? 'Salvar' : 'Criar Conta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Transferência */}
      <Dialog open={dialogTransf} onOpenChange={setDialogTransf}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transferência entre Contas</DialogTitle>
          </DialogHeader>
          <form onSubmit={formTransf.handleSubmit(handleTransferencia)} className="space-y-4">
            <div>
              <Label>Conta de Origem</Label>
              <Select
                value={formTransf.watch('origem_id') ?? ''}
                onValueChange={(v) => formTransf.setValue('origem_id', v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_apelido} — {formatCurrency(c.saldo_atual)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta de Destino</Label>
              <Select
                value={formTransf.watch('destino_id') ?? ''}
                onValueChange={(v) => formTransf.setValue('destino_id', v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_apelido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  {...formTransf.register('valor', { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input {...formTransf.register('data')} type="date" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input {...formTransf.register('descricao')} placeholder="Motivo da transferência" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogTransf(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">Transferir</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
