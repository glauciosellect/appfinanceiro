'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, QrCode, CheckCircle2, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'

type Modo = 'chave' | 'upload' | null
type Step = 'form' | 'review' | 'success'

interface ParsedItem {
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

interface ParsedNFe {
  numero: string
  serie: string
  dataEmissao: string
  fornecedorNome: string
  fornecedorCnpj: string
  naturezaOperacao: string
  valorTotal: number
  itens: ParsedItem[]
}

function getText(el: Element | Document, tag: string): string {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? ''
}

function parseNFeXML(xmlText: string): ParsedNFe {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  const parseError = doc.getElementsByTagName('parsererror')[0]
  if (parseError) throw new Error('XML inválido')

  const ide = doc.getElementsByTagName('ide')[0]
  const emit = doc.getElementsByTagName('emit')[0]
  const icmsTot = doc.getElementsByTagName('ICMSTot')[0]

  if (!ide || !emit) throw new Error('Estrutura de NF-e não reconhecida')

  const itens: ParsedItem[] = Array.from(doc.getElementsByTagName('det')).map((det) => {
    const prod = det.getElementsByTagName('prod')[0]
    return {
      codigo: getText(prod, 'cProd'),
      descricao: getText(prod, 'xProd'),
      ncm: getText(prod, 'NCM'),
      cfop: getText(prod, 'CFOP'),
      unidade: getText(prod, 'uCom'),
      quantidade: parseFloat(getText(prod, 'qCom')) || 0,
      valorUnitario: parseFloat(getText(prod, 'vUnCom')) || 0,
      valorTotal: parseFloat(getText(prod, 'vProd')) || 0,
    }
  })

  return {
    numero: getText(ide, 'nNF'),
    serie: getText(ide, 'serie'),
    dataEmissao: getText(ide, 'dhEmi') || getText(ide, 'dEmi'),
    fornecedorNome: getText(emit, 'xNome'),
    fornecedorCnpj: getText(emit, 'CNPJ'),
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

  function handleFile(file: File) {
    setErro(null)
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setErro('Apenas arquivos .xml são aceitos.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const data = parseNFeXML(text)
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
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  async function handleImportar() {
    if (!nfeData) return
    setSalvando(true)
    setErro(null)
    try {
      const res = await fetch('/api/estoque/import-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nfeData),
      })
      if (!res.ok) {
        const body = await res.json()
        setErro(body.erros?.join(', ') ?? 'Erro ao importar. Tente novamente.')
        return
      }
      setStep('success')
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // Tela de sucesso
  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">NF-e de Entrada importada!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {nfeData?.itens.length} produto(s) adicionados ao estoque automaticamente.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" asChild><Link href="/estoque">Ver Estoque</Link></Button>
          <Button asChild><Link href="/nfe-entradas">Ver Entradas</Link></Button>
        </div>
      </div>
    )
  }

  // Tela de revisão
  if (step === 'review' && nfeData) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setStep('form'); setNfeData(null) }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revisar NF-e de Entrada</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Confirme os dados antes de importar para o estoque</p>
          </div>
        </div>

        {/* Dados da nota */}
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

        {/* Produtos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos ({nfeData.itens.length})</CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">Estes produtos serão adicionados ao seu estoque</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    {['Código', 'Descrição', 'NCM', 'Un.', 'Qtd', 'Vl. Unit.', 'Total'].map((h) => (
                      <th key={h} className={cn('px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide',
                        ['Qtd', 'Vl. Unit.', 'Total'].includes(h) ? 'text-right' : 'text-left')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {nfeData.itens.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.codigo}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{item.descricao}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{item.ncm}</td>
                      <td className="px-4 py-3 text-gray-500">{item.unidade}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{item.quantidade}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.valorUnitario)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(item.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {erro && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {erro}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => { setStep('form'); setNfeData(null) }} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleImportar} disabled={salvando}>
            {salvando ? 'Importando...' : `Confirmar e Importar ${nfeData.itens.length} produto(s)`}
          </Button>
        </div>
      </div>
    )
  }

  // Tela principal (seleção de modo)
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nfe-entradas"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Registrar NF-e de Entrada</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Compra de fornecedor — estoque atualizado automaticamente
          </p>
        </div>
      </div>

      {/* Seleção de modo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Como você quer importar a nota?</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'chave' as Modo, icon: QrCode, title: 'Pela Chave de Acesso', desc: 'Digite a chave de 44 dígitos da NF-e do fornecedor' },
            { id: 'upload' as Modo, icon: Upload, title: 'Upload do XML', desc: 'Importe o arquivo XML da nota fiscal eletrônica' },
          ].map(({ id, icon: Icon, title, desc }) => (
            <button key={id as string} onClick={() => { setModo(id); setErro(null) }}
              className={cn('p-5 rounded-xl border-2 text-left transition-all', modo === id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')}>
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
              <Input className="font-mono tracking-wider" placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                maxLength={47} value={chave} onChange={(e) => setChave(e.target.value.replace(/\s/g, ''))} />
              <p className="text-xs text-gray-400 mt-1">{chave.length}/44 dígitos</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Como funciona?</p>
              <p>O sistema consulta a SEFAZ com essa chave, importa todos os dados da nota e atualiza seu estoque automaticamente.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setModo(null)}>Voltar</Button>
              <Button className="flex-1" disabled={chave.length < 44}>Consultar e Importar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload XML */}
      {modo === 'upload' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload do XML</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Input oculto */}
            <input
              ref={inputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />

            {/* Zona de drop */}
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={cn(
                'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none',
                dragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
              )}
            >
              <Upload className={cn('h-10 w-10 mx-auto mb-3', dragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500')} />
              <p className="font-medium text-gray-700 dark:text-gray-300">
                {dragging ? 'Solte o arquivo aqui' : 'Arraste o XML aqui'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ou clique para selecionar o arquivo</p>
              <p className="text-xs text-gray-400 mt-2">Apenas arquivos .xml de NF-e</p>
            </div>

            {erro && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {erro}
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={() => { setModo(null); setErro(null) }}>Voltar</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
