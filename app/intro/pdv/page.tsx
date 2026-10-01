'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Clock, Minus, Pause, Plus, Receipt, Search, Share2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getSessaoAbertaHoje } from '@/lib/supabase/caixa'
import { getIntroConfig, type IntroConfig } from '@/lib/intro/config'
import { COLUNAS_PRODUTO, hojeISO, type ProdutoIntro } from '@/lib/intro/produtos'
import {
  FORMAS_PAGAMENTO, cancelarVendaIntro, compartilharTexto, excluirVendaEmEspera, listarVendasDaSessao,
  listarVendasEmEspera, salvarVenda, textoComprovante,
  type FormaPagamentoIntro, type VendaDoDia, type VendaEmEspera,
} from '@/lib/intro/vendas'
import type { CaixaSessao } from '@/types'

interface ItemCarrinho {
  produto: ProdutoIntro
  quantidade: number
  preco: number
}

interface LinhaPagamento {
  forma: FormaPagamentoIntro
  valor: string      // quanto da venda é quitado nesta forma
  recebido: string   // só dinheiro: valor entregue pelo cliente
  parcelas: number   // só crédito
}

interface ClienteMin { id: string; nome: string }

const arred = (n: number) => Math.round(n * 100) / 100
const num = (s: string) => Number(String(s).replace(',', '.')) || 0

