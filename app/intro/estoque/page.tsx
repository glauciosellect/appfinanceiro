'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Boxes, SlidersHorizontal } from 'lucide-react'
import { AjusteEstoqueDialog } from '@/components/intro/ajuste-estoque-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getIntroConfig } from '@/lib/intro/config'
import { ajustarLote } from '@/lib/intro/entradas'
import {
  carregarLotesComSaldo, carregarPendencias, diasParaVencer, situacaoValidade, type LoteEstoque,
} from '@/lib/intro/estoque'

type Aba = 'total' | 'fornecedor' | 'lotes'

interface ProdutoMin { id: string; descricao: string; unidade: string; estoque_minimo: number; preco_venda: number }

const arred = (n: number) => Math.round(n * 100) / 100

export default function EstoquePage() {
  const [aba, setAba] = useState<Aba>('total')
  const [lotes, setLotes] = useState<LoteEstoque[]>([])
  const [pend, setPend] = useState<Record<string, number>>({})
  const [produtos, setProdutos] = useState<ProdutoMin[]>([])
  const [diasAlerta, setDiasAlerta] = useState(15)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [fornecedorSel, setFornecedorSel] = useState('')
  const [somenteAlerta, setSomenteAlerta] = useState(false)

  const [ajuste, setAjuste] = useState<LoteEstoque | null>(null)
  // ajuste do estoque do produto inteiro (regulariza saldo negativo, contagem, perdas)
  const [ajusteProduto, setAjusteProduto] = useState<{ id: string; descricao: string; unidade: string; atual: number } | null>(null)
  const [delta, setDelta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [ajusteErro, setAjusteErro] = useState('')
  const [ajustando, setAjustando] = useState(false)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      const [ls, ps, cfg, pe] = await Promise.all([
        carregarLotesComSaldo(user.id),
        supabase.from('produtos_fiscais').select('id, descricao, unidade, estoque_minimo, preco_venda').eq('user_id', user.id).eq('ativo', true).is('deleted_at', null).order('descricao'),
        getIntroConfig(user.id),
        carregarPendencias(user.id).catch(() => ({} as Record<string, number>)),
      ])
      setLotes(ls)
      setPend(pe)
      setProdutos((ps.data ?? []) as ProdutoMin[])
      setDiasAlerta(cfg.dias_alerta_validade)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar o estoque.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const valorCusto = (ls: LoteEstoque[]) => arred(ls.reduce((s, l) => s + Number(l.qtd_saldo) * Number(l.custo_unitario), 0))
  const valorVenda = (ls: LoteEstoque[]) => arred(ls.reduce((s, l) => s + Number(l.qtd_saldo) * Number(l.produtos_fiscais?.preco_venda ?? 0), 0))
  const unidades = (ls: LoteEstoque[]) => ls.reduce((s, l) => s + Number(l.qtd_saldo), 0)

  const vencidos = lotes.filter((l) => situacaoValidade(l.validade, diasAlerta) === 'vencido')
  const vencendo = lotes.filter((l) => situacaoValidade(l.validade, diasAlerta) === 'vencendo')

  // Total da loja: um registro por produto (inclui produtos sem saldo)
  const porProduto = useMemo(() => {
    return produtos.map((p) => {
      const ls = lotes.filter((l) => l.produto_id === p.id)
      // Vendas feitas sem estoque deixam o saldo negativo até a próxima entrada
      const semEstoque = pend[p.id] ?? 0
      const saldo = unidades(ls) - semEstoque
      return {
        semEstoque,
        ...p,
        saldo,
        proprio: unidades(ls.filter((l) => !l.consignado)),
        consignado: unidades(ls.filter((l) => l.consignado)),
        custo: valorCusto(ls),
        venda: valorVenda(ls),
        baixo: Number(p.estoque_minimo) > 0 && saldo <= Number(p.estoque_minimo),
        alerta: ls.some((l) => ['vencido', 'vencendo'].includes(situacaoValidade(l.validade, diasAlerta))),
      }
    })
  }, [produtos, lotes, diasAlerta, pend])

  const linhasTotal = porProduto.filter((p) => !somenteAlerta || p.baixo || p.alerta)

  // Por fornecedor
  const fornecedores = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string }>()
    lotes.forEach((l) => mapa.set(l.fornecedor_id, { id: l.fornecedor_id, nome: l.fornecedores?.nome ?? '—' }))
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [lotes])

  const lotesDoFornecedor = lotes.filter((l) => l.fornecedor_id === fornecedorSel)
  const produtosDoFornecedor = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; unidade: string; ls: LoteEstoque[] }>()
    lotesDoFornecedor.forEach((l) => {
      const m = mapa.get(l.produto_id) ?? { id: l.produto_id, nome: l.produtos_fiscais?.descricao ?? '—', unidade: l.produtos_fiscais?.unidade ?? '', ls: [] }
      m.ls.push(l)
      mapa.set(l.produto_id, m)
    })
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotes, fornecedorSel])

  async function confirmarAjuste() {
    if (!ajuste) return
    setAjusteErro('')
    const n = Number(delta.replace(',', '.'))
    if (!n) { setAjusteErro('Informe a quantidade (use sinal negativo para retirar).'); return }
    setAjustando(true)
    const msg = await ajustarLote(ajuste.id, n, motivo)
    setAjustando(false)
    if (msg) { setAjusteErro(msg); return }
    setAjuste(null); setDelta(''); setMotivo('')
    carregar()
  }

  function selo(l: LoteEstoque) {
    const s = situacaoValidade(l.validade, diasAlerta)
    if (s === 'vencido') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">Vencido</span>
    if (s === 'vencendo') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Vence em {diasParaVencer(l.validade!)}d</span>
    return null
  }

  const abas: { id: Aba; label: string }[] = [
    { id: 'total', label: 'Total da loja' },
    { id: 'fornecedor', label: 'Por fornecedor' },
    { id: 'lotes', label: 'Lotes e validade' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">O que há na loja, de quem é e até quando vale.</p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { t: 'Unidades em estoque', v: String(unidades(lotes)) },
          { t: 'Valor a custo', v: formatCurrency(valorCusto(lotes)) },
          { t: 'Valor de venda', v: formatCurrency(valorVenda(lotes)) },
          { t: 'Consignado na loja (custo)', v: formatCurrency(valorCusto(lotes.filter((l) => l.consignado))) },
        ].map((c) => (
          <Card key={c.t}><CardContent className="py-4">
            <p className="text-xs text-gray-500">{c.t}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{c.v}</p>
          </CardContent></Card>
        ))}
      </div>

      {(vencidos.length > 0 || vencendo.length > 0) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {vencidos.length > 0 && <><strong>{vencidos.length}</strong> lote(s) vencido(s). </>}
            {vencendo.length > 0 && <><strong>{vencendo.length}</strong> lote(s) vencem em até {diasAlerta} dias. </>}
            Veja a aba “Lotes e validade”.
          </p>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {abas.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              aba === a.id ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'total' && (
        <Card><CardContent className="p-0">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={somenteAlerta} onChange={(e) => setSomenteAlerta(e.target.checked)} />
              Mostrar só estoque baixo ou com validade em alerta
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left">Produto</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Próprio</th>
                  <th className="px-4 py-3 text-right">Consignado</th>
                  <th className="px-4 py-3 text-right">Valor custo</th>
                  <th className="px-4 py-3 text-right">Valor venda</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {linhasTotal.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {p.descricao}
                      {p.semEstoque > 0 && <span className="ml-2 text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full">vendido sem estoque</span>}
                      {p.baixo && p.semEstoque === 0 && <span className="ml-2 text-[10px] font-semibold text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full">estoque baixo</span>}
                      {p.alerta && <span className="ml-2 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">validade</span>}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-bold', p.saldo < 0 && 'text-red-600')}>{p.saldo} {p.unidade}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.proprio}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.consignado}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.custo)}</td>
                    <td className="px-4 py-3 text-right text-green-700 dark:text-green-400">{formatCurrency(p.venda)}</td>
                    <td className="px-2 text-right">
                      <Button size="sm" variant={p.saldo < 0 ? 'default' : 'outline'} onClick={() => setAjusteProduto({ id: p.id, descricao: p.descricao, unidade: p.unidade, atual: p.saldo })}>
                        Ajustar
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && linhasTotal.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center">
                    <Boxes className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400">Nenhum produto para mostrar.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {aba === 'fornecedor' && (
        <div className="space-y-4">
          <select className="w-full sm:w-80 h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={fornecedorSel} onChange={(e) => setFornecedorSel(e.target.value)}>
            <option value="">Todos os fornecedores (resumo)</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>

          {!fornecedorSel ? (
            <Card><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left">Fornecedor</th>
                    <th className="px-4 py-3 text-right">Unidades</th>
                    <th className="px-4 py-3 text-right">Consignado</th>
                    <th className="px-4 py-3 text-right">Valor custo</th>
                    <th className="px-4 py-3 text-right">Valor venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {fornecedores.map((f) => {
                    const ls = lotes.filter((l) => l.fornecedor_id === f.id)
                    return (
                      <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => setFornecedorSel(f.id)}>
                        <td className="px-4 py-3 font-medium text-emerald-700 dark:text-emerald-400">{f.nome}</td>
                        <td className="px-4 py-3 text-right font-bold">{unidades(ls)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{unidades(ls.filter((l) => l.consignado))}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(valorCusto(ls))}</td>
                        <td className="px-4 py-3 text-right text-green-700">{formatCurrency(valorVenda(ls))}</td>
                      </tr>
                    )
                  })}
                  {!loading && fornecedores.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Nenhum fornecedor com estoque na loja.</td></tr>
                  )}
                  {fornecedores.length > 0 && (
                    <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold">
                      <td className="px-4 py-3">Total da loja</td>
                      <td className="px-4 py-3 text-right">{unidades(lotes)}</td>
                      <td className="px-4 py-3 text-right">{unidades(lotes.filter((l) => l.consignado))}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(valorCusto(lotes))}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(valorVenda(lotes))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div></CardContent></Card>
          ) : (
            <Card><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 text-left">Produto</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Consignado</th>
                    <th className="px-4 py-3 text-right">Valor custo</th>
                    <th className="px-4 py-3 text-right">Valor venda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {produtosDoFornecedor.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{p.nome}</td>
                      <td className="px-4 py-3 text-right font-bold">{unidades(p.ls)} {p.unidade}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{unidades(p.ls.filter((l) => l.consignado))}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(valorCusto(p.ls))}</td>
                      <td className="px-4 py-3 text-right text-green-700">{formatCurrency(valorVenda(p.ls))}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/50 font-bold">
                    <td className="px-4 py-3">Total do fornecedor</td>
                    <td className="px-4 py-3 text-right">{unidades(lotesDoFornecedor)}</td>
                    <td className="px-4 py-3 text-right">{unidades(lotesDoFornecedor.filter((l) => l.consignado))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(valorCusto(lotesDoFornecedor))}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(valorVenda(lotesDoFornecedor))}</td>
                  </tr>
                </tbody>
              </table>
            </div></CardContent></Card>
          )}
        </div>
      )}

      {aba === 'lotes' && (
        <Card><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Fornecedor</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Custo</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {lotes.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{l.produtos_fiscais?.descricao}</td>
                  <td className="px-4 py-3 text-gray-600">{l.fornecedores?.nome}</td>
                  <td className="px-4 py-3">{l.validade ? formatDate(l.validade) : '—'} {selo(l)}</td>
                  <td className="px-4 py-3 text-right font-bold">{Number(l.qtd_saldo)} <span className="text-xs font-normal text-gray-400">de {Number(l.qtd_inicial)}</span></td>
                  <td className="px-4 py-3 text-right">{formatCurrency(Number(l.custo_unitario))}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', l.consignado ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                      {l.consignado ? 'Consignado' : 'Próprio'}
                    </span>
                  </td>
                  <td className="px-2">
                    <button title="Ajustar saldo" onClick={() => { setAjuste(l); setDelta(''); setMotivo(''); setAjusteErro('') }}
                      className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg"><SlidersHorizontal className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!loading && lotes.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Nenhum lote em estoque. Registre uma entrada de mercadoria.</td></tr>
              )}
            </tbody>
          </table>
        </div></CardContent></Card>
      )}

      {ajusteProduto && (
        <AjusteEstoqueDialog
          produto={ajusteProduto}
          atual={ajusteProduto.atual}
          onClose={() => setAjusteProduto(null)}
          onAjustado={() => { setAjusteProduto(null); carregar() }}
        />
      )}

      <Dialog open={!!ajuste} onOpenChange={(o) => !o && setAjuste(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ajustar saldo do lote</DialogTitle></DialogHeader>
          {ajuste && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {ajuste.produtos_fiscais?.descricao} · {ajuste.fornecedores?.nome} · saldo atual <strong>{Number(ajuste.qtd_saldo)}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantidade a somar ou retirar</label>
                <Input type="number" step="1" placeholder="Ex.: -2 para retirar 2 unidades" value={delta} onChange={(e) => setDelta(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo *</label>
                <Input placeholder="Perda, quebra, vencido, contagem..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              {ajusteErro && <p className="text-sm text-red-600">{ajusteErro}</p>}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setAjuste(null)} disabled={ajustando}>Cancelar</Button>
                <Button className="flex-1" onClick={confirmarAjuste} disabled={ajustando}>{ajustando ? 'Salvando...' : 'Confirmar ajuste'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
