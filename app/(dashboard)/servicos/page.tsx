'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Wrench, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getServicos,
  createServico,
  updateServico,
  deleteServico,
} from '@/lib/supabase/servicos'
import { calcularMargemLucro } from '@/lib/supabase/produtos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { formatCurrency } from '@/lib/utils'
import type { Servico } from '@/types'

const schemaServico = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  detalhes: z.string().optional(),
  unidade_medida: z.string().min(1, 'Informe a unidade'),
  preco_custo: z.number().min(0),
  preco_unitario: z.number().positive('Preço inválido'),
})
type ServicoForm = z.infer<typeof schemaServico>

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editandoServico, setEditandoServico] = useState<Servico | undefined>()
  const [userId, setUserId] = useState('')
  const { toast: _toast } = useToast()

  const formServico = useForm<ServicoForm>({
    resolver: zodResolver(schemaServico),
    defaultValues: { unidade_medida: 'UN', preco_custo: 0, preco_unitario: 0 },
  })

  const custoServico = formServico.watch('preco_custo') || 0
  const vendaServico = formServico.watch('preco_unitario') || 0
  const margemServico = calcularMargemLucro(custoServico, vendaServico)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchTudo = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const _servicos = await getServicos(userId)
      setServicos(_servicos)
    } catch {
      _toast('Erro ao carregar serviços', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, _toast])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  function openNovo() {
    setEditandoServico(undefined)
    formServico.reset({ unidade_medida: 'UN', preco_custo: 0, preco_unitario: 0, nome: '', detalhes: '' })
    setDialogOpen(true)
  }

  function openEditarServico(s: Servico) {
    setEditandoServico(s)
    formServico.reset({
      nome: s.nome,
      detalhes: s.detalhes ?? '',
      unidade_medida: s.unidade_medida,
      preco_custo: s.preco_custo,
      preco_unitario: s.preco_unitario,
    })
    setDialogOpen(true)
  }

  async function handleSalvarServico(values: ServicoForm) {
    try {
      if (editandoServico) {
        await updateServico(userId, editandoServico.id, values)
        _toast('Serviço atualizado!', 'success')
      } else {
        await createServico(userId, values)
        _toast('Serviço criado!', 'success')
      }
      setDialogOpen(false)
      fetchTudo()
    } catch {
      _toast('Erro ao salvar serviço', 'error')
    }
  }

  async function handleExcluirServico(id: string) {
    if (!confirm('Excluir serviço?')) return
    try {
      await deleteServico(userId, id)
      _toast('Serviço excluído', 'success')
      fetchTudo()
    } catch {
      _toast('Erro ao excluir serviço', 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
          <p className="text-sm text-gray-500">{servicos.length} serviço(s) cadastrado(s)</p>
        </div>
        <Button onClick={openNovo}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-blue-600" />
            Serviços
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : servicos.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum serviço cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Nome</th>
                    <th className="text-right px-4 py-3">Custo</th>
                    <th className="text-right px-4 py-3">Venda</th>
                    <th className="text-center px-4 py-3">Margem</th>
                    <th className="text-right px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {servicos.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{s.nome}</td>
                      <td className="px-4 py-4 text-right text-gray-500">{formatCurrency(s.preco_custo)}</td>
                      <td className="px-4 py-4 text-right font-medium text-gray-900">{formatCurrency(s.preco_unitario)}</td>
                      <td className="px-4 py-4 text-center">
                        <Badge variant={s.margem_lucro >= 0 ? 'default' : 'secondary'} className="text-xs">
                          {s.margem_lucro.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditarServico(s)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleExcluirServico(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Novo/Editar Serviço */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoServico ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={formServico.handleSubmit(handleSalvarServico)} className="space-y-4">
            <div><Label>Nome</Label><Input {...formServico.register('nome')} placeholder="Nome do serviço" /></div>
            <div><Label>Detalhes</Label><Input {...formServico.register('detalhes')} placeholder="Opcional" /></div>
            <div><Label>Unidade de Medida</Label><Input {...formServico.register('unidade_medida')} placeholder="UN" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Preço de Custo (R$)</Label><Input {...formServico.register('preco_custo', { valueAsNumber: true })} type="number" step="0.01" min="0" /></div>
              <div><Label>Preço de Venda (R$)</Label><Input {...formServico.register('preco_unitario', { valueAsNumber: true })} type="number" step="0.01" min="0" /></div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-sm">
              <span className="text-blue-700 font-medium">Margem: {margemServico.toFixed(1)}%</span>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" className="flex-1">{editandoServico ? 'Salvar' : 'Criar Serviço'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