export default function IntroPdvPage() {
  const supabase = createClient()
  const buscaRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState('')
  const [sessao, setSessao] = useState<CaixaSessao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [produtos, setProdutos] = useState<ProdutoIntro[]>([])
  const [clientes, setClientes] = useState<ClienteMin[]>([])
  const [config, setConfig] = useState<IntroConfig | null>(null)

  const [busca, setBusca] = useState('')
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [descontoGeral, setDescontoGeral] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [vendaEsperaId, setVendaEsperaId] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  // pagamento
  const [pagOpen, setPagOpen] = useState(false)
  const [linhasPag, setLinhasPag] = useState<LinhaPagamento[]>([])
  const [vencFiado, setVencFiado] = useState('')
  const [pagErro, setPagErro] = useState('')
  const [finalizando, setFinalizando] = useState(false)

  // venda concluída
  const [concluida, setConcluida] = useState<{ venda: VendaDoDia; troco: number; semEstoque: { produto: string; quantidade: number }[] } | null>(null)

  // espera / vendas do dia
  const [esperaOpen, setEsperaOpen] = useState(false)
  const [esperas, setEsperas] = useState<VendaEmEspera[]>([])
  const [pausarOpen, setPausarOpen] = useState(false)
  const [identificador, setIdentificador] = useState('')
  const [diaOpen, setDiaOpen] = useState(false)
  const [vendasDia, setVendasDia] = useState<VendaDoDia[]>([])

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [s, prods, cli, cfg] = await Promise.all([
      getSessaoAbertaHoje(user.id).catch(() => null),
      supabase.from('produtos_fiscais').select(COLUNAS_PRODUTO).eq('user_id', user.id).eq('ativo', true).is('deleted_at', null).order('descricao'),
      supabase.from('clientes').select('id, nome').eq('user_id', user.id).eq('ativo', true).order('nome'),
      getIntroConfig(user.id),
    ])
    setSessao(s)
    setProdutos((prods.data ?? []) as ProdutoIntro[])
    setClientes((cli.data ?? []) as ClienteMin[])
    setConfig(cfg)
    setCarregando(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Arredonda por item, igual ao banco, para o total bater centavo a centavo
  const subtotal = arred(carrinho.reduce((s, i) => s + arred(i.quantidade * i.preco), 0))
  const desconto = Math.min(Math.max(0, num(descontoGeral)), subtotal)
  const total = arred(subtotal - desconto)

  const termo = busca.trim().toLowerCase()
  const resultados = useMemo(() => {
    if (!termo) return []
    return produtos
      .filter((p) => p.descricao.toLowerCase().includes(termo) || p.barcode === busca.trim() || p.plu === busca.trim())
      .slice(0, 12)
  }, [termo, busca, produtos])

  function adicionar(p: ProdutoIntro) {
    setAviso('')
    if (!(Number(p.preco_venda) > 0)) {
      setAviso(`"${p.descricao}" está sem preço de venda. Ajuste em Produtos.`)
      return
    }
    setCarrinho((c) => {
      const i = c.findIndex((x) => x.produto.id === p.id)
      if (i >= 0) return c.map((x, idx) => (idx === i ? { ...x, quantidade: x.quantidade + 1 } : x))
      return [...c, { produto: p, quantidade: 1, preco: Number(p.preco_venda) }]
    })
    setBusca('')
    buscaRef.current?.focus()
  }

  // Leitor de código de barras digita o código e envia Enter: match exato adiciona direto.
  function aoDigitar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const t = busca.trim()
    if (!t) return
    const exato = produtos.find((p) => p.barcode === t || p.plu === t)
    if (exato) adicionar(exato)
    else if (resultados.length === 1) adicionar(resultados[0])
    else setAviso('Produto não encontrado.')
  }

  function alterarQtd(i: number, q: number) {
    if (q <= 0) setCarrinho((c) => c.filter((_, idx) => idx !== i))
    else setCarrinho((c) => c.map((x, idx) => (idx === i ? { ...x, quantidade: q } : x)))
  }

  function limparVenda() {
    setCarrinho([])
    setDescontoGeral('')
    setClienteId('')
    setVendaEsperaId(null)
    setAviso('')
    setBusca('')
    buscaRef.current?.focus()
  }

  function payloadItens() {
    return carrinho.map((i) => ({
      produto_id: i.produto.id,
      quantidade: i.quantidade,
      preco_unitario: i.preco,
      desconto_item: 0,
    }))
  }

  // ---------- Venda em espera ----------
  async function pausar() {
    const { resultado, erro } = await salvarVenda({
      venda_id: vendaEsperaId,
      modo: 'espera',
      identificador,
      cliente_id: clienteId || null,
      desconto,
      itens: payloadItens(),
    })
    if (erro || !resultado) { setAviso(erro ?? 'Erro ao pausar a venda.'); setPausarOpen(false); return }
    setPausarOpen(false)
    setIdentificador('')
    limparVenda()
  }

  async function abrirEsperas() {
    setEsperas(await listarVendasEmEspera(userId).catch(() => []))
    setEsperaOpen(true)
  }

  function retomar(v: VendaEmEspera) {
    const itens: ItemCarrinho[] = []
    for (const it of v.vendas_itens) {
      const p = produtos.find((x) => x.id === it.produto_id)
      if (p) itens.push({ produto: p, quantidade: Number(it.quantidade), preco: Number(it.preco_unitario) })
    }
    setCarrinho(itens)
    setDescontoGeral(Number(v.desconto) > 0 ? String(v.desconto) : '')
    setClienteId(v.cliente_id ?? '')
    setVendaEsperaId(v.id)
    setEsperaOpen(false)
    if (itens.length < v.vendas_itens.length) setAviso('Alguns produtos da venda em espera não existem mais e foram removidos.')
  }

  async function descartarEspera(id: string) {
    if (!confirm('Descartar esta venda em espera?')) return
    await excluirVendaEmEspera(userId, id)
    if (vendaEsperaId === id) limparVenda()
    setEsperas((e) => e.filter((x) => x.id !== id))
  }

  // ---------- Pagamento ----------
  function abrirPagamento() {
    if (carrinho.length === 0) return
    setPagErro('')
    setVencFiado('')
    setLinhasPag([])
    setPagOpen(true)
  }

  const somaPag = arred(linhasPag.reduce((s, l) => s + num(l.valor), 0))
  const faltando = arred(total - somaPag)

  // Escolher a forma já preenche o valor: sem nada escolhido, vem o total (pagamento único);
  // se já falta pagar parte, vem o que falta. Se uma única forma já cobre tudo, escolher
  // outra apenas TROCA a forma (para dividir, reduza o valor da primeira antes).
  function adicionarForma(forma: FormaPagamentoIntro) {
    setPagErro('')
    setLinhasPag((ls) => {
      const soma = arred(ls.reduce((acc, l) => acc + num(l.valor), 0))
      const falta = arred(total - soma)
      if (ls.length === 1 && falta <= 0.005) {
        return ls[0].forma === forma ? ls : [{ forma, valor: String(total), recebido: '', parcelas: 1 }]
      }
      return [...ls, { forma, valor: falta > 0 ? String(falta) : '', recebido: '', parcelas: 1 }]
    })
  }

  // Enter conclui a venda (menos em listas de seleção); nos botões de forma de pagamento
  // o Enter também conclui, em vez de repetir o clique.
  function aoTeclarPagamento(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || finalizando) return
    const alvo = e.target as HTMLElement
    if (alvo.tagName === 'SELECT' || alvo.tagName === 'TEXTAREA') return
    if (alvo.tagName === 'BUTTON' && !alvo.hasAttribute('data-forma')) return
    e.preventDefault()
    finalizar()
  }
  function alterarLinha(i: number, parcial: Partial<LinhaPagamento>) {
    setLinhasPag((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...parcial } : l)))
  }
  function trocoDaLinha(l: LinhaPagamento): number {
    if (l.forma !== 'Dinheiro' || !l.recebido) return 0
    return Math.max(0, arred(num(l.recebido) - num(l.valor)))
  }
  const trocoTotal = arred(linhasPag.reduce((s, l) => s + trocoDaLinha(l), 0))

  async function finalizar() {
    setPagErro('')
    if (Math.abs(faltando) > 0.005) { setPagErro(faltando > 0 ? `Faltam ${formatCurrency(faltando)}.` : `Pagamento excede o total em ${formatCurrency(-faltando)}.`); return }
    for (const l of linhasPag) {
      if (!(num(l.valor) > 0)) { setPagErro('Remova ou preencha as formas de pagamento sem valor.'); return }
      if (l.forma === 'Dinheiro' && l.recebido && num(l.recebido) < num(l.valor)) { setPagErro('O valor recebido em dinheiro é menor que o valor a pagar.'); return }
    }
    if (linhasPag.some((l) => l.forma === 'Fiado') && !clienteId) { setPagErro('Escolha o cliente para vender fiado.'); return }

    setFinalizando(true)
    const { resultado, erro } = await salvarVenda({
      venda_id: vendaEsperaId,
      modo: 'concluir',
      cliente_id: clienteId || null,
      desconto,
      vencimento_fiado: vencFiado || null,
      itens: payloadItens(),
      pagamentos: linhasPag.map((l) => ({
        forma: l.forma,
        valor: num(l.valor),
        troco: trocoDaLinha(l),
        parcelas: l.forma === 'Cartão de Crédito' ? l.parcelas : null,
      })),
    })
    setFinalizando(false)
    if (erro || !resultado) { setPagErro(erro ?? 'Erro ao concluir a venda.'); return }

    const vendas = await listarVendasDaSessao(userId, sessao!.id).catch(() => [])
    const venda = vendas.find((v) => v.id === resultado.venda_id)
    setPagOpen(false)
    if (venda) setConcluida({ venda, troco: trocoTotal, semEstoque: resultado.sem_estoque ?? [] })
    // atualiza saldo de estoque exibido
    const { data } = await supabase.from('produtos_fiscais').select(COLUNAS_PRODUTO).eq('user_id', userId).eq('ativo', true).is('deleted_at', null).order('descricao')
    setProdutos((data ?? []) as ProdutoIntro[])
    limparVenda()
  }

  async function compartilhar(v: VendaDoDia) {
    const r = await compartilharTexto(`Venda ${v.numero_sequencial}`, textoComprovante(config ?? { nome_loja: '', cnpj_cpf: '', telefone: '' }, v))
    setAviso(r === 'copiado' ? 'Comprovante copiado.' : r === 'falhou' ? 'Não foi possível compartilhar.' : '')
  }

  // ---------- Vendas do dia ----------
  async function abrirVendasDia() {
    if (!sessao) return
    setVendasDia(await listarVendasDaSessao(userId, sessao.id).catch(() => []))
    setDiaOpen(true)
  }

  async function cancelarVenda(v: VendaDoDia) {
    const motivo = prompt(`Cancelar a venda ${v.numero_sequencial}? Informe o motivo:`)
    if (!motivo || !motivo.trim()) return
    const erro = await cancelarVendaIntro(v.id, motivo.trim())
    if (erro) { alert(erro); return }
    setVendasDia((vs) => vs.filter((x) => x.id !== v.id))
    carregar()
  }

  // ---------- Telas de estado ----------
  if (carregando) return <p className="text-sm text-gray-500">Carregando...</p>

  if (!sessao) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <Receipt className="h-12 w-12 text-gray-300 mx-auto" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Caixa fechado</h1>
        <p className="text-sm text-gray-500">Abra o caixa do dia para começar a vender.</p>
        <Button asChild><Link href="/intro/caixa">Abrir o caixa</Link></Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PDV</h1>
          <p className="text-xs text-gray-500">Caixa aberto por {sessao.operador}{vendaEsperaId ? ' · retomando venda em espera' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={abrirEsperas}><Clock className="h-4 w-4 mr-1" />Em espera</Button>
          <Button variant="outline" size="sm" onClick={abrirVendasDia}><Receipt className="h-4 w-4 mr-1" />Vendas do dia</Button>
        </div>
      </div>

      {aviso && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <span>{aviso}</span>
          <button onClick={() => setAviso('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Busca */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input ref={buscaRef} autoFocus className="pl-9 h-12 text-base" placeholder="Código de barras, PLU ou nome"
              value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={aoDigitar} />
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
            {resultados.map((p) => (
              <button key={p.id} onClick={() => adicionar(p)} className="w-full text-left px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{p.descricao}</p>
                  <p className="text-xs text-gray-400">{p.barcode ?? (p.plu ? `PLU ${p.plu}` : '')} · estoque {Number(p.estoque)}</p>
                </div>
                <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(Number(p.preco_venda))}</span>
              </button>
            ))}
            {termo && resultados.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">Nenhum produto encontrado.</p>}
            {!termo && <p className="px-4 py-6 text-sm text-gray-400 text-center">Leia o código de barras ou digite o nome do produto.</p>}
          </div>
        </div>

        {/* Carrinho */}
        <div className="lg:col-span-3 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex-1 min-h-[240px] max-h-[50vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {carrinho.length === 0 && <p className="text-center text-sm text-gray-400 py-16">Nenhum item na venda.</p>}
            {carrinho.map((it, i) => (
              <div key={it.produto.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{it.produto.descricao}</p>
                  <p className="text-xs text-gray-400">{formatCurrency(it.preco)} cada{it.quantidade > Number(it.produto.estoque) && <span className="text-amber-600"> · estoque {Number(it.produto.estoque)}: a venda deixa o saldo negativo</span>}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => alterarQtd(i, it.quantidade - 1)} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Minus className="h-3.5 w-3.5" /></button>
                  <Input type="number" min="0" step="1" className="h-8 w-16 text-center px-1" value={it.quantidade}
                    onChange={(e) => alterarQtd(i, Number(e.target.value))} />
                  <button onClick={() => alterarQtd(i, it.quantidade + 1)} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /></button>
                </div>
                <p className="w-24 text-right font-bold text-gray-900 dark:text-white">{formatCurrency(arred(it.quantidade * it.preco))}</p>
                <button onClick={() => alterarQtd(i, 0)} title="Remover item" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Cliente (opcional)</label>
                <select className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Sem cliente</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Desconto (R$)</label>
                <Input type="number" min="0" step="0.01" className="h-9" value={descontoGeral} onChange={(e) => setDescontoGeral(e.target.value)} />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-sm text-gray-500">
                {carrinho.length} item(ns) · subtotal {formatCurrency(subtotal)}
                {desconto > 0 && <> · desconto {formatCurrency(desconto)}</>}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">TOTAL</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(total)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { setIdentificador(''); setPausarOpen(true) }} disabled={carrinho.length === 0}><Pause className="h-4 w-4 mr-1" />Pausar</Button>
              <Button variant="outline" onClick={() => { if (carrinho.length === 0 || confirm('Cancelar esta venda?')) limparVenda() }} disabled={carrinho.length === 0 && !vendaEsperaId}>Cancelar venda</Button>
              <Button className="flex-1 h-11 text-base bg-emerald-600 hover:bg-emerald-500" onClick={abrirPagamento} disabled={carrinho.length === 0 || total <= 0}>
                <Check className="h-5 w-5 mr-1" />Finalizar venda
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Pagamento */}
      <Dialog open={pagOpen} onOpenChange={(o) => !finalizando && setPagOpen(o)}>
        <DialogContent className="max-w-lg" onKeyDown={aoTeclarPagamento}>
          <DialogHeader><DialogTitle>Pagamento — {formatCurrency(total)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {linhasPag.length === 0
                  ? 'Como o cliente vai pagar? Escolha a forma e tecle Enter para concluir.'
                  : 'Para dividir o pagamento, reduza o valor acima e escolha outra forma.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FORMAS_PAGAMENTO.map((f) => {
                  const ativa = linhasPag.some((l) => l.forma === f)
                  return (
                    <Button key={f} type="button" data-forma={f} variant={ativa ? 'default' : 'outline'}
                      className={cn(ativa && 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600')}
                      onClick={() => adicionarForma(f)}>
                      {f}
                    </Button>
                  )
                })}
              </div>
            </div>

            {linhasPag.map((l, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{l.forma}</span>
                  <button onClick={() => setLinhasPag((ls) => ls.filter((_, idx) => idx !== i))} title="Remover" className="text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">{l.forma === 'Dinheiro' ? 'Valor pago em dinheiro (R$)' : 'Valor (R$)'}</label>
                    <Input type="number" min="0" step="0.01" value={l.valor} onChange={(e) => alterarLinha(i, { valor: e.target.value })} />
                  </div>
                  {l.forma === 'Dinheiro' && (
                    <div>
                      <label className="text-xs text-gray-500">Cliente entregou (R$)</label>
                      <Input type="number" min="0" step="0.01" placeholder="só se precisar de troco" value={l.recebido} onChange={(e) => alterarLinha(i, { recebido: e.target.value })} />
                    </div>
                  )}
                  {l.forma === 'Cartão de Crédito' && (
                    <div>
                      <label className="text-xs text-gray-500">Parcelas</label>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm" value={l.parcelas} onChange={(e) => alterarLinha(i, { parcelas: Number(e.target.value) })}>
                        {Array.from({ length: 12 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </div>
                  )}
                </div>
                {l.forma === 'Dinheiro' && trocoDaLinha(l) > 0 && <p className="text-sm font-bold text-emerald-700">Troco a devolver: {formatCurrency(trocoDaLinha(l))}</p>}
                {l.forma === 'Fiado' && (
                  <div className="space-y-2">
                    {!clienteId && <p className="text-xs text-red-600">Escolha o cliente na tela de venda (campo “Cliente”) antes de finalizar.</p>}
                    <div>
                      <label className="text-xs text-gray-500">Vencimento do fiado (padrão: 30 dias)</label>
                      <Input type="date" min={hojeISO()} value={vencFiado} onChange={(e) => setVencFiado(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {linhasPag.length > 0 && (
              <div className={cn('flex justify-between rounded-lg px-3 py-2 text-sm font-semibold', Math.abs(faltando) <= 0.005 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                <span>{Math.abs(faltando) <= 0.005 ? 'Pagamento completo' : faltando > 0 ? 'Falta pagar' : 'Excede o total'}</span>
                <span>{Math.abs(faltando) <= 0.005 ? formatCurrency(somaPag) : formatCurrency(Math.abs(faltando))}</span>
              </div>
            )}
            {pagErro && <p className="text-sm text-red-600">{pagErro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPagOpen(false)} disabled={finalizando}>Voltar</Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={finalizar} disabled={finalizando || linhasPag.length === 0}>{finalizando ? 'Concluindo...' : 'Concluir venda'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Venda concluída */}
      <Dialog open={!!concluida} onOpenChange={(o) => !o && setConcluida(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Venda concluída</DialogTitle></DialogHeader>
          {concluida && (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center"><Check className="h-7 w-7 text-emerald-600" /></div>
              <div>
                <p className="text-sm text-gray-500">Venda Nº {concluida.venda.numero_sequencial}</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(Number(concluida.venda.total))}</p>
                {concluida.troco > 0 && <p className="mt-1 text-lg font-bold text-emerald-700">Troco: {formatCurrency(concluida.troco)}</p>}
                {concluida.semEstoque.length > 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-left text-xs text-amber-800">
                    Vendido sem estoque: {concluida.semEstoque.map((x) => `${x.produto} (${x.quantidade} un.)`).join(', ')}.
                    O saldo fica negativo até você registrar a entrada de mercadoria.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => compartilhar(concluida.venda)}><Share2 className="h-4 w-4 mr-1" />Comprovante</Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={() => { setConcluida(null); buscaRef.current?.focus() }}>Nova venda</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pausar */}
      <Dialog open={pausarOpen} onOpenChange={setPausarOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Pausar venda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Nome ou número para identificar a venda</label>
              <Input autoFocus value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="Ex.: Maria" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPausarOpen(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={pausar} disabled={!identificador.trim()}>Pausar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Em espera */}
      <Dialog open={esperaOpen} onOpenChange={setEsperaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vendas em espera</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {esperas.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma venda em espera.</p>}
            {esperas.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{v.identificador_espera}</p>
                  <p className="text-xs text-gray-500">{v.vendas_itens.length} item(ns) · {formatCurrency(Number(v.total))}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => retomar(v)} disabled={carrinho.length > 0}>Retomar</Button>
                  <button onClick={() => descartarEspera(v.id)} title="Descartar" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {carrinho.length > 0 && esperas.length > 0 && <p className="text-xs text-amber-600">Finalize ou pause a venda atual para retomar outra.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendas do dia */}
      <Dialog open={diaOpen} onOpenChange={setDiaOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Vendas desta sessão</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {vendasDia.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Nenhuma venda concluída ainda.</p>}
            {vendasDia.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Nº {v.numero_sequencial} · {formatCurrency(Number(v.total))}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {v.vendas_pagamentos.map((p) => p.forma_pagamento_nome).join(' + ')}{v.clientes ? ` · ${v.clientes.nome}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => compartilhar(v)}><Share2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => cancelarVenda(v)}>Cancelar</Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
