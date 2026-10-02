'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Package, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getIntroConfig } from '@/lib/intro/config'
import { COLUNAS_PRODUTO, type ProdutoIntro } from '@/lib/intro/produtos'
import { carregarSaldosPorProduto } from '@/lib/intro/estoque'
import { ProdutoFormDialog } from '@/components/intro/produto-form'
import { AjusteEstoqueDialog } from '@/components/intro/ajuste-estoque-dialog'

// Catálogo do Intro: mesma tabela do SyncroMoney padrão (produtos_fiscais), sem campos fiscais
// (NCM/CFOP). O estoque mostrado é o saldo REAL em tempo real (lotes menos vendas sem estoque).
// Para mexer nele: Entrada de mercadoria, ou "Ajustar estoque" dentro do cadastro do produto.
export default function IntroProdutosPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<ProdutoIntro[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [margemPadrao, setMargemPadrao] = useState(30)
  const [form, setForm] = useState<{ modo: 'novo' | 'editar'; produto: ProdutoIntro | null } | null>(null)
  const [ajuste, setAjuste] = useState<ProdutoIntro | null>(null)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data }, cfg, sal] = await Promise.all([
      supabase
        .from('produtos_fiscais')
        .select(COLUNAS_PRODUTO)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('descricao'),
      getIntroConfig(user.id),
      carregarSaldosPorProduto(user.id).catch(() => ({} as Record<string, number>)),
    ])
    setProdutos((data ?? []) as ProdutoIntro[])
    setMargemPadrao(Number(cfg.margem_padrao))
    setSaldos(sal)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const saldoDe = (p: ProdutoIntro) => saldos[p.id] ?? 0

  const termo = busca.trim().toLowerCase()
  const filtrados = produtos.filter((p) =>
    (mostrarInativos || p.ativo) &&
    (!termo ||
      p.descricao.toLowerCase().includes(termo) ||
      (p.barcode ?? '').includes(termo) ||
      (p.plu ?? '').includes(termo))
  )

  async function alternarAtivo(p: ProdutoIntro) {
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
        <Button onClick={() => setForm({ modo: 'novo', produto: null })}><Plus className="h-4 w-4 mr-1" />Novo produto</Button>
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
                {filtrados.map((p) => {
                  const saldo = saldoDe(p)
                  return (
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
                        <span className={cn('font-bold',
                          saldo < 0 ? 'text-red-600' : p.estoque_minimo > 0 && saldo <= p.estoque_minimo ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-800 dark:text-gray-200')}>
                          {saldo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setForm({ modo: 'editar', produto: p })} title="Editar"
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => alternarAtivo(p)} title={p.ativo ? 'Desativar' : 'Reativar'}
                          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors">
                          {p.ativo ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!loading && filtrados.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center">
                    <Package className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 dark:text-gray-500">Nenhum produto encontrado</p>
                    <button onClick={() => setForm({ modo: 'novo', produto: null })} className="mt-3 text-emerald-600 font-medium text-sm hover:underline">Cadastrar primeiro produto</button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {form && (
        <ProdutoFormDialog
          key={form.produto?.id ?? 'novo'}
          modo={form.modo}
          inicial={form.produto}
          produtosExistentes={produtos}
          margemPadrao={margemPadrao}
          estoqueAtual={form.produto ? saldoDe(form.produto) : 0}
          onAjustarEstoque={form.produto ? () => setAjuste(form.produto) : undefined}
          onClose={() => setForm(null)}
          onSalvo={() => { setForm(null); carregar() }}
          // nome repetido: abre o cadastro do produto que já existe
          onUsarExistente={(p) => setForm({ modo: 'editar', produto: p })}
          rotuloUsarExistente="Sim, abrir o produto que já existe"
        />
      )}

      {ajuste && (
        <AjusteEstoqueDialog
          produto={{ id: ajuste.id, descricao: ajuste.descricao, unidade: ajuste.unidade }}
          atual={saldoDe(ajuste)}
          onClose={() => setAjuste(null)}
          onAjustado={() => { setAjuste(null); carregar() }}
        />
      )}
    </div>
  )
}
