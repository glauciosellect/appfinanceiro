'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Package, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Produto {
  id: string
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  preco_unitario: number
  margem_lucro: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
  ativo: boolean
}

type FormData = Partial<Produto>

export default function FiscalProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<'novo' | 'editar'>('novo')
  const [form, setForm] = useState<FormData>({})
  const [salvando, setSalvando] = useState(false)

  const supabase = createClient()

  async function carregar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('produtos_fiscais')
      .select('*')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .order('descricao')
    setProdutos((data ?? []) as Produto[])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const filtrados = produtos.filter(
    (p) => !busca || p.descricao.toLowerCase().includes(busca.toLowerCase()) || p.codigo.includes(busca)
  )

  function abrirNovo() {
    setForm({ ativo: true, unidade: 'UN', cfop: '5102', estoque: 0, estoque_minimo: 0, margem_lucro: 30, preco_venda: 0 })
    setModo('novo')
    setOpen(true)
  }

  async function salvar() {
    if (!form.descricao) return
    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSalvando(false); return }

    const margem = form.margem_lucro ?? 0
    const custo = form.preco_unitario ?? 0
    const precoVenda = Math.round(custo * (1 + margem / 100) * 100) / 100

    if (modo === 'novo') {
      const novoCodigo = String(produtos.length + 1).padStart(4, '0')
      await supabase.from('produtos_fiscais').insert({
        user_id: user.id,
        codigo: novoCodigo,
        descricao: form.descricao,
        ncm: form.ncm || '',
        cfop: form.cfop || '5102',
        unidade: form.unidade || 'UN',
        preco_unitario: custo,
        margem_lucro: margem,
        preco_venda: precoVenda,
        estoque: form.estoque || 0,
        estoque_minimo: form.estoque_minimo || 0,
        ativo: true,
      })
    } else {
      await supabase.from('produtos_fiscais').update({
        descricao: form.descricao,
        ncm: form.ncm || '',
        cfop: form.cfop || '5102',
        unidade: form.unidade || 'UN',
        preco_unitario: custo,
        margem_lucro: margem,
        preco_venda: precoVenda,
        estoque_minimo: form.estoque_minimo || 0,
        updated_at: new Date().toISOString(),
      }).eq('id', form.id!)
    }

    await carregar()
    setSalvando(false)
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
        <Button onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" />Novo Produto</Button>
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
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{loading ? 'Carregando...' : `${filtrados.length} produto(s) cadastrado(s)`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Código','Descrição','NCM','CFOP','Un.','Custo Unit.','Margem','Preço Venda','Estoque','Est. Mín.','Ações'].map((h) => (
                    <th key={h} className={cn('px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide',
                      ['Custo Unit.','Margem','Preço Venda','Estoque','Est. Mín.','Ações'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
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
                    <td className="px-6 py-4 text-right text-gray-600 dark:text-gray-400">{formatCurrency(p.preco_unitario)}</td>
                    <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{(p.margem_lucro ?? 0).toFixed(0)}%</td>
                    <td className="px-6 py-4 text-right font-semibold text-green-700 dark:text-green-400">{formatCurrency(p.preco_venda ?? 0)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn('font-bold', p.estoque <= p.estoque_minimo ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-800 dark:text-gray-200')}>{p.estoque}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{p.estoque_minimo}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setForm(p); setModo('editar'); setOpen(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filtrados.length === 0 && (
                  <tr><td colSpan={11} className="px-6 py-12 text-center">
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
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.unidade || 'UN'} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                  {['UN','CX','KG','LT','MT','PC','PAR'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custo Unitário (R$)</label>
                <Input type="number" step="0.01" min="0" value={form.preco_unitario || ''} onChange={(e) => setForm({ ...form, preco_unitario: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Margem de Lucro (%)</label>
                <Input type="number" step="1" min="0" max="999"
                  value={form.margem_lucro ?? 0}
                  onChange={(e) => setForm({ ...form, margem_lucro: Math.max(0, Number(e.target.value)) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço de Venda (R$)</label>
                <Input type="number" step="0.01" min="0" readOnly
                  value={Math.round((form.preco_unitario ?? 0) * (1 + (form.margem_lucro ?? 0) / 100) * 100) / 100 || ''}
                  className="bg-gray-50 dark:bg-gray-800 text-green-700 dark:text-green-400 font-semibold cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1">Calculado automaticamente</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque Atual</label>
                <Input type="number" min="0" value={form.estoque ?? 0} onChange={(e) => setForm({ ...form, estoque: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque Mínimo</label>
                <Input type="number" min="0" value={form.estoque_minimo ?? 0} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</Button>
              <Button className="flex-1" onClick={salvar} disabled={salvando || !form.descricao}>
                <Save className="h-4 w-4 mr-1" />{salvando ? 'Salvando...' : modo === 'novo' ? 'Cadastrar' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
