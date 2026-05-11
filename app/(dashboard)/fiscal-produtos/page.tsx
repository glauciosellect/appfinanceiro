'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Plus, Search, Edit2, Package, X, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { produtosFiscais as inicial } from '@/lib/fiscal/mock-data'
import type { ProdutoFiscal } from '@/lib/fiscal/types'

export default function FiscalProdutosPage() {
  const [produtos, setProdutos] = useState<ProdutoFiscal[]>(inicial)
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<'novo' | 'editar'>('novo')
  const [form, setForm] = useState<Partial<ProdutoFiscal>>({})

  const filtrados = produtos.filter(
    (p) => !busca || p.descricao.toLowerCase().includes(busca.toLowerCase()) || p.codigo.includes(busca)
  )

  function abrirNovo() {
    setForm({ ativo: true, unidade: 'UN', cfop: '5102' })
    setModo('novo')
    setOpen(true)
  }

  function salvar() {
    if (!form.descricao) return
    if (modo === 'novo') {
      setProdutos([...produtos, {
        id: `p${Date.now()}`,
        codigo: String(produtos.length + 1).padStart(3, '0'),
        descricao: form.descricao,
        ncm: form.ncm || '',
        cfop: form.cfop || '5102',
        unidade: form.unidade || 'UN',
        precoUnitario: form.precoUnitario || 0,
        estoque: form.estoque || 0,
        estoqueMinimo: form.estoqueMinimo || 0,
        ativo: true,
      }])
    } else {
      setProdutos(produtos.map((p) => p.id === form.id ? { ...p, ...form } as ProdutoFiscal : p))
    }
    setOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produtos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Cadastre uma vez, reutilize em toda emissão de NF-e
          </p>
        </div>
        <Button onClick={abrirNovo}><Plus className="h-4 w-4" />Novo Produto</Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar produto..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">{filtrados.length} produto(s) cadastrado(s)</CardTitle></CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Código','Descrição','NCM','CFOP','Un.','Preço Unit.','Estoque','Status','Ações'].map((h) => (
                    <th key={h} className={cn('px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide', ['Preço Unit.','Estoque','Ações'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtrados.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{p.codigo}</td>
                    <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-200">{p.descricao}</td>
                    <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400">{p.ncm}</td>
                    <td className="px-6 py-4 font-mono text-gray-500 dark:text-gray-400">{p.cfop}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{p.unidade}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(p.precoUnitario)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn('font-bold', p.estoque <= p.estoqueMinimo ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-800 dark:text-gray-200')}>{p.estoque}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', p.ativo ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400')}>
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setForm(p); setModo('editar'); setOpen(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-12 text-center">
                    <Package className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 dark:text-gray-500">Nenhum produto encontrado</p>
                    <button onClick={abrirNovo} className="mt-3 text-blue-600 font-medium text-sm hover:underline">Cadastrar primeiro produto</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{modo === 'novo' ? 'Novo Produto' : 'Editar Produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição *</label>
              <Input placeholder="Nome do produto" value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NCM</label>
                <Input placeholder="0000.00.00" value={form.ncm || ''} onChange={(e) => setForm({ ...form, ncm: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CFOP</label>
                <Input placeholder="5102" value={form.cfop || ''} onChange={(e) => setForm({ ...form, cfop: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade</label>
                <select className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.unidade || 'UN'} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                  {['UN','CX','KG','LT','MT','PC','PAR'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço Unitário (R$)</label>
                <Input type="number" step="0.01" value={form.precoUnitario || ''} onChange={(e) => setForm({ ...form, precoUnitario: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque Atual</label>
                <Input type="number" value={form.estoque ?? 0} onChange={(e) => setForm({ ...form, estoque: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque Mínimo</label>
                <Input type="number" value={form.estoqueMinimo ?? 0} onChange={(e) => setForm({ ...form, estoqueMinimo: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={salvar}><Save className="h-4 w-4" />{modo === 'novo' ? 'Cadastrar' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
