'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, QrCode, CheckCircle2, FileText, AlertCircle, CreditCard, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type Modo = 'chave' | 'upload' | null
type Step = 'form' | 'review' | 'pagamento' | 'success'

interface ParsedItem {
  codigo: string; descricao: string; ncm: string; cfop: string
  unidade: string; quantidade: number; valorUnitario: number; valorTotal: number
}
interface ParsedNFe {
  numero: string; serie: string; dataEmissao: string
  fornecedorNome: string; fornecedorCnpj: string
  naturezaOperacao: string; valorTotal: number; itens: ParsedItem[]
}
interface SelectOption { id: string; nome: string; extra?: string }

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

export default function NovaEntradaPage() {
  const [modo, setModo] = useState<Modo>(null)
  const [chave, setChave] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [nfeData, setNfeData] = useState<ParsedNFe | null>(null)
  const [dragging, setDragging] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Margem de lucro
  const [margemGlobal, setMargemGlobal] = useState(30)
  const [margens, setMargens] = useState<Record<number, number>>({})
  const getMargemItem = (i: number) => margens[i] ?? margemGlobal
  const getPrecoVenda = (custo: number, margem: number) =>
    Math.round(custo * (1 + margem / 100) * 100) / 100

  // Contas a pagar
  const [lancaCP, setLancaCP] = useState(true)
  const [vencimento, setVencimento] = useState('')
  const [numParcelas, setNumParcelas] = useState(1)
  const [formaPagamentoId, setFormaPagamentoId] = useState('')
  const [contaCorrenteId, setContaCorrenteId] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [formas, setFormas] = useState<SelectOption[]>([])
  const [contas, setContas] = useState<SelectOption[]>([])
  const [loadingOpcoes, setLoadingOpcoes] = useState(false)

  // Carrega formas de pagamento e contas correntes ao entrar no step pagamento
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

    // Data padrão: hoje + 30 dias
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
      // 1. Importar produtos no estoque
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

      // 2. Lançar no contas a pagar (se solicitado)
      if (lancaCP && vencimento) {
        const resCP = await fetch('/api/contas-pagar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descricao: `NF-e Entrada ${nfeData.serie}/${nfeData.numero} — ${nfeData.fornecedorNome}`,
            valor_total: nfeData.valorTotal,
            num_parcelas: numParcelas,
            juros_percentual: 0,
            multa_percentual: 0,
            desconto_valor: 0,
            data_primeira_parcela: vencimento,
            forma_pagamento_id: formaPagamentoId || null,
            conta_corrente_id: contaCorrenteId || null,
            observacoes: observacoes || `NF-e ${nfeData.serie}/${nfeData.numero} — ${nfeData.fornecedorNome}`,
          }),
        })
        if (!resCP.ok) {
          const body = await resCP.json()
          setErro(body.error ?? 'Erro ao lançar conta a pagar.')
          return
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

        {/* Toggle Sim/Não */}
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

        {/* Formulário (só aparece se sim) */}
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
                      <select
                        value={numParcelas}
                        onChange={(e) => setNumParcelas(Number(e.target.value))}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                          <option key={n} value={n}>{n}x {n > 1 ? `de ${formatCurrency(nfeData.valorTotal / n)}` : '(à vista)'}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Forma de Pagamento</label>
                    <select
                      value={formaPagamentoId}
                      onChange={(e) => setFormaPagamentoId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <option value="">— Selecionar —</option>
                      {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Banco / Conta Corrente</label>
                    <select
                      value={contaCorrenteId}
                      onChange={(e) => setContaCorrenteId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <option value="">— Selecionar —</option>
                      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.extra}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observações</label>
                    <Input
                      placeholder="Ex: pagamento via PIX em 30 dias"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                    />
                  </div>

                  {/* Resumo */}
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
              { label: 'CNPJ', value: nfeData.fornecedorCnpj },
              { label: 'Número', value: `${nfeData.serie}/${nfeData.numero}` },
              { label: 'Natureza', value: nfeData.naturezaOperacao },
              { label: 'Emissão', value: nfeData.dataEmissao ? new Date(nfeData.dataEmissao).toLocaleDateString('pt-BR') : '—' },
              { label: 'Valor Total', value: formatCurrency(nfeData.valorTotal) },
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
    <div className="max-w-2xl mx-auto space-y-6">
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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'chave' as Modo, icon: QrCode, title: 'Pela Chave de Acesso', desc: 'Digite a chave de 44 dígitos da NF-e do fornecedor' },
            { id: 'upload' as Modo, icon: Upload, title: 'Upload do XML', desc: 'Importe o arquivo XML da nota fiscal eletrônica' },
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

      {/* Chave de acesso */}
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
                {/* Passo 1 */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm space-y-3">
                  <p className="font-semibold text-blue-800 dark:text-blue-300">Passo 1 — Baixar o XML da SEFAZ</p>
                  <p className="text-blue-700 dark:text-blue-400">Clique no botão abaixo para abrir o portal da SEFAZ com a chave já preenchida. Resolva o captcha e baixe o arquivo XML.</p>
                  <a
                    href={`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=XMotivo=&chave=${chave}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                    Abrir SEFAZ ↗
                  </a>
                </div>

                {/* Passo 2 — upload inline */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm space-y-3">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">Passo 2 — Importar o XML baixado</p>
                  <input ref={inputRef} type="file" accept=".xml" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  {erro && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 text-xs text-red-700 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />{erro}
                    </div>
                  )}
                  <button
                    onClick={() => inputRef.current?.click()}
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

      {/* Upload XML */}
      {modo === 'upload' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload do XML</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <input ref={inputRef} type="file" accept=".xml" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              className={cn('border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none',
                dragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/30')}>
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
    </div>
  )
}
