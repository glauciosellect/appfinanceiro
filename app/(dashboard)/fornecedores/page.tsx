'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, ToggleLeft, ToggleRight, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getFornecedores,
  createFornecedor,
  updateFornecedor,
  deleteFornecedor,
  toggleAtivoFornecedor,
} from '@/lib/supabase/fornecedores'
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
import { FornecedorForm } from '@/components/fornecedores/fornecedor-form'
import { useToast } from '@/components/ui/toast'
import type { Fornecedor, FornecedorFormData } from '@/types'

const CATEGORIAS_FORNECEDOR = [
  'Serviços',
  'Produtos',
  'Utilities (água/luz/internet)',
  'Aluguel',
  'Tecnologia',
  'Logística',
  'Marketing',
  'Contabilidade / Jurídico',
  'Outros',
]

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [filtroAtivo, setFiltroAtivo] = useState('ativos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editando, setEditando] = useState<Fornecedor | undefined>()
  const [deletandoId, setDeletandoId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>('')
  const { toast: _toast } = useToast()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchFornecedores = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getFornecedores(userId, {
        search: search || undefined,
        tipo: filtroTipo !== 'todos' ? filtroTipo : undefined,
        categoria: filtroCategoria !== 'todas' ? filtroCategoria : undefined,
        ativo: filtroAtivo === 'ativos' ? true : filtroAtivo === 'inativos' ? false : undefined,
      })
      setFornecedores(data)
    } catch {
      _toast('Erro ao carregar fornecedores', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, search, filtroTipo, filtroCategoria, filtroAtivo, _toast])

  useEffect(() => {
    fetchFornecedores()
  }, [fetchFornecedores])

  async function handleSubmit(data: FornecedorFormData) {
    try {
      if (editando) {
        await updateFornecedor(userId, editando.id, data)
        _toast('Fornecedor atualizado!', 'success')
      } else {
        await createFornecedor(userId, data)
        _toast('Fornecedor criado!', 'success')
      }
      setDialogOpen(false)
      setEditando(undefined)
      fetchFornecedores()
    } catch {
      _toast('Erro ao salvar fornecedor', 'error')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return
    setDeletandoId(id)
    try {
      await deleteFornecedor(userId, id)
      _toast('Fornecedor excluído', 'success')
      fetchFornecedores()
    } catch {
      _toast('Erro ao excluir fornecedor', 'error')
    } finally {
      setDeletandoId(null)
    }
  }

  async function handleToggleAtivo(f: Fornecedor) {
    try {
      await toggleAtivoFornecedor(userId, f.id, !f.ativo)
      _toast(f.ativo ? 'Fornecedor desativado' : 'Fornecedor ativado', 'success')
      fetchFornecedores()
    } catch {
      _toast('Erro ao alterar status', 'error')
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-sm text-gray-500">{fornecedores.length} fornecedor(es) encontrado(s)</p>
        </div>
        <Button onClick={() => { setEditando(undefined); setDialogOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor
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
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {CATEGORIAS_FORNECEDOR.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pessoa_fisica">PF</SelectItem>
                <SelectItem value="pessoa_juridica">PJ</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
              <SelectTrigger className="w-full sm:w-36">
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
            <Building2 className="h-5 w-5 text-blue-600" />
            Lista de Fornecedores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : fornecedores.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum fornecedor encontrado</p>
              <p className="text-sm mt-1">Clique em &quot;Novo Fornecedor&quot; para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Nome</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">CPF/CNPJ</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Categoria</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Telefone</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fornecedores.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{f.nome}</td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">
                        {f.cpf_cnpj || '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-500 hidden lg:table-cell">
                        {f.categoria || '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-500 hidden lg:table-cell">
                        {f.telefone || '—'}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="secondary" className="text-xs">
                          {f.tipo === 'pessoa_fisica' ? 'PF' : 'PJ'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant={f.ativo ? 'default' : 'secondary'} className="text-xs">
                          {f.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditando(f); setDialogOpen(true) }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleAtivo(f)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title={f.ativo ? 'Desativar' : 'Ativar'}
                          >
                            {f.ativo ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(f.id)}
                            disabled={deletandoId === f.id}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <FornecedorForm
            initial={editando}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
