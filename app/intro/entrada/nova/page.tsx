'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getFornecedores } from '@/lib/supabase/fornecedores'
import { getIntroConfig } from '@/lib/intro/config'
import {
  COLUNAS_PRODUTO, criarProdutoRapido, encontrarDuplicado, hojeISO, type ProdutoIntro,
} from '@/lib/intro/produtos'
import { registrarEntrada, CONDICAO_LABEL, type CondicaoPagamento } from '@/lib/intro/entradas'
import type { Fornecedor } from '@/types'

interface Linha {
  produto: ProdutoIntro
  quantidade: number
  custo: number
  margem: number
  preco: number
  validade: string
}

const arred = (n: number) => Math.round(n * 100) / 100
const rotulo = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

const CONDICOES: { valor: CondicaoPagamento; titulo: string; texto: string }[] = [
  { valor: 'avista', titulo: 'À vista', texto: 'Já foi pago. Registra a conta como quitada.' },
  { valor: 'prazo', titulo: 'A prazo', texto: 'Gera contas a pagar com a data de vencimento.' },
  { valor: 'consignado', titulo: 'Consignado', texto: 'Só paga o que vender. Não gera conta agora.' },
]

export default function NovaEntradaPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState('')
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [produtos, setProdutos] = useState<ProdutoIntro[]>([])
  const [margemPadrao, setMargemPadrao] = useState(30)

  const [fornecedorId, setFornecedorId] = useState('')
  const [data, setData] = useState(hojeISO())
  const [documento, setDocumento] = useState('')
  const [condicao, setCondicao] = useState<CondicaoPagamento>('consignado')
  const [vencimento, setVencimento] = useState('')
  const [parcelas, setParcelas] = useState(1)
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])

  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [novoOpen, setNovoOpen] = useState(false)
  const [novo, setNovo] = useState({ descricao: '', barcode: '', unidade: 'UN', controla_validade: false })
  const [novoErro, setNovoErro] = useState('')
  const [duplicado, setDuplicado] = useState<ProdutoIntro | null>(null)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [forn, prods, cfg] = await Promise.all([
        getFornecedores(user.id, { ativo: true }),
        supabase.from('produtos_fiscais').select(COLUNAS_PRODUTO).eq('user_id', user.id).eq('ativo', true).is('deleted_at', null).order('descricao'),
        getIntroConfig(user.id),
      ])
      setFornecedores(forn)
      setProdutos((prods.data ?? []) as ProdutoIntro[])
      setMargemPadrao(Number(cfg.margem_padrao))
    }
    carregar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const termo = busca.trim().toLowerCase()
  const sugestoes = useMemo(() => {
    if (!termo) return []
    return produtos
      .filter((p) =>
        !linhas.some((l) => l.produto.id === p.id) &&
        (p.descricao.toLowerCase().includes(termo) || p.barcode === busca.trim() || p.plu === busca.trim()))
      .slice(0, 8)
  }, [termo, busca, produtos, linhas])

  function adicionar(p: ProdutoIntro) {
    const margem = Number(p.margem_lucro) > 0 ? Number(p.margem_lucro) : margemPadrao
    const custo = Number(p.preco_custo) || 0
    setLinhas((ls) => [
      ...ls,
      { produto: p, quantidade: 1, custo, margem, preco: custo > 0 ? arred(custo * (1 + margem / 100)) : 0, validade: '' },
    ])
    setBusca('')
  }

  // Leitor de código de barras "digita" o código e dá Enter: match exato adiciona direto.
  function aoDigitar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const t = busca.trim()
    const exato = produtos.find((p) => p.barcode === t || p.plu === t)
    if (exato && !linhas.some((l) => l.produto.id === exato.id)) adicionar(exato)
    else if (sugestoes.length === 1) adicionar(sugestoes[0])
  }

  function alterar(i: number, parcial: Partial<Linha>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...parcial } : l)))
  }

  function alterarCusto(i: number, custo: number) {
    const l = linhas[i]
    alterar(i, { custo, preco: custo > 0 ? arred(custo * (1 + l.margem / 100)) : l.preco })
  }
  function alterarMargem(i: number, margem: number) {
    const l = linhas[i]
    alterar(i, { margem, preco: l.custo > 0 ? arred(l.custo * (1 + margem / 100)) : l.preco })
  }
  function alterarPreco(i: number, preco: number) {
    const l = linhas[i]
    alterar(i, { preco, margem: l.custo > 0 ? Math.max(0, Math.round((preco / l.custo - 1) * 100)) : l.margem })
  }

  const total = linhas.reduce((s, l) => s + arred(l.quantidade * l.custo), 0)

  function fecharNovo() {
    setNovo({ descricao: '', barcode: '', unidade: 'UN', controla_validade: false })
    setDuplicado(null)
    setNovoOpen(false)
  }

  // O produto já existe: usa o cadastrado em vez de criar outro com o mesmo nome.
  function usarExistente(p: ProdutoIntro) {
    if (!linhas.some((l) => l.produto.id === p.id)) adicionar(p)
    fecharNovo()
  }

  async function cadastrarProduto(forcar = false) {
    setNovoErro('')
    const descricao = novo.descricao.trim()
    if (!descricao) { setNovoErro('Informe o nome do produto.'); return }
    const dup = forcar ? null : encontrarDuplicado(produtos, descricao)
    if (dup) { setDuplicado(dup); return }
    const { produto, erro } = await criarProdutoRapido(userId, {
      descricao,
      barcode: novo.barcode.trim() || null,
      unidade: novo.unidade,
      controla_validade: novo.controla_validade,
    })
    if (erro || !produto) { setNovoErro(erro ?? 'Erro ao cadastrar.'); return }
    setProdutos((ps) => [...ps, produto].sort((a, b) => a.descricao.localeCompare(b.descricao)))
    adicionar(produto)
    fecharNovo()
  }

  async function salvar() {
    setErro('')
    if (!fornecedorId) { setErro('Escolha o fornecedor.'); return }
    if (linhas.length === 0) { setErro('Adicione ao menos um produto.'); return }
    if (condicao === 'prazo' && !vencimento) { setErro('Informe o vencimento da primeira parcela.'); return }
    for (const l of linhas) {
      if (!(l.quantidade > 0)) { setErro(`Quantidade inválida: ${l.produto.descricao}`); return }
      if (!(l.custo > 0)) { setErro(`Informe o custo: ${l.produto.descricao}`); return }
      if (l.produto.controla_validade && !l.validade) { setErro(`Informe a validade: ${l.produto.descricao}`); return }
      if (l.validade && l.validade < data) { setErro(`Validade anterior à data da entrada: ${l.produto.descricao}`); return }
    }

    setSalvando(true)
    const { id, erro: erroApi } = await registrarEntrada({
      fornecedor_id: fornecedorId,
      data,
      numero_documento: documento,
      condicao_pagamento: condicao,
      vencimento: condicao === 'prazo' ? vencimento : null,
      parcelas: condicao === 'prazo' ? parcelas : 1,
      observacao,
      itens: linhas.map((l) => ({
        produto_id: l.produto.id,
        quantidade: l.quantidade,
        custo_unitario: l.custo,
        preco_venda: l.preco > 0 ? l.preco : null,
        validade: l.validade || null,
      })),
    })
    setSalvando(false)
    if (erroApi || !id) { setErro(erroApi ?? 'Erro ao salvar a entrada.'); return }
    router.push(`/intro/entrada/${id}`)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/intro/entrada" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nova entrada de mercadoria</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Registre o que o fornecedor entregou, o custo, a margem e como vai pagar.</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Fornecedor e condição de pagamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={rotulo}>Fornecedor *</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
                <option value="">Selecione...</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              {fornecedores.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nenhum fornecedor cadastrado. <Link href="/intro/fornecedores" className="underline">Cadastre um</Link>.</p>
              )}
            </div>
            <div>
              <label className={rotulo}>Data da entrada</label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CONDICOES.map((c) => (
              <button key={c.valor} type="button" onClick={() => setCondicao(c.valor)}
                className={cn('text-left rounded-xl border-2 p-3 transition-all',
                  condicao === c.valor ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300')}>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.titulo}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.texto}</p>
              </button>
            ))}
          </div>

          {condicao === 'prazo' && (
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className={rotulo}>1º vencimento *</label>
                <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
              </div>
              <div>
                <label className={rotulo}>Parcelas</label>
                <Input type="number" min={1} max={60} value={parcelas}
                  onChange={(e) => setParcelas(Math.min(60, Math.max(1, Math.round(Number(e.target.value)) || 1)))} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={rotulo}>Nº do documento (opcional)</label>
              <Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Nota, romaneio ou pedido" />
            </div>
            <div>
              <label className={rotulo}>Observação (opcional)</label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Produtos recebidos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Nome, código de barras (leitor) ou PLU" value={busca}
                onChange={(e) => setBusca(e.target.value)} onKeyDown={aoDigitar} />
              {sugestoes.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
                  {sugestoes.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => adicionar(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between gap-3">
                        <span className="text-gray-800 dark:text-gray-200">{p.descricao}</span>
                        <span className="font-mono text-xs text-gray-400">{p.barcode ?? (p.plu ? `PLU ${p.plu}` : '')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button type="button" variant="outline" onClick={() => { setNovo({ ...novo, descricao: busca }); setNovoErro(''); setNovoOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" />Cadastrar produto novo
            </Button>
          </div>

          {linhas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Busque um produto acima para adicioná-lo à entrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-2 text-left">Produto</th>
                    <th className="py-2 px-2 text-right w-24">Qtd</th>
                    <th className="py-2 px-2 text-right w-28">Custo (R$)</th>
                    <th className="py-2 px-2 text-right w-24">Margem %</th>
                    <th className="py-2 px-2 text-right w-28">Venda (R$)</th>
                    <th className="py-2 px-2 text-left w-40">Validade</th>
                    <th className="py-2 pl-2 text-right w-28">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {linhas.map((l, i) => (
                    <tr key={l.produto.id}>
                      <td className="py-2 pr-2 font-medium text-gray-800 dark:text-gray-200">
                        {l.produto.descricao}
                        <span className="ml-1 text-xs font-normal text-gray-400">({l.produto.unidade})</span>
                      </td>
                      <td className="py-2 px-2"><Input type="number" min="0" step="1" className="text-right h-9" value={l.quantidade || ''} onChange={(e) => alterar(i, { quantidade: Number(e.target.value) })} /></td>
                      <td className="py-2 px-2"><Input type="number" min="0" step="0.01" className="text-right h-9" value={l.custo || ''} onChange={(e) => alterarCusto(i, Number(e.target.value))} /></td>
                      <td className="py-2 px-2"><Input type="number" min="0" step="1" className="text-right h-9" value={l.margem} onChange={(e) => alterarMargem(i, Math.max(0, Number(e.target.value)))} /></td>
                      <td className="py-2 px-2"><Input type="number" min="0" step="0.01" className="text-right h-9 text-green-700 dark:text-green-400 font-semibold" value={l.preco || ''} onChange={(e) => alterarPreco(i, Number(e.target.value))} /></td>
                      <td className="py-2 px-2">
                        <Input type="date" className="h-9" value={l.validade} onChange={(e) => alterar(i, { validade: e.target.value })} />
                        {l.produto.controla_validade && !l.validade && <span className="text-[10px] text-amber-600">obrigatória</span>}
                      </td>
                      <td className="py-2 pl-2 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(arred(l.quantidade * l.custo))}</td>
                      <td className="py-2 pl-1">
                        <button type="button" title="Remover" onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div>
          <p className="text-xs text-gray-500">Total de custo ({CONDICAO_LABEL[condicao]})</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</p>
          {condicao === 'consignado' && <p className="text-xs text-gray-500">Nada é cobrado agora; você paga conforme vender.</p>}
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/intro/entrada')} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              <Save className="h-4 w-4 mr-1" />{salvando ? 'Salvando...' : 'Registrar entrada'}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={novoOpen} onOpenChange={(o) => { if (!o) fecharNovo(); else setNovoOpen(true) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cadastrar produto novo</DialogTitle></DialogHeader>
          {duplicado ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Já existe um produto chamado <strong>{duplicado.descricao}</strong>
                {duplicado.barcode ? ` (código ${duplicado.barcode})` : duplicado.plu ? ` (PLU ${duplicado.plu})` : ''}, com estoque de {Number(duplicado.estoque)}.
                É o mesmo produto?
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={() => usarExistente(duplicado)}>Sim, usar o produto que já existe</Button>
                <Button variant="outline" onClick={() => cadastrarProduto(true)}>Não, é outro produto: cadastrar mesmo assim</Button>
                <Button variant="ghost" onClick={() => setDuplicado(null)}>Voltar</Button>
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            <div>
              <label className={rotulo}>Nome do produto *</label>
              <Input value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={rotulo}>Código de barras</label>
                <Input value={novo.barcode} onChange={(e) => setNovo({ ...novo, barcode: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <label className={rotulo}>Unidade</label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })}>
                  {['UN', 'CX', 'KG', 'LT', 'MT', 'PC', 'PAR'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={novo.controla_validade} onChange={(e) => setNovo({ ...novo, controla_validade: e.target.checked })} />
              Controla validade
            </label>
            {novoErro && <p className="text-sm text-red-600">{novoErro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={fecharNovo}>Cancelar</Button>
              <Button className="flex-1" onClick={() => cadastrarProduto()}>Cadastrar e adicionar</Button>
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
