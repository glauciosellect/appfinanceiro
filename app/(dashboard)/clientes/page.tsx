'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  toggleAtivoCliente,
} from '@/lib/supabase/clientes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClienteForm } from '@/components/clientes/cliente-form'
import { useToast } from '@/components/ui/toast'
import type { Cliente, ClienteFormData } from '@/types'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroAtivo, setFiltroAtivo] = useState('ativos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Cliente | undefined>()
  const [deletandoId, setDeletandoId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const { toast: _toast } = useToast()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchClientes = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getClientes(userId, {
        search: search || undefined,
        tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
        ativo: filtroAtivo === 'ativos' ? true : filtroAtivo === 'inativos' ? false : undefined,
      })
      setClientes(data)
    } catch {
      _toast('Erro ao carregar clientes', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, search, filtroTipo, filtroAtivo, _toast])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  async function handleSubmit(data: ClienteFormData) {
    try {
      if (editando) {
        await updateCliente(userId, editando.id, data)
        _toast('Cliente atualizado!', 'success')
      } else {
        await createCliente(userId, data)
        _toast('Cliente criado!', 'success')
      }
      setDialogOpen(false)
      setEditando(undefined)
      fetchClientes()
    } catch {
      _toast('Erro ao salvar cliente', 'error')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    setDeletandoId(id)
    try {
      await deleteCliente(userId, id)
      _toast('Cliente excluído', 'success')
      fetchClientes()
    } catch {
      _toast('Erro ao excluir cliente', 'error')
    } finally {
      setDeletandoId(null)
    }
  }

  async function handleToggleAtivo(cliente: Cliente) {
    try {
      await toggleAtivoCliente(userId, cliente.id, !cliente.ativo)
      _toast(cliente.ativo ? 'Cliente desativado' : 'Cliente ativado', 'success')
      fetchClientes()
    } catch {
      _toast('Erro ao alterar status', 'error')
    }
  }

  function openNovo() {
    setEditando(undefined)
    setDialogOpen(true)
  }

  function openEditar(c: Cliente) {
    setEditando(c)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500">{clientes.length} cliente(s) encontrado(s)</p>
        </div>
        <Button onClick={openNovo}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, CPF/CNPJ, e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="pessoa_fisica">Pessoa Física</SelectItem>
                <SelectItem value="pessoa_juridica">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Lista de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : clientes.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum cliente encontrado</p>
              <p className="text-sm mt-1">Cadastre seu primeiro cliente clicando em &quot;Novo Cliente&quot;</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Nome</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">CPF/CNPJ</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Telefone</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">E-mail</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clientes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{c.nome}</td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">
                        {c.cpf_cnpj || '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-500 hidden lg:table-cell">
                        {c.telefone || '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-500 hidden lg:table-cell">
                        {c.email || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="secondary" className="text-xs">
                          {c.tipo === 'pessoa_fisica' ? 'PF' : 'PJ'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={c.ativo ? 'default' : 'secondary'} className="text-xs">
                          {c.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditar(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleAtivo(c)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title={c.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {c.ativo ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deletandoId === c.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                            title="Excluir"
                          >
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

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <ClienteForm
            initial={editando}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
