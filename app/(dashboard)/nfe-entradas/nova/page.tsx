'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, QrCode, CheckCircle2, FileText, AlertCircle, CreditCard, ChevronRight, PenLine, Plus, Trash2, Loader2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Modo = 'chave' | 'upload' | 'digitar' | null
type Step = 'form' | 'review' | 'pagamento' | 'success'

interface ParsedItem {
  codigo: string; descricao: string; ncm: string; cfop: string
  unidade: string; quantidade: number; valorUnitario: number; valorTotal: number
}
interface ParsedNFe {
  numero: string; serie: string; dataEmissao: string
  fornecedorNome: string; fornecedorCnpj: string
  naturezaOperacao: string; valorTotal: number; itens: ParsedItem[]
  transportadoraNome?: string; transportadoraCnpj?: string
}
interface SelectOption { id: string; nome: string; extra?: string }
interface DigitarItem {
  codigo: string; descricao: string; ncm: string; cfop: string
  unidade: string; quantidade: number; valorUnitario: number
}
interface FornDB { nome: string; cpf_cnpj: string }
interface ProdDB {
  codigo: string; descricao: string; ncm: string; cfop: string
  unidade: string; preco_unitario: number; preco_venda: number
}

function getText(el: Element | Document, tag: string): string {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

function parseNFeXML(xmlText: string): ParsedNFe {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.getElementsByTagName('parsererror')[0]) throw new Error('XML inválido')
  const ide = doc.getElementsByTagName('ide')[0]
  const emit = doc.getElementsByTagName('emit')[0]
  const icmsTot = doc.getElementsByTagName('ICMSTot')[0]
  if (!ide || !emit) throw new Error('Estrutura de NF-e não reconhecida')

  const itens: ParsedItem[] = Array.from(doc.getElementsByTagName('det')).map((det) => {
    const prod = det.getElementsByTagName('prod')[0]
    return {
      codigo: getText(prod, 'cProd'), descricao: getText(prod, 'xProd'),
      ncm: getText(prod, 'NCM'), cfop: getText(prod, 'CFOP'),
      unidade: getText(prod, 'uCom'),
      quantidade: parseFloat(getText(prod, 'qCom')) || 0,
      valorUnitario: parseFloat(getText(prod, 'vUnCom')) || 0,
      valorTotal: parseFloat(getText(prod, 'vProd')) || 0,
    }
  })
  return {
    numero: getText(ide, 'nNF'), serie: getText(ide, 'serie'),
    dataEmissao: getText(ide, 'dhEmi') || getText(ide, 'dEmi'),
    fornecedorNome: getText(emit, 'xNome'), fornecedorCnpj: getText(emit, 'CNPJ'),
    naturezaOperacao: getText(ide, 'natOp'),
    valorTotal: icmsTot ? parseFloat(getText(icmsTot, 'vNF')) || 0 : 0,
    itens,
  }
}

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function NovaEntradaPage() {
  const [modo, setModo] = useState<Modo>(null)
  const [chave, setChave] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [nfeData, setNfeData] = useState<ParsedNFe | null>(null)
  const [dragging, setDragging] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Margem de lucro (usada no review step)
  const [margemGlobal, setMargemGlobal] = useState(30)
  const [margens, setMargens] = useState<Record<number, number>>({})
  const getMargemItem = (i: number) => margens[i] ?? margemGlobal
  const getPrecoVenda = (custo: number, margem: number) =>
    Math.round(custo * (1 + margem / 100) * 100) / 100

  // ── Digitar nota: dados principais ──────────────────────────────────────
  const [digitarNota, setDigitarNota] = useState({
    numero: '', serie: '1', dataEmissao: '',
    naturezaOperacao: 'Compra de mercadorias',
    fornecedorNome: '', fornecedorCnpj: '',
    transportadoraNome: '', transportadoraCnpj: '',
  })
  const [digitarItens, setDigitarItens] = useState<DigitarItem[]>([
    { codigo: '', descricao: '', ncm: '', cfop: '1102', unidade: 'UN', quantidade: 1, valorUnitario: 0 },
  ])
  // search text por item para autocomplete de produtos
  const [itemSearches, setItemSearches] = useState<string[]>([''])
  const [itemDropIdx, setItemDropIdx] = useState<number | null>(null)

  // ── DB cache para autocomplete ───────────────────────────────────────────
  const [fornecedoresDB, setFornecedoresDB] = useState<FornDB[]>([])
  const [produtosDB, setProdutosDB] = useState<ProdDB[]>([])

  // ── CNPJ lookup state ────────────────────────────────────────────────────
  const [loadingCnpjForn, setLoadingCnpjForn] = useState(false)
  const [loadingCnpjTransp, setLoadingCnpjTransp] = useState(false)
  const [fornDropOpen, setFornDropOpen] = useState(false)
  const [transpDropOpen, setTranspDropOpen] = useState(false)
  const [cnpjFornMsg, setCnpjFornMsg] = useState<string | null>(null)
  const [cnpjTranspMsg, setCnpjTranspMsg] = useState<string | null>(null)

  // Carrega fornecedores e produtos quando modo = 'digitar'
  useEffect(() => {
    if (modo !== 'digitar') return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      Promise.all([
        supabase.from('fornecedores').select('nome, cpf_cnpj').eq('user_id', user.id).eq('ativo', true).order('nome'),
        supabase.from('produtos_fiscais').select('codigo, descricao, ncm, cfop, unidade, preco_unitario, preco_venda').eq('user_id', user.id).eq('ativo', true).order('descricao'),
      ]).then(([{ data: f }, { data: p }]) => {
        setFornecedoresDB((f ?? []) as FornDB[])
        setProdutosDB((p ?? []) as ProdDB[])
      })
    })
  }, [modo])

  // Consulta CNPJ: primeiro no DB, depois Receita Federal
  async function buscarCnpj(cnpjRaw: string, tipo: 'fornecedor' | 'transportadora') {
    const digits = cnpjRaw.replace(/\D/g, '')
    if (digits.length !== 14) return

    const setLoading = tipo === 'fornecedor' ? setLoadingCnpjForn : setLoadingCnpjTransp
    const setMsg = tipo === 'fornecedor' ? setCnpjFornMsg : setCnpjTranspMsg
    setLoading(true); setMsg(null)

    // Verifica no DB local primeiro
    const existente = fornecedoresDB.find(f => (f.cpf_cnpj ?? '').replace(/\D/g, '') === digits)
    if (existente) {
      if (tipo === 'fornecedor') setDigitarNota(n => ({ ...n, fornecedorNome: existente.nome }))
      else setDigitarNota(n => ({ ...n, transportadoraNome: existente.nome }))
      setMsg('✓ Fornecedor encontrado no cadastro')
      setLoading(false); return
    }

    // Consulta Receita Federal via BrasilAPI
    try {
      const res = await fetch(`/api/cnpj/${digits}`)
      if (res.ok) {
        const data = await res.json() as { razaoSocial: string; nomeFantasia: string; situacao: string }
        const nome = data.razaoSocial || data.nomeFantasia
        if (nome) {
          if (tipo === 'fornecedor') setDigitarNota(n => ({ ...n, fornecedorNome: nome }))
          else setDigitarNota(n => ({ ...n, transportadoraNome: nome }))
          setMsg(`✓ Dados obtidos da Receita Federal${data.situacao ? ` — ${data.situacao}` : ''}`)
        } else {
          setMsg('CNPJ encontrado, mas sem razão social disponível')
        }
      } else {
        setMsg('CNPJ não encontrado na Receita Federal')
      }
    } catch {
      setMsg('Erro ao consultar Receita Federal')
    }
    setLoading(false)
  }

  // Helpers de itens
  function addDigitarItem() {
    setDigitarItens(prev => [...prev, { codigo: '', descricao: '', ncm: '', cfop: '1102', unidade: 'UN', quantidade: 1, valorUnitario: 0 }])
    setItemSearches(prev => [...prev, ''])
  }
  function removeDigitarItem(i: number) {
    setDigitarItens(prev => prev.filter((_, idx) => idx !== i))
    setItemSearches(prev => prev.filter((_, idx) => idx !== i))
    if (itemDropIdx === i) setItemDropIdx(null)
  }
  function updateDigitarItem(i: number, field: keyof DigitarItem, value: string | number) {
    setDigitarItens(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }
  function selecionarProduto(i: number, prod: ProdDB) {
    setDigitarItens(prev => prev.map((it, idx) => idx === i ? {
      ...it,
      codigo: prod.codigo,
      descricao: prod.descricao,
      ncm: prod.ncm,
      cfop: prod.cfop,
      unidade: prod.unidade,
      valorUnitario: prod.preco_venda || prod.preco_unitario,
    } : it))
    setItemSearches(prev => prev.map((s, idx) => idx === i ? prod.descricao : s))
    setItemDropIdx(null)
  }

  function handleSalvarDigitada() {
    if (!digitarNota.fornecedorNome || digitarItens.length === 0) return
    const valorTotal = digitarItens.reduce((sum, it) => sum + it.quantidade * it.valorUnitario, 0)
    const parsed: ParsedNFe = {
      numero: digitarNota.numero,
      serie: digitarNota.serie,
      dataEmissao: digitarNota.dataEmissao,
      naturezaOperacao: digitarNota.naturezaOperacao,
      fornecedorNome: digitarNota.fornecedorNome,
      fornecedorCnpj: digitarNota.fornecedorCnpj.replace(/\D/g, ''),
      valorTotal,
      itens: digitarItens.map(it => ({ ...it, valorTotal: it.quantidade * it.valorUnitario })),
      transportadoraNome: digitarNota.transportadoraNome || undefined,
      transportadoraCnpj: digitarNota.transportadoraCnpj.replace(/\D/g, '') || undefined,
    }
    setNfeData(parsed)
    setStep('review')
  }

  // ── Contas a pagar ───────────────────────────────────────────────────────
  const [lancaCP, setLancaCP] = useState(true)
  const [vencimento, setVencimento] = useState('')
  const [numParcelas, setNumParcelas] = useState(1)
  const [formaPagamentoId, setFormaPagamentoId] = useState('')
  const [contaCorrenteId, setContaCorrenteId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [formas, setFormas] = useState<SelectOption[]>([])
  const [contas, setContas] = useState<SelectOption[]>([])
  const [loadingOpcoes, setLoadingOpcoes] = useState(false)

  useEffect(() => {
    if (step !== 'pagamento') return
    setLoadingOpcoes(true)
    const supabase = createClient()
    Promise.all([
      supabase.from('formas_pagamento').select('id, nome, tipo').eq('ativo', true).order('nome'),
      supabase.from('contas_correntes').select('id, nome_apelido, banco').eq('ativo', true).is('deleted_at', null).order('nome_apelido'),
    ]).then(([{ data: fp }, { data: cc }]) => {
      setFormas((fp ?? []).map((f: { id: string; nome: string; tipo: string }) => ({ id: f.id, nome: f.nome, extra: f.tipo })))
      setContas((cc ?? []).map((c: { id: string; nome_apelido: string; banco: string }) => ({ id: c.id, nome: c.nome_apelido, extra: c.banco })))
    }).finally(() => setLoadingOpcoes(false))
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setVencimento(d.toISOString().split('T')[0])
  }, [step])

  function handleFile(file: File) {
    setErro(null)
    if (!file.name.toLowerCase().endsWith('.xml')) { setErro('Apenas arquivos .xml são aceitos.'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = parseNFeXML(e.target?.result as string)
        if (data.itens.length === 0) throw new Error('Nenhum produto encontrado no XML.')
        setNfeData(data)
        setStep('review')
      } catch (err) {
        setErro(err instanceof Error ? err.message : 'Erro ao processar o XML. Verifique se é um arquivo NF-e válido.')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }, [])
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])

  async function handleConfirmar() {
    if (!nfeData) return
    setSalvando(true); setErro(null)
    try {
      const itensComMargem = nfeData.itens.map((item, i) => {
        const margem = getMargemItem(i)
        return { ...item, margem, precoVenda: getPrecoVenda(item.valorUnitario, margem) }
      })
      const resEstoque = await fetch('/api/estoque/import-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nfeData, itens: itensComMargem }),
      })
      if (!resEstoque.ok) {
        const body = await resEstoque.json()
        setErro(body.erros?.join(', ') ?? 'Erro ao importar estoque. Tente novamente.'); return
      }

      if (lancaCP && vencimento) {
        const resCP = await fetch('/api/contas-pagar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: `NF-e Entrada ${nfeData.serie}/${nfeData.numero} — ${nfeData.fornecedorNome}`,
            valor_total: nfeData.valorTotal,
            num_parcelas: numParcelas,
            juros_percentual: 0, multa_percentual: 0, desconto_valor: 0,
            data_primeira_parcela: vencimento,
            forma_pagamento_id: formaPagamentoId || null,
            conta_corrente_id: contaCorrenteId || null,
            observacoes: observacoes || `NF-e ${nfeData.serie}/${nfeData.numero} — ${nfeData.fornecedorNome}`,
          }),
        })
        if (!resCP.ok) {
          const body = await resCP.json()
          setErro(body.error ?? 'Erro ao lançar conta a pagar.'); return
        }
      }
      setStep('success')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Tela de sucesso ──────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">NF-e de Entrada importada!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-2">
          {nfeData?.itens.length} produto(s) adicionados ao estoque.
        </p>
        {lancaCP && (
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Conta a pagar de {formatCurrency(nfeData?.valorTotal ?? 0)} lançada em {numParcelas}x.
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild><Link href="/estoque">Ver Estoque</Link></Button>
          {lancaCP && <Button variant="outline" asChild><Link href="/contas-pagar">Ver Contas a Pagar</Link></Button>}
          <Button asChild><Link href="/nfe-entradas">Ver Entradas</Link></Button>
        </div>
      </div>
    )
  }

  // ── Step: Contas a Pagar ─────────────────────────────────────────────────
  if (step === 'pagamento' && nfeData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep('review')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contas a Pagar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Deseja registrar o pagamento desta nota?</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-4">
              Lançar <span className="text-blue-600 font-bold">{formatCurrency(nfeData.valorTotal)}</span> no Contas a Pagar?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLancaCP(true)}
                className={cn('p-4 rounded-xl border-2 font-semibold transition-all',
                  lancaCP ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300')}>
                Sim, lançar
              </button>
              <button onClick={() => setLancaCP(false)}
                className={cn('p-4 rounded-xl border-2 font-semibold transition-all',
                  !lancaCP ? 'border-gray-500 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300')}>
                Não, pular
              </button>
            </div>
          </CardContent>
        </Card>
        {lancaCP && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Detalhes do Pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loadingOpcoes ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Carregando opções...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vencimento *</label>
                      <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Parcelas</label>
                      <select value={numParcelas} onChange={(e) => setNumParcelas(Number(e.target.value))}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                          <option key={n} value={n}>{n}x {n > 1 ? `de ${formatCurrency(nfeData.valorTotal / n)}` : '(à vista)'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                    <select value={formaPagamentoId} onChange={(e) => setFormaPagamentoId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <option value="">— Selecionar —</option>
                      {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banco / Conta Corrente</label>
                    <select value={contaCorrenteId} onChange={(e) => setContaCorrenteId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <option value="">— Selecionar —</option>
                      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.extra}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                    <Input placeholder="Ex: pagamento via PIX em 30 dias" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                  </div>
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm">
                    <div className="flex justify-between text-blue-700 dark:text-blue-300">
                      <span>Total da nota</span><span className="font-bold">{formatCurrency(nfeData.valorTotal)}</span>
                    </div>
                    {numParcelas > 1 && (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400 mt-1">
                        <span>{numParcelas} parcelas de</span>
                        <span className="font-semibold">{formatCurrency(nfeData.valorTotal / numParcelas)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
        {erro && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />{erro}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setStep('review')} disabled={salvando}>Voltar</Button>
          <Button className="flex-1" onClick={handleConfirmar} disabled={salvando || (lancaCP && !vencimento)}>
            {salvando ? 'Importando...' : lancaCP ? 'Confirmar e Importar' : 'Importar sem lançar'}
          </Button>
        </div>
      </div>
    )
  }

  // ── Step: Review ─────────────────────────────────────────────────────────
  if (step === 'review' && nfeData) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setStep('form'); setNfeData(null) }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revisar NF-e de Entrada</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Confira os dados e avance para o próximo passo</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Dados da Nota</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Fornecedor', value: nfeData.fornecedorNome },
              { label: 'CNPJ Fornecedor', value: nfeData.fornecedorCnpj || '—' },
              { label: 'Número', value: `${nfeData.serie}/${nfeData.numero}` },
              { label: 'Natureza', value: nfeData.naturezaOperacao },
              { label: 'Emissão', value: nfeData.dataEmissao ? new Date(nfeData.dataEmissao).toLocaleDateString('pt-BR') : '—' },
              { label: 'Valor Total', value: formatCurrency(nfeData.valorTotal) },
              ...(nfeData.transportadoraNome ? [{ label: 'Transportadora', value: nfeData.transportadoraNome }] : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base">Produtos ({nfeData.itens.length})</CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Serão adicionados ao seu estoque</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Margem padrão (%)</label>
                <input
                  type="number" min={0} max={999} step={1}
                  value={margemGlobal}
                  onChange={(e) => setMargemGlobal(Math.max(0, Number(e.target.value)))}
                  className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    {['Código', 'Descrição', 'Un.', 'Qtd', 'Custo Unit.', 'Margem %', 'Preço Venda'].map((h) => (
                      <th key={h} className={cn('px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide',
                        ['Qtd', 'Custo Unit.', 'Margem %', 'Preço Venda'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {nfeData.itens.map((item, i) => {
                    const margem = getMargemItem(i)
                    const precoVenda = getPrecoVenda(item.valorUnitario, margem)
                    return (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.codigo}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                          <p>{item.descricao}</p>
                          <p className="text-xs text-gray-400">NCM: {item.ncm}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{item.unidade}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{item.quantidade}</td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.valorUnitario)}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number" min={0} max={999} step={1}
                            value={margem}
                            onChange={(e) => setMargens((prev) => ({ ...prev, [i]: Math.max(0, Number(e.target.value)) }))}
                            className="w-16 h-8 rounded-md border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <span className="ml-1 text-gray-400 text-xs">%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(precoVenda)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => { setStep('form'); setNfeData(null) }}>Cancelar</Button>
          <Button className="flex-1" onClick={() => setStep('pagamento')}>
            Avançar <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // ── Step: Form (seleção de modo) ─────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nfe-entradas"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registrar NF-e de Entrada</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Compra de fornecedor — estoque atualizado automaticamente</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Como você quer importar a nota?</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'chave' as Modo, icon: QrCode, title: 'Pela Chave de Acesso', desc: 'Digite a chave de 44 dígitos da NF-e do fornecedor' },
            { id: 'upload' as Modo, icon: Upload, title: 'Upload do XML', desc: 'Importe o arquivo XML da nota fiscal eletrônica' },
            { id: 'digitar' as Modo, icon: PenLine, title: 'Digitar Nota', desc: 'Preencha os dados da nota fiscal manualmente' },
          ].map(({ id, icon: Icon, title, desc }) => (
            <button key={id as string} onClick={() => { setModo(id); setErro(null) }}
              className={cn('p-5 rounded-xl border-2 text-left transition-all', modo === id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')}>
              <Icon className={cn('h-7 w-7 mb-3', modo === id ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500')} />
              <p className="font-semibold text-gray-800 dark:text-gray-200">{title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* ── Chave de acesso ── */}
      {modo === 'chave' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Chave de Acesso</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chave de Acesso (44 dígitos)</label>
              <Input className="font-mono tracking-wider"
                placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                maxLength={54} value={chave}
                onChange={(e) => setChave(e.target.value.replace(/\s/g, ''))} />
              <p className="text-xs text-gray-400 mt-1">{chave.length}/44 dígitos</p>
            </div>
            {chave.length === 44 && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm space-y-3">
                  <p className="font-semibold text-blue-800 dark:text-blue-300">Passo 1 — Baixar o XML da SEFAZ</p>
                  <p className="text-blue-700 dark:text-blue-400">Clique no botão abaixo para abrir o portal da SEFAZ com a chave já preenchida. Resolva o captcha e baixe o arquivo XML.</p>
                  <a href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XMotivo=&chave=${chave}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                    Abrir SEFAZ ↗
                  </a>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm space-y-3">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">Passo 2 — Importar o XML baixado</p>
                  <input ref={inputRef} type="file" accept=".xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  {erro && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-xs text-red-700 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{erro}
                    </div>
                  )}
                  <button onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-600 dark:text-gray-400 text-sm font-medium transition-colors w-full justify-center">
                    <Upload className="h-4 w-4" /> Selecionar arquivo XML
                  </button>
                </div>
              </div>
            )}
            {!chave.length && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                Cole a chave de 44 dígitos acima para ver as instruções de importação.
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => { setModo(null); setErro(null) }}>Voltar</Button>
          </CardContent>
        </Card>
      )}

      {/* ── Upload XML ── */}
      {modo === 'upload' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload do XML</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input ref={inputRef} type="file" accept=".xml" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <div onClick={() => inputRef.current?.click()}
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none',
                dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/30')}>
              <Upload className={cn('h-10 w-10 mx-auto mb-3', dragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500')} />
              <p className="font-medium text-gray-700 dark:text-gray-300">{dragging ? 'Solte o arquivo aqui' : 'Arraste o XML aqui'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ou clique para selecionar o arquivo</p>
              <p className="text-xs text-gray-400 mt-2">Apenas arquivos .xml de NF-e</p>
            </div>
            {erro && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{erro}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => { setModo(null); setErro(null) }}>Voltar</Button>
          </CardContent>
        </Card>
      )}

      {/* ── Digitar Nota ── */}
      {modo === 'digitar' && (
        <div className="space-y-4" onClick={() => setItemDropIdx(null)}>

          {/* Dados da Nota */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Dados da Nota</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número</label>
                <Input placeholder="000001" value={digitarNota.numero}
                  onChange={(e) => setDigitarNota(n => ({ ...n, numero: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Série</label>
                <Input placeholder="1" value={digitarNota.serie}
                  onChange={(e) => setDigitarNota(n => ({ ...n, serie: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Emissão</label>
                <Input type="date" value={digitarNota.dataEmissao}
                  onChange={(e) => setDigitarNota(n => ({ ...n, dataEmissao: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Natureza da Operação</label>
                <Input placeholder="Compra de mercadorias" value={digitarNota.naturezaOperacao}
                  onChange={(e) => setDigitarNota(n => ({ ...n, naturezaOperacao: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          {/* Fornecedor */}
          <Card>
            <CardHeader><CardTitle className="text-base">Fornecedor</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CNPJ com lookup */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ</label>
                <div className="relative">
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={digitarNota.fornecedorCnpj}
                    onChange={(e) => {
                      const fmt = formatCnpj(e.target.value)
                      setDigitarNota(n => ({ ...n, fornecedorCnpj: fmt }))
                      setCnpjFornMsg(null)
                      const digits = fmt.replace(/\D/g, '')
                      if (digits.length >= 3) setFornDropOpen(true)
                      else setFornDropOpen(false)
                      if (digits.length === 14) { setFornDropOpen(false); buscarCnpj(digits, 'fornecedor') }
                    }}
                  />
                  {loadingCnpjForn && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
                </div>
                {/* dropdown de sugestões por CNPJ */}
                {fornDropOpen && (() => {
                  const digits = digitarNota.fornecedorCnpj.replace(/\D/g, '')
                  const sug = fornecedoresDB.filter(f => (f.cpf_cnpj ?? '').replace(/\D/g, '').startsWith(digits)).slice(0, 6)
                  return sug.length > 0 ? (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                      {sug.map(f => (
                        <button key={f.cpf_cnpj} type="button"
                          className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          onClick={() => {
                            const fmt = formatCnpj(f.cpf_cnpj)
                            setDigitarNota(n => ({ ...n, fornecedorCnpj: fmt, fornecedorNome: f.nome }))
                            setFornDropOpen(false); setCnpjFornMsg('✓ Fornecedor selecionado do cadastro')
                          }}>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.nome}</p>
                          <p className="text-xs text-gray-400 font-mono">{formatCnpj(f.cpf_cnpj)}</p>
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
                {cnpjFornMsg && <p className={cn('text-xs mt-1', cnpjFornMsg.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>{cnpjFornMsg}</p>}
              </div>

              {/* Razão Social */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razão Social *</label>
                <Input
                  placeholder="Nome do fornecedor"
                  value={digitarNota.fornecedorNome}
                  onChange={(e) => {
                    setDigitarNota(n => ({ ...n, fornecedorNome: e.target.value }))
                    setFornDropOpen(e.target.value.length >= 2)
                  }}
                />
                {/* dropdown por nome */}
                {fornDropOpen && digitarNota.fornecedorNome.length >= 2 && (() => {
                  const q = digitarNota.fornecedorNome.toLowerCase()
                  const sug = fornecedoresDB.filter(f => f.nome.toLowerCase().includes(q)).slice(0, 6)
                  return sug.length > 0 ? (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                      {sug.map(f => (
                        <button key={f.cpf_cnpj} type="button"
                          className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          onClick={() => {
                            setDigitarNota(n => ({ ...n, fornecedorNome: f.nome, fornecedorCnpj: formatCnpj(f.cpf_cnpj) }))
                            setFornDropOpen(false)
                          }}>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.nome}</p>
                          <p className="text-xs text-gray-400 font-mono">{formatCnpj(f.cpf_cnpj)}</p>
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Transportadora */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Transportadora <span className="text-xs font-normal text-gray-400">(opcional)</span></CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CNPJ transportadora */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ</label>
                <div className="relative">
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={digitarNota.transportadoraCnpj}
                    onChange={(e) => {
                      const fmt = formatCnpj(e.target.value)
                      setDigitarNota(n => ({ ...n, transportadoraCnpj: fmt }))
                      setCnpjTranspMsg(null)
                      const digits = fmt.replace(/\D/g, '')
                      if (digits.length >= 3) setTranspDropOpen(true)
                      else setTranspDropOpen(false)
                      if (digits.length === 14) { setTranspDropOpen(false); buscarCnpj(digits, 'transportadora') }
                    }}
                  />
                  {loadingCnpjTransp && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
                </div>
                {/* dropdown por CNPJ */}
                {transpDropOpen && (() => {
                  const digits = digitarNota.transportadoraCnpj.replace(/\D/g, '')
                  const sug = fornecedoresDB.filter(f => (f.cpf_cnpj ?? '').replace(/\D/g, '').startsWith(digits)).slice(0, 6)
                  return sug.length > 0 ? (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                      {sug.map(f => (
                        <button key={f.cpf_cnpj} type="button"
                          className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          onClick={() => {
                            setDigitarNota(n => ({ ...n, transportadoraCnpj: formatCnpj(f.cpf_cnpj), transportadoraNome: f.nome }))
                            setTranspDropOpen(false); setCnpjTranspMsg('✓ Selecionada do cadastro')
                          }}>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.nome}</p>
                          <p className="text-xs text-gray-400 font-mono">{formatCnpj(f.cpf_cnpj)}</p>
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
                {cnpjTranspMsg && <p className={cn('text-xs mt-1', cnpjTranspMsg.startsWith('✓') ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>{cnpjTranspMsg}</p>}
              </div>

              {/* Nome transportadora */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome / Razão Social</label>
                <Input
                  placeholder="Nome da transportadora"
                  value={digitarNota.transportadoraNome}
                  onChange={(e) => {
                    setDigitarNota(n => ({ ...n, transportadoraNome: e.target.value }))
                    setTranspDropOpen(e.target.value.length >= 2)
                  }}
                />
                {transpDropOpen && digitarNota.transportadoraNome.length >= 2 && (() => {
                  const q = digitarNota.transportadoraNome.toLowerCase()
                  const sug = fornecedoresDB.filter(f => f.nome.toLowerCase().includes(q)).slice(0, 6)
                  return sug.length > 0 ? (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                      {sug.map(f => (
                        <button key={f.cpf_cnpj} type="button"
                          className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          onClick={() => {
                            setDigitarNota(n => ({ ...n, transportadoraNome: f.nome, transportadoraCnpj: formatCnpj(f.cpf_cnpj) }))
                            setTranspDropOpen(false)
                          }}>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.nome}</p>
                          <p className="text-xs text-gray-400 font-mono">{formatCnpj(f.cpf_cnpj)}</p>
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Itens da Nota</CardTitle>
                <Button size="sm" variant="outline" onClick={addDigitarItem}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      {['Produto', 'Código', 'NCM', 'CFOP', 'Un.', 'Qtd', 'Valor Unit. (R$)', 'Total', ''].map((h) => (
                        <th key={h} className={cn('px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap',
                          ['Qtd', 'Valor Unit. (R$)', 'Total'].includes(h) ? 'text-right' : 'text-left')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {digitarItens.map((item, i) => {
                      const search = itemSearches[i] ?? ''
                      const prodsFiltrados = search.length >= 2
                        ? produtosDB.filter(p =>
                            p.descricao.toLowerCase().includes(search.toLowerCase()) ||
                            p.codigo.toLowerCase().includes(search.toLowerCase())
                          ).slice(0, 8)
                        : []
                      return (
                        <tr key={i} className="align-top">
                          {/* Produto (com autocomplete) */}
                          <td className="px-3 py-2 relative" onClick={(e) => e.stopPropagation()}>
                            <Input className="w-52 h-8 text-sm" placeholder="Buscar produto..."
                              value={search}
                              onChange={(e) => {
                                const v = e.target.value
                                setItemSearches(prev => prev.map((s, idx) => idx === i ? v : s))
                                setItemDropIdx(v.length >= 2 ? i : null)
                                if (!v) updateDigitarItem(i, 'descricao', '')
                              }}
                              onFocus={() => { if (search.length >= 2) setItemDropIdx(i) }}
                            />
                            {itemDropIdx === i && prodsFiltrados.length > 0 && (
                              <div className="absolute z-30 left-3 top-full mt-0.5 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                                {prodsFiltrados.map(p => (
                                  <button key={p.codigo} type="button"
                                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    onClick={() => selecionarProduto(i, p)}>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.descricao}</p>
                                    <p className="text-xs text-gray-400">Cód: {p.codigo} · {formatCurrency(p.preco_venda || p.preco_unitario)}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Se não selecionou produto do BD, mostrar campo descrição livre */}
                            {!produtosDB.find(p => p.descricao === item.descricao && item.descricao) && item.descricao === '' && (
                              <p className="text-xs text-gray-400 mt-0.5">ou <button type="button" className="text-blue-500 underline"
                                onClick={() => { updateDigitarItem(i, 'descricao', search); setItemSearches(prev => prev.map((s, idx) => idx === i ? search : s)); setItemDropIdx(null) }}>
                                usar "{search}" diretamente</button></p>
                            )}
                            {item.descricao && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{item.descricao}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <Input className="w-20 h-8 text-sm font-mono" placeholder="0001"
                              value={item.codigo} onChange={(e) => updateDigitarItem(i, 'codigo', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <Input className="w-24 h-8 text-sm font-mono" placeholder="00000000"
                              value={item.ncm} onChange={(e) => updateDigitarItem(i, 'ncm', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <Input className="w-16 h-8 text-sm font-mono" placeholder="1102"
                              value={item.cfop} onChange={(e) => updateDigitarItem(i, 'cfop', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <select className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              value={item.unidade} onChange={(e) => updateDigitarItem(i, 'unidade', e.target.value)}>
                              {['UN','CX','KG','LT','MT','PC','PAR'].map(u => <option key={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input type="number" min="0.001" step="0.001" className="w-20 h-8 text-sm text-right"
                              value={item.quantidade} onChange={(e) => updateDigitarItem(i, 'quantidade', parseFloat(e.target.value) || 0)} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input type="number" min="0" step="0.01" className="w-28 h-8 text-sm text-right"
                              value={item.valorUnitario || ''} placeholder="0,00"
                              onChange={(e) => updateDigitarItem(i, 'valorUnitario', parseFloat(e.target.value) || 0)} />
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{formatCurrency(item.quantidade * item.valorUnitario)}</span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {digitarItens.length > 1 && (
                              <button onClick={() => removeDigitarItem(i)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30">
                      <td colSpan={7} className="px-3 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Valor Total da Nota</td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-bold text-gray-900 dark:text-white text-base">
                          {formatCurrency(digitarItens.reduce((sum, it) => sum + it.quantidade * it.valorUnitario, 0))}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {erro && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{erro}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setModo(null); setErro(null) }}>Voltar</Button>
            <Button className="flex-1" onClick={handleSalvarDigitada}
              disabled={!digitarNota.fornecedorNome || digitarItens.every(it => !it.descricao && !it.codigo)}>
              <ChevronRight className="h-4 w-4 mr-1" /> Revisar Nota
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
