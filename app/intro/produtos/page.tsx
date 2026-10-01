'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Package, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getIntroConfig } from '@/lib/intro/config'

// Catálogo do Intro: mesma tabela do SyncroMoney padrão (produtos_fiscais),
// sem campos fiscais (NCM/CFOP). O estoque NÃO é editado aqui: ele nasce da
// Entrada de mercadoria (próxima fase) e baixa no PDV.
interface Produto {
  id: string
  codigo: string
  descricao: string
  barcode: string | null
  plu: string | null
  unidade: string
  preco_custo: number
  margem_lucro: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
  controla_validade: boolean
  ativo: boolean
}

type FormData = Partial<Produto>

const arredondar = (n: number) => Math.round(n * 100) / 100

export default function IntroProdutosPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<'novo' | 'editar'>('novo')
  const [form, setForm] = useState<FormData>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [margemPadrao, setMargemPadrao] = useState(30)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data }, cfg] = await Promise.all([
      supabase
        .from('produtos_fiscais')
        .select('id, codigo, descricao, barcode, plu, unidade, preco_custo, margem_lucro, preco_venda, estoque, estoque_minimo, controla_validade, ativo')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('descricao'),
      getIntroConfig(user.id),
    ])
    setProdutos((data ?? []) as Produto[])
    setMargemPadrao(Number(cfg.margem_padrao))
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const termo = busca.trim().toLowerCase()
  const filtrados = produtos.filter((p) =>
    (mostrarInativos || p.ativo) &&
    (!termo ||
      p.descricao.toLowerCase().includes(termo) ||
      (p.barcode ?? '').includes(termo) ||
      (p.plu ?? '').includes(termo))
  )

  function abrirNovo() {
    setErro('')
    setForm({ unidade: 'UN', preco_custo: 0, margem_lucro: margemPadrao, preco_venda: 0, estoque_minimo: 0, controla_validade: false })
    setModo('novo')
    setOpen(true)
  }

  function abrirEditar(p: Produto) {
    setErro('')
    setForm(p)
    setModo('editar')
    setOpen(true)
  }

  // Preço calculado pela margem quando há custo; senão vale o preço digitado.
  function precoDoForm(f: FormData): number {
    const custo = f.preco_custo ?? 0
    return custo > 0 ? arredondar(custo * (1 + (f.margem_lucro ?? 0) / 100)) : (f.preco_venda ?? 0)
  }

  async function proximoCodigo(userId: string): Promise<{ codigo: string; plu: string }> {
    const { data } = await supabase.from('produtos_fiscais').select('codigo, plu').eq('user_id', userId)
    const linhas = (data ?? []) as { codigo: string; plu: string | null }[]
    const maxNum = (vals: (string | null)[]) =>
      vals.reduce((m, v) => (v && /^\d+$/.test(v) ? Math.max(m, Number(v)) : m), 0)
    return {
      codigo: String(maxNum(linhas.map((l) => l.codigo)) + 1).padStart(4, '0'),
      plu: String(maxNum(linhas.map((l) => l.plu)) + 1),
    }
  }

  async function salvar() {
    setErro('')
    const descricao = (form.descricao ?? '').trim()
    if (!descricao) { setErro('Informe o nome do produto.'); return }
    const preco = precoDoForm(form)
    if (preco <= 0) { setErro('Informe o custo e a margem, ou o preço de venda.'); return }

    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSalvando(false); return }

    const barcode = (form.barcode ?? '').trim() || null
    const campos = {
      descricao,
      barcode,
      unidade: form.unidade || 'UN',
      preco_custo: form.preco_custo ?? 0,
      margem_lucro: form.margem_lucro ?? 0,
      preco_venda: preco,
      estoque_minimo: form.estoque_minimo ?? 0,
      controla_validade: !!form.controla_validade,
    }

    let resp
    if (modo === 'novo') {
      const { codigo, plu } = await proximoCodigo(user.id)
      // Sem código de barras, o PLU curto é o código de venda no PDV.
      resp = await supabase.from('produtos_fiscais').insert({
        ...campos, user_id: user.id, codigo, plu: barcode ? null : plu, ncm: '', cfop: '5102', estoque: 0, ativo: true,
      })
    } else {
      resp = await supabase.from('produtos_fiscais').update(campos).eq('id', form.id!).eq('user_id', user.id)
    }

    setSalvando(false)
    if (resp.error) {
      setErro(
        resp.error.code === '23505'
          ? 'Já existe um produto com esse código de barras.'
          : `Erro ao salvar: ${resp.error.message}`
      )
      return
    }
    setOpen(false)
    carregar()
  }

  async function alternarAtivo(p: Produto) {
    await supabase.from('produtos_fiscais').update({ ativo: !p.ativo }).eq('id', p.id)
    carregar()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produtos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Cadastre o produto uma vez. Fornecedor, custo e validade são informados na entrada de mercadoria.
          </p>
        </div>
        <Button onClick={abrirNovo}><Plus className="h-4 w-4 mr-1" />Novo produto</Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por nome, código de barras ou PLU" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
            Mostrar inativos
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">{loading ? 'Carregando...' : `${filtrados.length} produto(s)`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  {['Produto', 'Código de barras / PLU', 'Custo', 'Margem', 'Preço de venda', 'Estoque', ''].map((h, i) => (
                    <th key={i} className={cn('px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide', i >= 2 ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtrados.map((p) => (
                  <tr key={p.id} className={cn('hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors', !p.ativo && 'opacity-50')}>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {p.descricao}
                      {p.controla_validade && <span className="ml-2 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">validade</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400">
                      {p.barcode ?? (p.plu ? `PLU ${p.plu}` : '—')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(p.preco_custo)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{Number(p.margem_lucro ?? 0).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700 dark:text-green-400">{formatCurrency(p.preco_venda ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-bold', p.estoque <= p.estoque_minimo ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-800 dark:text-gray-200')}>{p.estoque}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => abrirEditar(p)} title="Editar"
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => alternarAtivo(p)} title={p.ativo ? 'Desativar' : 'Reativar'}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors">
                        {p.ativo ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filtrados.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center">
                    <Package className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 dark:text-gray-500">Nenhum produto encontrado</p>
                    <button onClick={abrirNovo} className="mt-3 text-emerald-600 font-medium text-sm hover:underline">Cadastrar primeiro produto</button>
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
            <DialogTitle>{modo === 'novo' ? 'Novo produto' : 'Editar produto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do produto *</label>
              <Input value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código de barras</label>
                <Input placeholder="Leia com o leitor ou digite" value={form.barcode || ''} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Sem código de barras, o sistema gera um PLU curto.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unidade</label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.unidade || 'UN'} onChange={(e) => setForm({ ...form, unidade: e.target.value })}>
                  {['UN', 'CX', 'KG', 'LT', 'MT', 'PC', 'PAR'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custo (R$)</label>
                <Input type="number" step="0.01" min="0" value={form.preco_custo || ''} onChange={(e) => setForm({ ...form, preco_custo: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Margem (%)</label>
                <Input type="number" step="1" min="0" max="999" value={form.margem_lucro ?? 0}
                  onChange={(e) => setForm({ ...form, margem_lucro: Math.max(0, Number(e.target.value)) })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preço de venda (R$)</label>
                <Input type="number" step="0.01" min="0" className="text-green-700 dark:text-green-400 font-semibold"
                  value={precoDoForm(form) || ''}
                  onChange={(e) => {
                    const preco = Number(e.target.value)
                    const custo = form.preco_custo ?? 0
                    if (custo > 0) setForm({ ...form, margem_lucro: Math.max(0, Math.round((preco / custo - 1) * 100)) })
                    else setForm({ ...form, preco_venda: preco })
                  }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estoque mínimo</label>
                <Input type="number" min="0" value={form.estoque_minimo ?? 0} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
                <input type="checkbox" checked={!!form.controla_validade} onChange={(e) => setForm({ ...form, controla_validade: e.target.checked })} />
                Controla validade
              </label>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</Button>
              <Button className="flex-1" onClick={salvar} disabled={salvando}>
                <Save className="h-4 w-4 mr-1" />{salvando ? 'Salvando...' : modo === 'novo' ? 'Cadastrar' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
