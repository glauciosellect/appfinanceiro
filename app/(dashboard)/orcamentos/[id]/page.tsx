'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Package, Wrench, Search, FileOutput } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getPedidoComItens,
  updatePedido,
  updateStatusPedido,
  addItemPedido,
  updateItemPedido,
  removeItemPedido,
  recalcularTotaisPedido,
} from '@/lib/supabase/pedidos'
import { getClientes } from '@/lib/supabase/clientes'
import { getProdutosFiscaisParaCatalogo } from '@/lib/supabase/produtos'
import { getServicos } from '@/lib/supabase/servicos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import type { Cliente, Pedido, PedidoItem, Servico, StatusPedido, TipoDesconto } from '@/types'

type ProdutoCatalogo = { id: string; nome: string; preco: number }

const STATUS_OPTIONS: { value: StatusPedido; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'aguardando_pagamento', label: 'Aguardando Pagamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
]

type ItemCatalogo = { tipo: 'produto' | 'servico'; id: string; nome: string; preco: number }

export default function OrcamentoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const pedidoId = params.id as string
  const { toast: _toast } = useToast()

  const [userId, setUserId] = useState('')
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [buscaServico, setBuscaServico] = useState('')

  const [referencia, setReferencia] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [titulo, setTitulo] = useState('')
  const [condicoesPagamento, setCondicoesPagamento] = useState('')
  const [garantia, setGarantia] = useState('')
  const [informacoesAdicionais, setInformacoesAdicionais] = useState('')
  const [descontoTipo, setDescontoTipo] = useState<TipoDesconto>('percentual')
  const [descontoValor, setDescontoValor] = useState(0)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchTudo = useCallback(async () => {
    if (!userId || !pedidoId) return
    setLoading(true)
    try {
      const [resultado, _clientes, _produtos, _servicos] = await Promise.all([
        getPedidoComItens(userId, pedidoId),
        getClientes(userId, { ativo: true }),
        getProdutosFiscaisParaCatalogo(userId),
        getServicos(userId, { ativo: true }),
      ])
      if (resultado) {
        setPedido(resultado.pedido)
        setItens(resultado.itens)
        setReferencia(resultado.pedido.referencia ?? '')
        setObservacoes(resultado.pedido.observacoes ?? '')
        setTitulo(resultado.pedido.titulo ?? '')
        setCondicoesPagamento(resultado.pedido.condicoes_pagamento ?? '')
        setGarantia(resultado.pedido.garantia ?? '')
        setInformacoesAdicionais(resultado.pedido.informacoes_adicionais ?? '')
        setDescontoTipo(resultado.pedido.desconto_tipo)
        setDescontoValor(resultado.pedido.desconto_valor)
      }
      setClientes(_clientes)
      setProdutos(_produtos)
      setServicos(_servicos)
    } catch {
      _toast('Erro ao carregar orçamento', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, pedidoId, _toast])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  async function handleClienteChange(clienteId: string) {
    if (!pedido) return
    try {
      const atualizado = await updatePedido(userId, pedido.id, { cliente_id: clienteId || undefined })
      setPedido(atualizado)
    } catch {
      _toast('Erro ao atualizar cliente', 'error')
    }
  }

  async function handleStatusChange(status: StatusPedido) {
    if (!pedido) return
    try {
      await updateStatusPedido(userId, pedido.id, status)
      setPedido({ ...pedido, status })
    } catch {
      _toast('Erro ao atualizar status', 'error')
    }
  }

  async function handleSalvarCabecalho() {
    if (!pedido) return
    try {
      const atualizado = await updatePedido(userId, pedido.id, {
        referencia: referencia || undefined,
        observacoes: observacoes || undefined,
        titulo: titulo || undefined,
        condicoes_pagamento: condicoesPagamento || undefined,
        garantia: garantia || undefined,
        informacoes_adicionais: informacoesAdicionais || undefined,
      })
      setPedido(atualizado)
    } catch {
      _toast('Erro ao salvar orçamento', 'error')
    }
  }

  async function handleSalvarOrcamento() {
    if (!pedido) return
    setSalvando(true)
    try {
      await updatePedido(userId, pedido.id, {
        referencia: referencia || undefined,
        observacoes: observacoes || undefined,
        titulo: titulo || undefined,
        condicoes_pagamento: condicoesPagamento || undefined,
        garantia: garantia || undefined,
        informacoes_adicionais: informacoesAdicionais || undefined,
        desconto_tipo: descontoTipo,
        desconto_valor: descontoValor,
      })
      const atualizado = await recalcularTotaisPedido(userId, pedido.id)
      setPedido(atualizado)
      _toast('Orçamento salvo!', 'success')
    } catch {
      _toast('Erro ao salvar orçamento', 'error')
    } finally {
      setSalvando(false)
    }
  }

  async function handleAdicionarItem(item: ItemCatalogo) {
    if (!pedido) return
    try {
      const novoItem = await addItemPedido(userId, pedido.id, {
        tipo: item.tipo,
        item_id: item.id,
        nome_item: item.nome,
        quantidade: 1,
        preco_unitario: item.preco,
        desconto_tipo: 'percentual',
        desconto_valor: 0,
      })
      setItens((prev) => [...prev, novoItem])
      setPedido((prev) => prev ? { ...prev, subtotal: prev.subtotal + novoItem.subtotal, total: prev.total + novoItem.subtotal } : prev)
      if (item.tipo === 'produto') setBuscaProduto('')
      else setBuscaServico('')
    } catch {
      _toast('Erro ao adicionar item', 'error')
    }
  }

  async function handleAtualizarItem(item: PedidoItem, campo: 'quantidade' | 'desconto_valor', valor: number) {
    try {
      const atualizado = await updateItemPedido(userId, item.id, { [campo]: valor })
      setItens((prev) => prev.map((i) => (i.id === atualizado.id ? atualizado : i)))
      if (pedido) {
        const pedidoAtualizado = await recalcularTotaisPedido(userId, pedido.id)
        setPedido(pedidoAtualizado)
      }
    } catch {
      _toast('Erro ao atualizar item', 'error')
    }
  }

  async function handleRemoverItem(itemId: string) {
    if (!pedido) return
    try {
      await removeItemPedido(userId, pedido.id, itemId)
      setItens((prev) => prev.filter((i) => i.id !== itemId))
      const pedidoAtualizado = await recalcularTotaisPedido(userId, pedido.id)
      setPedido(pedidoAtualizado)
    } catch {
      _toast('Erro ao remover item', 'error')
    }
  }

  async function handleSalvarDesconto() {
    if (!pedido) return
    try {
      await updatePedido(userId, pedido.id, { desconto_tipo: descontoTipo, desconto_valor: descontoValor })
      const atualizado = await recalcularTotaisPedido(userId, pedido.id)
      setPedido(atualizado)
      _toast('Desconto aplicado!', 'success')
    } catch {
      _toast('Erro ao aplicar desconto', 'error')
    }
  }

  const buscaProdutoLower = buscaProduto.trim().toLowerCase()
  const produtosFiltrados: ItemCatalogo[] = buscaProdutoLower
    ? produtos.filter(p => p.nome.toLowerCase().includes(buscaProdutoLower)).map(p => ({ tipo: 'produto' as const, id: p.id, nome: p.nome, preco: p.preco }))
    : []

  const buscaServicoLower = buscaServico.trim().toLowerCase()
  const servicosFiltrados: ItemCatalogo[] = buscaServicoLower
    ? servicos.filter(s => s.nome.toLowerCase().includes(buscaServicoLower)).map(s => ({ tipo: 'servico' as const, id: s.id, nome: s.nome, preco: s.preco_unitario }))
    : []

  const itensServico = itens.filter(i => i.tipo === 'servico')
  const itensProduto = itens.filter(i => i.tipo === 'produto')
  const subtotalServicos = itensServico.reduce((s, i) => s + i.subtotal, 0)
  const subtotalProdutos = itensProduto.reduce((s, i) => s + i.subtotal, 0)

  if (loading || !pedido) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  const descontoAplicado = descontoTipo === 'percentual' ? pedido.subtotal * (descontoValor / 100) : descontoValor

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/orcamentos')} className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Orçamento {pedido.numero_sequencial}</h1>
            <p className="text-sm text-gray-500">Detalhes e itens do orçamento</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.push(`/orcamentos/${pedido.id}/pdf`)} className="w-full sm:w-auto">
          <FileOutput className="h-4 w-4 mr-2" />
          Gerar Orçamento
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Dados do Orçamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Cliente</Label>
              <Select value={pedido.cliente_id ?? ''} onValueChange={handleClienteChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={pedido.status} onValueChange={(v) => handleStatusChange(v as StatusPedido)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Referência</Label><Input value={referencia} onChange={(e) => setReferencia(e.target.value)} onBlur={handleSalvarCabecalho} placeholder="Opcional" /></div>
            <div><Label>Observações</Label><Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} onBlur={handleSalvarCabecalho} placeholder="Opcional" /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Título, Condições, Garantia e Informações</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={handleSalvarCabecalho} placeholder="Ex.: CFTV" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Condições de Pagamento</Label>
              <textarea
                value={condicoesPagamento}
                onChange={(e) => setCondicoesPagamento(e.target.value)}
                onBlur={handleSalvarCabecalho}
                placeholder="Ex.: À vista."
                rows={3}
                className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
            <div>
              <Label>Garantia</Label>
              <textarea
                value={garantia}
                onChange={(e) => setGarantia(e.target.value)}
                onBlur={handleSalvarCabecalho}
                placeholder="Ex.: 90 dias para peças, 30 dias para mão de obra"
                rows={3}
                className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
          <div>
            <Label>Informações Adicionais</Label>
            <textarea
              value={informacoesAdicionais}
              onChange={(e) => setInformacoesAdicionais(e.target.value)}
              onBlur={handleSalvarCabecalho}
              placeholder="Ex.: prazo de entrega, validade do orçamento..."
              rows={3}
              className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Serviços</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input className="pl-9" placeholder="Buscar serviço..." value={buscaServico} onChange={(e) => setBuscaServico(e.target.value)} />
            {servicosFiltrados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {servicosFiltrados.map((item) => (
                  <button
                    key={`${item.tipo}-${item.id}`}
                    onClick={() => handleAdicionarItem(item)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-gray-900">{item.nome}</span>
                    </div>
                    <span className="text-sm text-gray-500">{formatCurrency(item.preco)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {itensServico.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p className="font-medium">Nenhum serviço adicionado</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-2 py-2">Item</th>
                      <th className="text-center px-2 py-2 w-24">Qtd</th>
                      <th className="text-right px-2 py-2">Preço Unit.</th>
                      <th className="text-right px-2 py-2 w-28">Desconto</th>
                      <th className="text-right px-2 py-2">Subtotal</th>
                      <th className="text-right px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {itensServico.map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-purple-500" />
                            <span className="font-medium text-gray-900">{item.nome_item}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="1" step="1" defaultValue={item.quantidade} className="h-8 text-center"
                            onBlur={(e) => handleAtualizarItem(item, 'quantidade', Number(e.target.value) || 1)}
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(item.preco_unitario)}</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="0" step="0.01" defaultValue={item.desconto_valor} className="h-8 text-right"
                            onBlur={(e) => handleAtualizarItem(item, 'desconto_valor', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-gray-900">{formatCurrency(item.subtotal)}</td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => handleRemoverItem(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100">
                      <td colSpan={4} className="px-2 py-2 text-right text-sm font-medium text-gray-500">Subtotal Serviços</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatCurrency(subtotalServicos)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sm:hidden space-y-3">
                {itensServico.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Wrench className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                        <span className="font-medium text-gray-900 break-words">{item.nome_item}</span>
                      </div>
                      <button
                        onClick={() => handleRemoverItem(item.id)}
                        aria-label="Remover item"
                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-xs text-gray-500">Qtd</Label>
                        <Input
                          type="number" min="1" step="1" defaultValue={item.quantidade} className="h-9 text-center"
                          onBlur={(e) => handleAtualizarItem(item, 'quantidade', Number(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Preço Unit.</Label>
                        <p className="h-9 flex items-center text-gray-500">{formatCurrency(item.preco_unitario)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Desconto</Label>
                        <Input
                          type="number" min="0" step="0.01" defaultValue={item.desconto_valor} className="h-9 text-right"
                          onBlur={(e) => handleAtualizarItem(item, 'desconto_valor', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Subtotal</Label>
                        <p className="h-9 flex items-center font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-1 pt-1 text-sm">
                  <span className="font-medium text-gray-500">Subtotal Serviços</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(subtotalServicos)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Produtos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input className="pl-9" placeholder="Buscar produto..." value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} />
            {produtosFiltrados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {produtosFiltrados.map((item) => (
                  <button
                    key={`${item.tipo}-${item.id}`}
                    onClick={() => handleAdicionarItem(item)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium text-gray-900">{item.nome}</span>
                    </div>
                    <span className="text-sm text-gray-500">{formatCurrency(item.preco)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {itensProduto.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <p className="font-medium">Nenhum produto adicionado</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-2 py-2">Item</th>
                      <th className="text-center px-2 py-2 w-24">Qtd</th>
                      <th className="text-right px-2 py-2">Preço Unit.</th>
                      <th className="text-right px-2 py-2 w-28">Desconto</th>
                      <th className="text-right px-2 py-2">Subtotal</th>
                      <th className="text-right px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {itensProduto.map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-gray-900">{item.nome_item}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="1" step="1" defaultValue={item.quantidade} className="h-8 text-center"
                            onBlur={(e) => handleAtualizarItem(item, 'quantidade', Number(e.target.value) || 1)}
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(item.preco_unitario)}</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="0" step="0.01" defaultValue={item.desconto_valor} className="h-8 text-right"
                            onBlur={(e) => handleAtualizarItem(item, 'desconto_valor', Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-gray-900">{formatCurrency(item.subtotal)}</td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => handleRemoverItem(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100">
                      <td colSpan={4} className="px-2 py-2 text-right text-sm font-medium text-gray-500">Subtotal Produtos</td>
                      <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatCurrency(subtotalProdutos)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sm:hidden space-y-3">
                {itensProduto.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Package className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <span className="font-medium text-gray-900 break-words">{item.nome_item}</span>
                      </div>
                      <button
                        onClick={() => handleRemoverItem(item.id)}
                        aria-label="Remover item"
                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <Label className="text-xs text-gray-500">Qtd</Label>
                        <Input
                          type="number" min="1" step="1" defaultValue={item.quantidade} className="h-9 text-center"
                          onBlur={(e) => handleAtualizarItem(item, 'quantidade', Number(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Preço Unit.</Label>
                        <p className="h-9 flex items-center text-gray-500">{formatCurrency(item.preco_unitario)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Desconto</Label>
                        <Input
                          type="number" min="0" step="0.01" defaultValue={item.desconto_valor} className="h-9 text-right"
                          onBlur={(e) => handleAtualizarItem(item, 'desconto_valor', Number(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Subtotal</Label>
                        <p className="h-9 flex items-center font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-1 pt-1 text-sm">
                  <span className="font-medium text-gray-500">Subtotal Produtos</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(subtotalProdutos)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Desconto e Total</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div>
              <Label>Tipo de Desconto</Label>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setDescontoTipo('percentual')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${descontoTipo === 'percentual' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >%</button>
                <button
                  onClick={() => setDescontoTipo('valor')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${descontoTipo === 'valor' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >R$</button>
              </div>
            </div>
            <div>
              <Label>Valor do Desconto</Label>
              <Input type="number" min="0" step="0.01" value={descontoValor} onChange={(e) => setDescontoValor(Number(e.target.value) || 0)} />
            </div>
            {descontoTipo === 'percentual' && (
              <div className="flex gap-2">
                {[5, 10].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setDescontoValor(pct)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >{pct}%</button>
                ))}
              </div>
            )}
            <Button onClick={handleSalvarDesconto} className="w-full sm:w-auto">Aplicar Desconto</Button>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium text-gray-900">{formatCurrency(pedido.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Desconto</span><span className="font-medium text-red-600">- {formatCurrency(descontoAplicado)}</span></div>
            <div className="flex justify-between text-base pt-2 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-bold text-blue-600">{formatCurrency(pedido.total)}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center sm:justify-end">
        <Button size="lg" onClick={handleSalvarOrcamento} disabled={salvando} className="w-full sm:w-auto">
          {salvando ? 'Salvando...' : 'Salvar Orçamento'}
        </Button>
      </div>
    </div>
  )
}
