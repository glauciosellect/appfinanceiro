'use client'

import { useCallback, useEffect, useState, type ChangeEvent, type DragEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, QrCode, CheckCircle2, Loader2, AlertTriangle, PackagePlus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { parseNFeXml, type ParsedNFeXml } from '@/lib/fiscal/parse-nfe-xml'
import { saveEntradaImportada, loadEntradasImportadas } from '@/lib/fiscal/nfe-entradas-storage'

type Modo = 'chave' | 'upload' | null

interface ProdutoCadastro {
  id: string
  codigo: string
  descricao: string
  barcode: string | null
  unidade: string
  estoque: number
  preco_custo: number
  margem_lucro: number
  preco_venda: number
}

interface LinhaPrevia {
  key: number
  produtoId: string          // '' = produto novo
  barcode: string | null
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  custo: number              // custo da nota fiscal, SEM margem
  margem: number
  preco: number              // preço de venda = custo + margem
}

const MARGEM_PADRAO = 30
const arred = (n: number) => Math.round(n * 100) / 100
const normaliza = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

function onlyNFeKeyDigits(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 44)
}

function isXmlNFeFile(file: File) {
  return file.name.toLowerCase().endsWith('.xml')
}

export default function NovaEntradaPage() {
  const [modo, setModo] = useState<Modo>(null)
  const [chave, setChave] = useState('')
  const [xmlFile, setXmlFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [xmlErro, setXmlErro] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [step, setStep] = useState<'form' | 'previa' | 'success'>('form')

  // Prévia da nota
  const [nota, setNota] = useState<ParsedNFeXml | null>(null)
  const [linhas, setLinhas] = useState<LinhaPrevia[]>([])
  const [produtos, setProdutos] = useState<ProdutoCadastro[]>([])
  const [margemGeral, setMargemGeral] = useState(String(MARGEM_PADRAO))
  const [lancando, setLancando] = useState(false)
  const [errosLancamento, setErrosLancamento] = useState<string[]>([])
  const [resumo, setResumo] = useState<{ criados: number; atualizados: number } | null>(null)

  /** Evita que o navegador abra o XML em nova aba ao soltar o arquivo fora da área tracejada. */
  useEffect(() => {
    if (modo !== 'upload' || step !== 'form') return
    const bloquearNavegacao = (e: globalThis.DragEvent) => {
      e.preventDefault()
    }
    window.addEventListener('dragover', bloquearNavegacao)
    window.addEventListener('drop', bloquearNavegacao)
    return () => {
      window.removeEventListener('dragover', bloquearNavegacao)
      window.removeEventListener('drop', bloquearNavegacao)
    }
  }, [modo, step])

  const assignXmlFile = useCallback((file: File | null) => {
    setXmlErro(null)
    if (!file) {
      setXmlFile(null)
      return
    }
    if (!isXmlNFeFile(file)) {
      setXmlFile(null)
      setXmlErro('Selecione um arquivo .xml de NF-e.')
      return
    }
    setXmlFile(file)
  }, [])

  const onXmlInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    assignXmlFile(file)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0] ?? null
    assignXmlFile(file)
  }

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  const onDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  // 1º passo: lê o XML e abre a PRÉVIA — nada é gravado até o usuário confirmar.
  async function handleImportarXml() {
    if (!xmlFile) return
    setXmlErro(null)
    setImportando(true)
    try {
      const text = await xmlFile.text()
      const parsed = parseNFeXml(text)
      if (loadEntradasImportadas().some((e) => e.chaveAcesso === parsed.chaveAcesso)) {
        setXmlErro('Esta nota (mesma chave) já foi importada.')
        return
      }
      if (parsed.itens.length === 0) {
        setXmlErro('O XML não tem itens de mercadoria para dar entrada no estoque.')
        return
      }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setXmlErro('Sessão expirada. Entre novamente.'); return }
      const { data } = await supabase
        .from('produtos_fiscais')
        .select('id, codigo, descricao, barcode, unidade, estoque, preco_custo, margem_lucro, preco_venda')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('descricao')
      const cadastrados = (data ?? []) as ProdutoCadastro[]
      setProdutos(cadastrados)

      // Reconhece o produto pelo código de barras ou pelo nome; senão será cadastrado como novo
      const usados = new Set<string>()
      const montadas: LinhaPrevia[] = parsed.itens.map((it, i) => {
        const achado = cadastrados.find((p) =>
          !usados.has(p.id) &&
          ((it.barcode && p.barcode === it.barcode) || normaliza(p.descricao) === normaliza(it.descricao)))
        if (achado) usados.add(achado.id)
        const custo = arred(it.custoUnitario)
        const margem = achado && Number(achado.margem_lucro) > 0 ? Number(achado.margem_lucro) : MARGEM_PADRAO
        return {
          key: i,
          produtoId: achado?.id ?? '',
          barcode: it.barcode,
          descricao: it.descricao,
          ncm: it.ncm,
          cfop: it.cfop,
          unidade: it.unidade,
          quantidade: it.quantidade,
          custo,
          margem,
          preco: arred(custo * (1 + margem / 100)),
        }
      })
      setNota(parsed)
      setLinhas(montadas)
      setErrosLancamento([])
      setStep('previa')
    } catch (err) {
      setXmlErro(err instanceof Error ? err.message : 'Não foi possível ler o XML.')
    } finally {
      setImportando(false)
    }
  }

  function alterarLinha(i: number, parcial: Partial<LinhaPrevia>) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...parcial } : l)))
  }
  // O preço de venda é sempre CUSTO DA NOTA + margem; o custo nunca recebe a margem.
  function alterarCusto(i: number, custo: number) {
    alterarLinha(i, { custo, preco: arred(custo * (1 + linhas[i].margem / 100)) })
  }
  function alterarMargem(i: number, margem: number) {
    alterarLinha(i, { margem, preco: arred(linhas[i].custo * (1 + margem / 100)) })
  }
  function alterarPreco(i: number, preco: number) {
    const custo = linhas[i].custo
    alterarLinha(i, { preco, margem: custo > 0 ? Math.max(0, Math.round((preco / custo - 1) * 10000) / 100) : linhas[i].margem })
  }
  function trocarProduto(i: number, produtoId: string) {
    const p = produtos.find((x) => x.id === produtoId)
    const margem = p && Number(p.margem_lucro) > 0 ? Number(p.margem_lucro) : MARGEM_PADRAO
    alterarLinha(i, { produtoId, margem, preco: arred(linhas[i].custo * (1 + margem / 100)) })
  }
  function aplicarMargemGeral() {
    const m = Math.max(0, Number(margemGeral.replace(',', '.')) || 0)
    setLinhas((ls) => ls.map((l) => ({ ...l, margem: m, preco: arred(l.custo * (1 + m / 100)) })))
  }

  const totalItens = linhas.reduce((s, l) => s + arred(l.quantidade * l.custo), 0)
  const linhaInvalida = linhas.some((l) => !(l.quantidade > 0) || !(l.custo > 0) || !(l.preco > 0) || !l.descricao.trim())
  const produtoDuplicado = (() => {
    const ids = linhas.map((l) => l.produtoId).filter(Boolean)
    return new Set(ids).size !== ids.length
  })()
  const novos = linhas.filter((l) => !l.produtoId).length

  // 2º passo: confirmado na prévia, lança estoque e preços.
  async function handleConfirmarLancamento() {
    if (!nota || linhaInvalida || produtoDuplicado) return
    setLancando(true)
    setErrosLancamento([])
    try {
      const res = await fetch('/api/estoque/import-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: nota.numero,
          serie: nota.serie,
          dataEmissao: nota.dataEmissao,
          fornecedorNome: nota.fornecedorNome,
          fornecedorCnpj: nota.fornecedorCnpj,
          naturezaOperacao: nota.naturezaOperacao,
          itens: linhas.map((l) => ({
            produto_id: l.produtoId || null,
            barcode: l.barcode,
            descricao: l.descricao.trim(),
            ncm: l.ncm,
            cfop: l.cfop,
            unidade: l.unidade,
            quantidade: l.quantidade,
            custo: l.custo,
            margem: l.margem,
            preco_venda: l.preco,
          })),
        }),
      })
      const json = (await res.json()) as { ok?: boolean; erros?: string[]; criados?: number; atualizados?: number }
      if (!res.ok || !json.ok) {
        setErrosLancamento(json.erros ?? ['Não foi possível lançar a nota no estoque.'])
        return
      }
      saveEntradaImportada({
        id: crypto.randomUUID(),
        numero: nota.numero,
        serie: nota.serie,
        chaveAcesso: nota.chaveAcesso,
        dataEmissao: nota.dataEmissao,
        naturezaOperacao: nota.naturezaOperacao,
        valorTotal: nota.valorTotal,
        fornecedorNome: nota.fornecedorNome,
        fornecedorCnpj: nota.fornecedorCnpj,
        fonte: 'xml',
        importadoEm: new Date().toISOString(),
      })
      window.dispatchEvent(new Event('syncromoney:nfe-entradas'))
      setResumo({ criados: json.criados ?? 0, atualizados: json.atualizados ?? 0 })
      setStep('success')
    } catch (err) {
      setErrosLancamento([err instanceof Error ? err.message : 'Erro ao lançar a nota.'])
    } finally {
      setLancando(false)
    }
  }

  function handleImportarChave() {
    if (chave.length !== 44) return
    setXmlErro(null)
    const result = saveEntradaImportada({
      id: crypto.randomUUID(),
      numero: '—',
      serie: '—',
      chaveAcesso: chave,
      dataEmissao: new Date().toISOString().slice(0, 10),
      naturezaOperacao: 'Importação por chave de acesso',
      valorTotal: 0,
      fornecedorNome: 'A identificar (consulta SEFAZ pendente)',
      fornecedorCnpj: '—',
      fonte: 'chave',
      importadoEm: new Date().toISOString(),
    })
    if (!result.ok) {
      setXmlErro(result.error)
      return
    }
    window.dispatchEvent(new Event('syncromoney:nfe-entradas'))
    setResumo(null)
    setStep('success')
  }

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {resumo ? 'Entrada lançada no estoque' : 'Importação registrada'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {resumo
            ? `${resumo.criados} produto(s) novo(s) cadastrado(s) e ${resumo.atualizados} produto(s) existente(s) atualizado(s). O custo de cada produto é o valor da nota fiscal; o preço de venda é o custo mais a margem que você confirmou.`
            : 'A nota foi registrada na lista de Notas de Entrada neste navegador. A chave de acesso não traz os itens: para lançar no estoque, importe o XML da nota.'}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild><Link href="/estoque">Ver Estoque</Link></Button>
          <Button asChild><Link href="/nfe-entradas">Ver Entradas</Link></Button>
        </div>
      </div>
    )
  }

  if (step === 'previa' && nota) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setStep('form')} disabled={lancando}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prévia da Nota de Entrada</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Confira tudo e corrija o que precisar. Nada foi gravado ainda — o estoque só é atualizado quando você confirmar.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div className="lg:col-span-2">
              <p className="text-xs text-gray-500">Fornecedor</p>
              <p className="font-semibold text-gray-900 dark:text-white">{nota.fornecedorNome}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">CNPJ {nota.fornecedorCnpj} · será cadastrado em Fornecedores se ainda não existir</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Nota</p>
              <p className="font-semibold text-gray-900 dark:text-white">Série {nota.serie} · Nº {nota.numero}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs">Emitida em {formatDate(nota.dataEmissao)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total da nota / dos itens</p>
              <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(nota.valorTotal)} / {formatCurrency(totalItens)}</p>
              {Math.abs(nota.valorTotal - totalItens) > 0.05 && (
                <p className="text-xs text-amber-600">Diferença = frete, desconto ou impostos da nota</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Itens da nota ({linhas.length})</CardTitle>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Margem para todos:</span>
              <Input className="h-9 w-20 text-right" type="number" min="0" step="1" value={margemGeral}
                onChange={(e) => setMargemGeral(e.target.value)} />
              <span className="text-gray-500">%</span>
              <Button type="button" variant="outline" size="sm" onClick={aplicarMargemGeral}>Aplicar</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
              <strong>Custo</strong> = valor unitário da nota fiscal, sem acréscimo. A <strong>margem</strong> é somada ao custo só para chegar ao <strong>preço de venda</strong>.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-2 text-left">Produto</th>
                    <th className="py-2 px-2 text-left w-52">No estoque</th>
                    <th className="py-2 px-2 text-right w-24">Qtd</th>
                    <th className="py-2 px-2 text-right w-28">Custo NF (R$)</th>
                    <th className="py-2 px-2 text-right w-24">Margem %</th>
                    <th className="py-2 px-2 text-right w-28">Venda (R$)</th>
                    <th className="py-2 pl-2 text-right w-28">Total custo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 align-top">
                  {linhas.map((l, i) => {
                    const existente = produtos.find((p) => p.id === l.produtoId)
                    return (
                      <tr key={l.key}>
                        <td className="py-2 pr-2">
                          <Input className="h-9 min-w-[220px]" value={l.descricao}
                            onChange={(e) => alterarLinha(i, { descricao: e.target.value })} />
                          <p className="text-[11px] text-gray-400 mt-1">
                            {l.unidade}{l.ncm ? ` · NCM ${l.ncm}` : ''}{l.barcode ? ` · EAN ${l.barcode}` : ''}
                          </p>
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                            value={l.produtoId} onChange={(e) => trocarProduto(i, e.target.value)}>
                            <option value="">➕ Cadastrar como produto novo</option>
                            {produtos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
                          </select>
                          {existente ? (
                            <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                              <RefreshCw className="h-3 w-3" />
                              Estoque {Number(existente.estoque)} → <strong>{Number(existente.estoque) + l.quantidade}</strong>
                              {' · custo '}{formatCurrency(Number(existente.preco_custo))} → {formatCurrency(l.custo)}
                            </p>
                          ) : (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
                              <PackagePlus className="h-3 w-3" />Produto novo (código automático)
                            </p>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min="0" step="any" className="text-right h-9" value={l.quantidade || ''}
                            onChange={(e) => alterarLinha(i, { quantidade: Number(e.target.value) })} />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min="0" step="0.01" className="text-right h-9" value={l.custo || ''}
                            onChange={(e) => alterarCusto(i, Number(e.target.value))} />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min="0" step="0.01" className="text-right h-9" value={l.margem}
                            onChange={(e) => alterarMargem(i, Math.max(0, Number(e.target.value)))} />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min="0" step="0.01" className="text-right h-9 text-green-700 dark:text-green-400 font-semibold"
                            value={l.preco || ''} onChange={(e) => alterarPreco(i, Number(e.target.value))} />
                        </td>
                        <td className="py-2 pl-2 text-right font-semibold text-gray-800 dark:text-gray-200 pt-4">
                          {formatCurrency(arred(l.quantidade * l.custo))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {produtoDuplicado && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />Dois itens da nota estão ligados ao mesmo produto do estoque. Ajuste a coluna &quot;No estoque&quot;.
          </p>
        )}
        {errosLancamento.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300 space-y-1">
            {errosLancamento.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div>
            <p className="text-xs text-gray-500">Vai lançar</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              {linhas.length} item(ns) no estoque · {novos} produto(s) novo(s) · {linhas.length - novos} atualizado(s)
            </p>
            {linhaInvalida && <p className="text-xs text-amber-600">Preencha quantidade, custo e preço de venda de todos os itens.</p>}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('form')} disabled={lancando}>Voltar</Button>
            <Button onClick={handleConfirmarLancamento} disabled={lancando || linhaInvalida || produtoDuplicado}>
              {lancando ? (<><Loader2 className="h-4 w-4 animate-spin mr-2 inline" />Lançando…</>) : 'Confirmar e lançar no estoque'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nfe-entradas"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registrar NF-e de Entrada</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Registro de compras com NF-e de mercadoria (fornecedor)
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Como você quer importar a nota?</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'chave' as Modo, icon: QrCode, title: 'Pela Chave de Acesso', desc: 'Só registra a nota na lista (não traz os itens)' },
            { id: 'upload' as Modo, icon: Upload, title: 'Upload do XML', desc: 'Lê os itens, mostra a prévia e dá entrada no estoque' },
          ].map(({ id, icon: Icon, title, desc }) => (
            <button key={id as string} onClick={() => { setModo(id); setXmlErro(null); setXmlFile(null); setChave('') }}
              className={cn('p-5 rounded-xl border-2 text-left transition-all', modo === id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')}>
              <Icon className={cn('h-7 w-7 mb-3', modo === id ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500')} />
              <p className="font-semibold text-gray-800 dark:text-gray-200">{title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desc}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {modo === 'chave' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Chave de Acesso</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chave de Acesso (44 dígitos)</label>
              <Input
                className="font-mono tracking-wider"
                placeholder="Cole a chave — pontos e espaços são ignorados"
                inputMode="numeric"
                autoComplete="off"
                maxLength={54}
                value={chave}
                onChange={(e) => setChave(onlyNFeKeyDigits(e.target.value))}
              />
              <p className="text-xs text-gray-400 mt-1">{chave.length}/44 dígitos</p>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-2">
                A chave de <strong>NF-e de mercadoria</strong> tem sempre 44 números (no DANFE costuma aparecer em bloco ou com espaços).
                <strong> NFS-e</strong> (serviço) não usa esta chave — use o módulo de notas de serviço ou o XML da prefeitura, conforme o caso.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Como funciona?</p>
              <p>O registro por chave grava a nota na lista localmente, <strong>sem itens</strong> — por isso não altera o estoque. Para dar entrada nas mercadorias, use o <strong>Upload do XML</strong>.</p>
            </div>
            {xmlErro && <p className="text-sm text-red-600 dark:text-red-400">{xmlErro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setModo(null); setXmlErro(null) }}>Voltar</Button>
              <Button className="flex-1" disabled={chave.length < 44} onClick={handleImportarChave}>
                Registrar nota
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {modo === 'upload' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload do XML</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Solte o arquivo <strong>só dentro da área tracejada</strong>. Se soltar em cima da barra de endereço ou fora do app, o navegador pode abrir o XML em uma aba nova — isso é comportamento do Chrome, não do SyncroMoney.
            </p>
            {/*
              <label> em volta do input: o clique abre o seletor em qualquer navegador/PWA
              (melhor que input invisível por cima ou input.click() via botão).
            */}
            <label
              htmlFor="nfe-xml-upload"
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                'flex w-full min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/25'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50/80 dark:hover:bg-gray-800/40',
                xmlFile && 'border-green-500 bg-green-50/80 dark:bg-green-900/20'
              )}
            >
              <input
                id="nfe-xml-upload"
                type="file"
                accept=".xml,text/xml,application/xml,application/octet-stream"
                className="sr-only"
                onChange={onXmlInputChange}
              />
              <Upload className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto mb-3 shrink-0" aria-hidden />
              <span className="font-medium text-gray-700 dark:text-gray-300">Arraste o XML aqui</span>
              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">ou clique para selecionar o arquivo</span>
              <span className="text-xs text-gray-400 mt-2">Apenas arquivos .xml de NF-e</span>
              {xmlFile && (
                <span className="text-sm font-medium text-green-700 dark:text-green-400 mt-4 max-w-full break-all px-2">
                  Arquivo: {xmlFile.name}
                </span>
              )}
            </label>
            {xmlErro && <p className="text-sm text-red-600 dark:text-red-400">{xmlErro}</p>}
            <p className="text-center text-sm text-blue-600 dark:text-blue-400">
              <label htmlFor="nfe-xml-upload" className="cursor-pointer underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300">
                Abrir pasta de arquivos…
              </label>
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setModo(null)
                  setXmlFile(null)
                  setXmlErro(null)
                }}
              >
                Voltar
              </Button>
              <Button className="flex-1" disabled={!xmlFile || importando} onClick={handleImportarXml}>
                {importando ? (<><Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> Lendo…</>) : 'Ler XML e ver prévia'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
