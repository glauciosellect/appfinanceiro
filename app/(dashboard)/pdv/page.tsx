'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Trash2, ShoppingCart, Search, Wallet, ArrowDownCircle, ArrowUpCircle, LogOut, Copy, Receipt, Printer } from 'lucide-react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { buscarProdutoParaVenda, criarVenda, adicionarItemVenda, concluirVenda, getFormasPagamento } from '@/lib/supabase/vendas'
import {
  getSessaoAbertaHoje,
  abrirCaixa,
  registrarMovimentacaoCaixa,
  calcularSaldoEsperado,
  fecharCaixa,
  getRelatorioFechamento,
} from '@/lib/supabase/caixa'
import { getFiscalConfig } from '@/lib/supabase/fiscal'
import { gerarPixCopiaECola } from '@/lib/pix/br-code'
import { getContasCorrentes } from '@/lib/supabase/contas-correntes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import type { Produto, FormaPagamento, CaixaSessao, Bandeira, ContaCorrente } from '@/types'

type ItemCarrinho = { produto: Produto; quantidade: number; desconto_item: number }

const BANDEIRAS: { value: Bandeira; label: string }[] = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'outro', label: 'Outro' },
]

type TipoPagamentoPrimario = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'outras'

export default function PdvPage() {
  const [userId, setUserId] = useState('')
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<Produto[]>([])
  const [indiceRealcado, setIndiceRealcado] = useState(-1)
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([])
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([])
  const [dialogPagamento, setDialogPagamento] = useState(false)
  const [tipoPagamentoPrimario, setTipoPagamentoPrimario] = useState<TipoPagamentoPrimario>('dinheiro')
  const [formaPagamentoId, setFormaPagamentoId] = useState('')
  const [valorPago, setValorPago] = useState(0)
  const [bandeiraCartao, setBandeiraCartao] = useState<Bandeira>('visa')
  const [parcelasCartao, setParcelasCartao] = useState(1)
  const [pixPayload, setPixPayload] = useState('')
  const [pixQrDataUrl, setPixQrDataUrl] = useState('')
  const [pixErro, setPixErro] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const resultadosRef = useRef<HTMLDivElement>(null)
  const { toast: _toast } = useToast()

  // ---- Caixa (sessão) ----
  const [sessaoCaixa, setSessaoCaixa] = useState<CaixaSessao | null>(null)
  const [carregandoSessao, setCarregandoSessao] = useState(true)
  const [operadorAbertura, setOperadorAbertura] = useState('')
  const [trocoAbertura, setTrocoAbertura] = useState('')
  const [abrindoCaixa, setAbrindoCaixa] = useState(false)
  const [contasCorrentes, setContasCorrentes] = useState<ContaCorrente[]>([])
  const [contaCorrenteAbertura, setContaCorrenteAbertura] = useState('')

  const [dialogSangria, setDialogSangria] = useState(false)
  const [dialogSuprimento, setDialogSuprimento] = useState(false)
  const [valorMovimentacao, setValorMovimentacao] = useState('')
  const [motivoMovimentacao, setMotivoMovimentacao] = useState('')
  const [registrandoMovimentacao, setRegistrandoMovimentacao] = useState(false)

  const [dialogFechamento, setDialogFechamento] = useState(false)
  const [saldoEsperadoPreview, setSaldoEsperadoPreview] = useState(0)
  const [valorContado, setValorContado] = useState('')
  const [fechando, setFechando] = useState(false)
  type RelatorioFechamento = Awaited<ReturnType<typeof getRelatorioFechamento>>
  const [relatorio, setRelatorio] = useState<RelatorioFechamento | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    getFormasPagamento(userId).then(setFormasPagamento).catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId) return
    getContasCorrentes(userId).then(setContasCorrentes).catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId) return
    setCarregandoSessao(true)
    getSessaoAbertaHoje(userId)
      .then(setSessaoCaixa)
      .catch(() => setSessaoCaixa(null))
      .finally(() => setCarregandoSessao(false))
  }, [userId])

  useEffect(() => {
    searchRef.current?.focus()
  }, [carrinho.length])

  // Novos resultados de busca substituem os antigos — o destaque de teclado
  // não deve persistir de uma busca para a próxima.
  useEffect(() => {
    setIndiceRealcado(-1)
  }, [resultados])

  const total = carrinho.reduce((s, i) => s + (i.quantidade * i.produto.preco_unitario - i.desconto_item), 0)
  const formaSelecionada = formasPagamento.find(f => f.id === formaPagamentoId)
  const troco = formaSelecionada?.tipo === 'dinheiro' && valorPago > total ? valorPago - total : 0

  const buscar = useCallback(async () => {
    if (!userId || !termo.trim()) { setResultados([]); return }
    try {
      const produtos = await buscarProdutoParaVenda(userId, termo.trim())
      if (produtos.length === 1 && (produtos[0].barcode === termo.trim() || produtos[0].plu === termo.trim())) {
        adicionarAoCarrinho(produtos[0])
        setTermo('')
        setResultados([])
        return
      }
      setResultados(produtos)
    } catch {
      _toast('Erro ao buscar produto', 'error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, termo])

  useEffect(() => {
    const timeout = setTimeout(() => { buscar() }, 300)
    return () => clearTimeout(timeout)
  }, [buscar])

  function adicionarAoCarrinho(produto: Produto) {
    setCarrinho((prev) => {
      const existente = prev.find(i => i.produto.id === produto.id)
      if (existente) {
        return prev.map(i => i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
      }
      return [...prev, { produto, quantidade: 1, desconto_item: 0 }]
    })
    setTermo('')
    setResultados([])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      if (resultados.length === 0) return
      e.preventDefault()
      setIndiceRealcado((prev) => Math.min(prev + 1, resultados.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      if (resultados.length === 0) return
      e.preventDefault()
      setIndiceRealcado((prev) => Math.max(prev - 1, 0))
      return
    }
    if (e.key === 'Escape') {
      setResultados([])
      setIndiceRealcado(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (resultados.length > 0 && indiceRealcado >= 0) {
        adicionarAoCarrinho(resultados[indiceRealcado])
        return
      }
      buscar()
    }
  }

  function atualizarQuantidade(produtoId: string, quantidade: number) {
    setCarrinho((prev) => prev.map(i => i.produto.id === produtoId ? { ...i, quantidade: Math.max(1, quantidade) } : i))
  }

  function atualizarDesconto(produtoId: string, desconto: number) {
    setCarrinho((prev) => prev.map(i => i.produto.id === produtoId ? { ...i, desconto_item: Math.max(0, desconto) } : i))
  }

  function removerItem(produtoId: string) {
    setCarrinho((prev) => prev.filter(i => i.produto.id !== produtoId))
  }

  // Formas de pagamento primárias, resolvidas por `tipo` a partir das linhas
  // já buscadas — defensivo contra o usuário ter apagado alguma forma seed.
  const formaDinheiro = formasPagamento.find(f => f.tipo === 'dinheiro')
  const formaCreditoRow = formasPagamento.find(f => f.tipo === 'cartao_credito')
  const formaDebitoRow = formasPagamento.find(f => f.tipo === 'cartao_debito')
  const formaPixRow = formasPagamento.find(f => f.tipo === 'pix')
  const formasOutras = formasPagamento.filter(f =>
    !['dinheiro', 'cartao_credito', 'cartao_debito', 'pix'].includes(f.tipo)
  )

  function selecionarTipoPrimario(tipo: TipoPagamentoPrimario, forma?: FormaPagamento) {
    setTipoPagamentoPrimario(tipo)
    if (forma) {
      setFormaPagamentoId(forma.id)
    }
    if (tipo === 'dinheiro') {
      setValorPago(total)
    } else if (tipo === 'cartao_credito' || tipo === 'cartao_debito') {
      setValorPago(total)
      setBandeiraCartao('visa')
      setParcelasCartao(1)
    } else if (tipo === 'pix') {
      setValorPago(total)
      gerarQrCodePix()
    }
  }

  async function gerarQrCodePix() {
    setPixErro('')
    setPixPayload('')
    setPixQrDataUrl('')
    if (!userId) return
    try {
      const [fiscalConfig, contaComChave] = await Promise.all([
        getFiscalConfig(userId),
        (async () => {
          const supabase = createClient()
          // TODO: futura tela de configurações poderia deixar o usuário
          // escolher qual conta/chave Pix o PDV usa; por ora, usamos a
          // primeira conta com chave_pix cadastrada, ordenada por criação.
          const { data } = await supabase
            .from('contas_correntes')
            .select('chave_pix')
            .eq('user_id', userId)
            .not('chave_pix', 'is', null)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          return data as { chave_pix: string } | null
        })(),
      ])

      if (!fiscalConfig?.razao_social || !contaComChave?.chave_pix) {
        setPixErro('Configure uma chave PIX em Contas Correntes e a Razão Social em Configurações para gerar o QR Code')
        return
      }

      const payload = gerarPixCopiaECola({
        chavePix: contaComChave.chave_pix,
        nomeRecebedor: fiscalConfig.razao_social,
        cidade: fiscalConfig.municipio || 'SAO PAULO',
        valor: total,
      })
      setPixPayload(payload)
      const dataUrl = await QRCode.toDataURL(payload)
      setPixQrDataUrl(dataUrl)
    } catch {
      setPixErro('Erro ao gerar QR Code PIX')
    }
  }

  async function copiarPixPayload() {
    if (!pixPayload) return
    try {
      await navigator.clipboard.writeText(pixPayload)
      _toast('Código copiado!', 'success')
    } catch {
      _toast('Erro ao copiar código', 'error')
    }
  }

  function abrirPagamento() {
    if (carrinho.length === 0) return
    setValorPago(total)
    setBandeiraCartao('visa')
    setParcelasCartao(1)
    setPixPayload('')
    setPixQrDataUrl('')
    setPixErro('')
    if (formaDinheiro) {
      selecionarTipoPrimario('dinheiro', formaDinheiro)
    } else {
      setTipoPagamentoPrimario('outras')
      setFormaPagamentoId(formasPagamento[0]?.id ?? '')
    }
    setDialogPagamento(true)
  }

  async function handleFinalizarVenda() {
    if (!formaSelecionada || !sessaoCaixa) {
      _toast('Selecione a forma de pagamento', 'error')
      return
    }
    setFinalizando(true)
    try {
      const venda = await criarVenda(userId, sessaoCaixa.id)
      for (const item of carrinho) {
        await adicionarItemVenda(userId, venda.id, {
          produto_id: item.produto.id,
          nome_produto: item.produto.nome,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco_unitario,
          desconto_item: item.desconto_item,
        })
      }
      const ehCartao = tipoPagamentoPrimario === 'cartao_credito' || tipoPagamentoPrimario === 'cartao_debito'
      await concluirVenda(userId, venda.id, [{
        forma_pagamento_id: formaSelecionada.id,
        forma_pagamento_nome: formaSelecionada.nome,
        valor: valorPago,
        troco,
        bandeira: ehCartao ? bandeiraCartao : undefined,
        parcelas: ehCartao ? parcelasCartao : undefined,
      }])
      _toast('Venda concluída!', 'success')
      setCarrinho([])
      setDialogPagamento(false)
      searchRef.current?.focus()
    } catch {
      _toast('Erro ao finalizar venda', 'error')
    } finally {
      setFinalizando(false)
    }
  }

  async function handleAbrirCaixa() {
    const troco = Number(trocoAbertura)
    if (!operadorAbertura.trim() || trocoAbertura === '' || Number.isNaN(troco) || troco < 0) return
    setAbrindoCaixa(true)
    try {
      const sessao = await abrirCaixa(userId, operadorAbertura.trim(), troco, contaCorrenteAbertura || undefined)
      setSessaoCaixa(sessao)
      setOperadorAbertura('')
      setTrocoAbertura('')
      setContaCorrenteAbertura('')
      _toast('Caixa aberto!', 'success')
    } catch {
      _toast('Erro ao abrir caixa', 'error')
    } finally {
      setAbrindoCaixa(false)
    }
  }

  function abrirDialogMovimentacao(tipo: 'sangria' | 'suprimento') {
    setValorMovimentacao('')
    setMotivoMovimentacao('')
    if (tipo === 'sangria') setDialogSangria(true)
    else setDialogSuprimento(true)
  }

  async function handleRegistrarMovimentacao(tipo: 'sangria' | 'suprimento') {
    const valor = Number(valorMovimentacao)
    if (!sessaoCaixa || !valor || valor <= 0 || !motivoMovimentacao.trim()) return
    setRegistrandoMovimentacao(true)
    try {
      await registrarMovimentacaoCaixa(userId, sessaoCaixa.id, tipo, valor, motivoMovimentacao.trim())
      _toast(tipo === 'sangria' ? 'Sangria registrada!' : 'Suprimento registrado!', 'success')
      setDialogSangria(false)
      setDialogSuprimento(false)
      setValorMovimentacao('')
      setMotivoMovimentacao('')
    } catch {
      _toast('Erro ao registrar movimentação', 'error')
    } finally {
      setRegistrandoMovimentacao(false)
    }
  }

  async function abrirDialogFechamento() {
    if (!sessaoCaixa) return
    setValorContado('')
    setRelatorio(null)
    setDialogFechamento(true)
    try {
      const saldo = await calcularSaldoEsperado(userId, sessaoCaixa.id)
      setSaldoEsperadoPreview(saldo)
    } catch {
      _toast('Erro ao calcular saldo esperado', 'error')
    }
  }

  async function handleFecharCaixa() {
    const contado = Number(valorContado)
    if (!sessaoCaixa || valorContado === '' || Number.isNaN(contado)) return
    setFechando(true)
    try {
      await fecharCaixa(userId, sessaoCaixa.id, contado)
      const rel = await getRelatorioFechamento(userId, sessaoCaixa.id)
      setRelatorio(rel)
    } catch {
      _toast('Erro ao fechar caixa', 'error')
    } finally {
      setFechando(false)
    }
  }

  function handleFecharRelatorio() {
    setDialogFechamento(false)
    setRelatorio(null)
    setSessaoCaixa(null)
  }

  const diferencaRelatorio = relatorio ? (relatorio.sessao.diferenca ?? 0) : 0

  if (carregandoSessao) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center text-gray-400">
        Carregando...
      </div>
    )
  }

  if (!sessaoCaixa) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abertura de Caixa</h1>
          <p className="text-sm text-gray-500">Informe o operador e o troco inicial para abrir o PDV</p>
        </div>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div>
              <Label>Operador</Label>
              <Input
                placeholder="Nome do operador"
                value={operadorAbertura}
                onChange={(e) => setOperadorAbertura(e.target.value)}
              />
            </div>
            <div>
              <Label>Troco Inicial (R$)</Label>
              <Input
                type="number" step="0.01" min="0"
                placeholder="0,00"
                value={trocoAbertura}
                onChange={(e) => setTrocoAbertura(e.target.value)}
              />
            </div>
            <div>
              <Label>Conta para recebimentos em dinheiro (opcional)</Label>
              <Select value={contaCorrenteAbertura} onValueChange={setContaCorrenteAbertura}>
                <SelectTrigger><SelectValue placeholder="Nenhuma conta vinculada" /></SelectTrigger>
                <SelectContent>
                  {contasCorrentes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_apelido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleAbrirCaixa}
              disabled={!operadorAbertura.trim() || trocoAbertura === '' || abrindoCaixa}
            >
              Abrir Caixa
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">PDV</h1>
        <p className="text-sm text-gray-500">Ponto de venda</p>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-900">{sessaoCaixa.operador}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">
              Caixa aberto às {new Date(sessaoCaixa.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => abrirDialogMovimentacao('sangria')}>
              <ArrowDownCircle className="h-4 w-4 mr-1.5 text-red-500" />
              Sangria
            </Button>
            <Button variant="outline" size="sm" onClick={() => abrirDialogMovimentacao('suprimento')}>
              <ArrowUpCircle className="h-4 w-4 mr-1.5 text-green-500" />
              Suprimento
            </Button>
            <Button variant="outline" size="sm" onClick={abrirDialogFechamento}>
              <LogOut className="h-4 w-4 mr-1.5 text-gray-500" />
              Fechar Caixa
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              ref={searchRef}
              autoFocus
              className="pl-9"
              placeholder="Digite o nome, código de barras ou PLU..."
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {resultados.length > 0 && (
              <div ref={resultadosRef} className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {resultados.map((produto, index) => (
                  <button
                    key={produto.id}
                    onClick={() => adicionarAoCarrinho(produto)}
                    onMouseEnter={() => setIndiceRealcado(index)}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors ${
                      index === indiceRealcado ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900">{produto.nome}</span>
                    <span className="text-sm text-gray-500">{formatCurrency(produto.preco_unitario)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Carrinho
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {carrinho.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum item no carrinho</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-2">Produto</th>
                      <th className="text-center px-2 py-2 w-24">Qtd</th>
                      <th className="text-right px-2 py-2">Preço Unit.</th>
                      <th className="text-right px-2 py-2 w-28">Desconto</th>
                      <th className="text-right px-2 py-2">Subtotal</th>
                      <th className="text-right px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {carrinho.map((item) => (
                      <tr key={item.produto.id}>
                        <td className="px-4 py-2 font-medium text-gray-900">{item.produto.nome}</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="1" step="1" value={item.quantidade} className="h-8 text-center"
                            onChange={(e) => atualizarQuantidade(item.produto.id, Number(e.target.value) || 1)}
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(item.produto.preco_unitario)}</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="0" step="0.01" value={item.desconto_item} className="h-8 text-right"
                            onChange={(e) => atualizarDesconto(item.produto.id, Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-gray-900">
                          {formatCurrency(item.quantidade * item.produto.preco_unitario - item.desconto_item)}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <button onClick={() => removerItem(item.produto.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sm:hidden p-4 space-y-3">
                {carrinho.map((item) => (
                  <div key={item.produto.id} className="rounded-xl border border-gray-200 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-gray-900 break-words">{item.produto.nome}</span>
                      <button
                        onClick={() => removerItem(item.produto.id)}
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
                          type="number" min="1" step="1" value={item.quantidade} className="h-9 text-center"
                          onChange={(e) => atualizarQuantidade(item.produto.id, Number(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Preço Unit.</Label>
                        <p className="h-9 flex items-center text-gray-500">{formatCurrency(item.produto.preco_unitario)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Desconto</Label>
                        <Input
                          type="number" min="0" step="0.01" value={item.desconto_item} className="h-9 text-right"
                          onChange={(e) => atualizarDesconto(item.produto.id, Number(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Subtotal</Label>
                        <p className="h-9 flex items-center font-semibold text-gray-900">
                          {formatCurrency(item.quantidade * item.produto.preco_unitario - item.desconto_item)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(total)}</p>
          </div>
          <Button size="lg" onClick={abrirPagamento} disabled={carrinho.length === 0}>
            Finalizar Venda
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogPagamento} onOpenChange={setDialogPagamento}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Finalizar Venda</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between">
              <span className="text-gray-500">Total a pagar</span>
              <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
            </div>

            <div>
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {formaDinheiro && (
                  <button type="button"
                    onClick={() => selecionarTipoPrimario('dinheiro', formaDinheiro)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      tipoPagamentoPrimario === 'dinheiro' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >Dinheiro</button>
                )}
                {formaCreditoRow && (
                  <button type="button"
                    onClick={() => selecionarTipoPrimario('cartao_credito', formaCreditoRow)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      tipoPagamentoPrimario === 'cartao_credito' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >Cartão de Crédito</button>
                )}
                {formaDebitoRow && (
                  <button type="button"
                    onClick={() => selecionarTipoPrimario('cartao_debito', formaDebitoRow)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      tipoPagamentoPrimario === 'cartao_debito' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >Cartão de Débito</button>
                )}
                {formaPixRow && (
                  <button type="button"
                    onClick={() => selecionarTipoPrimario('pix', formaPixRow)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      tipoPagamentoPrimario === 'pix' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >PIX</button>
                )}
              </div>
              {formasOutras.length > 0 && (
                <div className="mt-2">
                  <button type="button"
                    onClick={() => { setTipoPagamentoPrimario('outras'); setFormaPagamentoId(formasOutras[0]?.id ?? '') }}
                    className={`text-xs font-medium underline ${tipoPagamentoPrimario === 'outras' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    Outras formas de pagamento
                  </button>
                  {tipoPagamentoPrimario === 'outras' && (
                    <Select value={formaPagamentoId} onValueChange={setFormaPagamentoId}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {formasOutras.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>

            {tipoPagamentoPrimario === 'dinheiro' && (
              <>
                <div>
                  <Label>Valor Pago (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={valorPago} onChange={(e) => setValorPago(Number(e.target.value) || 0)} />
                </div>
                {troco > 0 && (
                  <div className="bg-green-50 rounded-xl p-3 text-sm flex justify-between">
                    <span className="text-green-700 font-medium">Troco</span>
                    <span className="font-bold text-green-700">{formatCurrency(troco)}</span>
                  </div>
                )}
              </>
            )}

            {(tipoPagamentoPrimario === 'cartao_credito' || tipoPagamentoPrimario === 'cartao_debito') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Bandeira</Label>
                    <Select value={bandeiraCartao} onValueChange={(v) => setBandeiraCartao(v as Bandeira)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{BANDEIRAS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nº de Parcelas</Label>
                    <Input type="number" min="1" max="12" step="1" value={parcelasCartao}
                      onChange={(e) => setParcelasCartao(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between">
                  <span className="text-gray-500">Valor a cobrar</span>
                  <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
                </div>
              </>
            )}

            {tipoPagamentoPrimario === 'pix' && (
              <div className="space-y-3">
                {pixErro ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">{pixErro}</div>
                ) : pixQrDataUrl ? (
                  <>
                    <div className="flex justify-center bg-white p-3 rounded-xl border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pixQrDataUrl} alt="QR Code Pix" className="h-48 w-48" />
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-gray-50 rounded-lg px-2 py-2 truncate">{pixPayload}</code>
                      <Button type="button" variant="outline" size="sm" onClick={copiarPixPayload}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      Aguardando confirmação do pagamento — clique em Finalizar após confirmar o recebimento.
                    </p>
                  </>
                ) : (
                  <div className="py-6 text-center text-gray-400 text-sm">Gerando QR Code...</div>
                )}
              </div>
            )}

            {tipoPagamentoPrimario === 'outras' && (
              <div>
                <Label>Valor Pago (R$)</Label>
                <Input type="number" step="0.01" min="0" value={valorPago} onChange={(e) => setValorPago(Number(e.target.value) || 0)} />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogPagamento(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleFinalizarVenda} disabled={finalizando || !formaSelecionada} className="flex-1">
                {tipoPagamentoPrimario === 'pix' ? 'Finalizar (PIX confirmado)' : 'Confirmar Pagamento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sangria */}
      <Dialog open={dialogSangria} onOpenChange={setDialogSangria}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Sangria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorMovimentacao} onChange={(e) => setValorMovimentacao(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={motivoMovimentacao} onChange={(e) => setMotivoMovimentacao(e.target.value)} placeholder="Ex: retirada para depósito" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogSangria(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => handleRegistrarMovimentacao('sangria')}
                disabled={registrandoMovimentacao || !Number(valorMovimentacao) || !motivoMovimentacao.trim()}
                className="flex-1"
              >
                Confirmar Sangria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suprimento */}
      <Dialog open={dialogSuprimento} onOpenChange={setDialogSuprimento}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Suprimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorMovimentacao} onChange={(e) => setValorMovimentacao(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={motivoMovimentacao} onChange={(e) => setMotivoMovimentacao(e.target.value)} placeholder="Ex: reforço de troco" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogSuprimento(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => handleRegistrarMovimentacao('suprimento')}
                disabled={registrandoMovimentacao || !Number(valorMovimentacao) || !motivoMovimentacao.trim()}
                className="flex-1"
              >
                Confirmar Suprimento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fechamento de caixa */}
      <Dialog open={dialogFechamento} onOpenChange={(open) => { if (!open && !relatorio) setDialogFechamento(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Fechamento de Caixa</DialogTitle></DialogHeader>

          {!relatorio ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between">
                <span className="text-gray-500">Saldo esperado</span>
                <span className="font-bold text-gray-900">{formatCurrency(saldoEsperadoPreview)}</span>
              </div>
              <div>
                <Label>Valor Contado (R$)</Label>
                <Input type="number" step="0.01" min="0" value={valorContado} onChange={(e) => setValorContado(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogFechamento(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleFecharCaixa} disabled={fechando || valorContado === ''} className="flex-1">Fechar Caixa</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-500">Esperado</p>
                  <p className="font-bold text-gray-900">{formatCurrency(relatorio.saldoEsperado)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-500">Contado</p>
                  <p className="font-bold text-gray-900">{formatCurrency(relatorio.sessao.saldo_contado ?? 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-500">Diferença</p>
                  <p className={
                    'font-bold ' +
                    (diferencaRelatorio > 0 ? 'text-green-600' : diferencaRelatorio < 0 ? 'text-red-600' : 'text-gray-600')
                  }>
                    {formatCurrency(diferencaRelatorio)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Vendas por forma de pagamento</p>
                {relatorio.vendasPorFormaPagamento.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma venda concluída nesta sessão</p>
                ) : (
                  <div className="space-y-1">
                    {relatorio.vendasPorFormaPagamento.map((v) => (
                      <div key={v.forma_pagamento_nome} className="flex justify-between text-sm">
                        <span className="text-gray-600">{v.forma_pagamento_nome} ({v.quantidade})</span>
                        <span className="font-medium text-gray-900">{formatCurrency(v.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total sangrias</span>
                <span className="font-medium text-red-600">{formatCurrency(relatorio.totalSangrias)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total suprimentos</span>
                <span className="font-medium text-green-600">{formatCurrency(relatorio.totalSuprimentos)}</span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" asChild className="flex-1">
                  <Link href={`/caixa/${relatorio.sessao.id}/fechamento`} target="_blank">
                    <Printer className="h-4 w-4 mr-1.5" />Imprimir Relatório
                  </Link>
                </Button>
                <Button onClick={handleFecharRelatorio} className="flex-1">Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
