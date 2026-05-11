'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Search, Send, Save, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { produtosFiscais } from '@/lib/fiscal/mock-data'
import type { ProdutoFiscal } from '@/lib/fiscal/types'

interface ItemForm {
  produto: ProdutoFiscal | null
  quantidade: number
  valorUnitario: number
  desconto: number
}

export default function NovaNFePage() {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [destinatario, setDestinatario] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [natureza, setNatureza] = useState('Venda de Mercadoria')
  const [itens, setItens] = useState<ItemForm[]>([
    { produto: null, quantidade: 1, valorUnitario: 0, desconto: 0 },
  ])
  const [buscaIdx, setBuscaIdx] = useState<number | null>(null)
  const [termoBusca, setTermoBusca] = useState('')

  const total = itens.reduce((s, i) => {
    const sub = i.quantidade * i.valorUnitario
    return s + sub - (sub * i.desconto) / 100
  }, 0)

  function addItem() {
    setItens([...itens, { produto: null, quantidade: 1, valorUnitario: 0, desconto: 0 }])
  }
  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, field: keyof ItemForm, value: unknown) {
    setItens(itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function selecionarProduto(idx: number, produto: ProdutoFiscal) {
    setItens(itens.map((it, i) => i === idx ? { ...it, produto, valorUnitario: produto.precoUnitario } : it))
    setBuscaIdx(null)
    setTermoBusca('')
  }

  const produtosFiltrados = produtosFiscais.filter(
    (p) => p.descricao.toLowerCase().includes(termoBusca.toLowerCase()) || p.codigo.includes(termoBusca)
  )

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">NF-e emitida com sucesso!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Sua NF-e foi transmitida e autorizada pela SEFAZ.</p>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 text-left space-y-1.5">
          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Número:</span> 1/000004</p>
          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Valor:</span> {formatCurrency(total)}</p>
          <p className="text-sm"><span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>{' '}
            <span className="text-green-600 font-semibold">Autorizada — SEFAZ</span>
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono break-all">
            Chave: 31260512345678000190550010000040012345678901
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline">Baixar DANFE (PDF)</Button>
          <Button asChild><Link href="/nfe">Ver todas as NF-e</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nfe"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emitir Nova NF-e</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Nota Fiscal de Saída — SEFAZ / Receita Federal</p>
        </div>
      </div>

      {/* Dados */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={1} />Dados da Nota</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Natureza da Operação</label>
            <select className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={natureza} onChange={(e) => setNatureza(e.target.value)}>
              {['Venda de Mercadoria','Transferência','Devolução de Compra','Remessa para Conserto'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Emissão</label>
            <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
        </CardContent>
      </Card>

      {/* Destinatário */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={2} />Destinatário</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ / CPF</label>
            <Input placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razão Social</label>
            <Input placeholder="Nome do destinatário" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
            <Input type="email" placeholder="email@empresa.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
            <Input placeholder="(00) 00000-0000" />
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={3} />Itens da Nota</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {itens.map((item, idx) => (
            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Item {idx + 1}</span>
                {itens.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {/* Busca produto */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar produto por nome ou código..."
                    value={buscaIdx === idx ? termoBusca : item.produto?.descricao || ''}
                    onFocus={() => { setBuscaIdx(idx); setTermoBusca(item.produto?.descricao || '') }}
                    onChange={(e) => { setTermoBusca(e.target.value); setBuscaIdx(idx) }}
                  />
                </div>
                {buscaIdx === idx && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    {produtosFiltrados.map((p) => (
                      <button key={p.id} onClick={() => selecionarProduto(idx, p)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.descricao}</p>
                          <p className="text-xs text-gray-400">Cód: {p.codigo} | NCM: {p.ncm} | Estoque: {p.estoque} {p.unidade}</p>
                        </div>
                        <span className="text-sm font-semibold text-blue-600 ml-4">{formatCurrency(p.precoUnitario)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantidade</label>
                  <Input type="number" min={1} value={item.quantidade} onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Unit. (R$)</label>
                  <Input type="number" step="0.01" value={item.valorUnitario} onChange={(e) => updateItem(idx, 'valorUnitario', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Desconto (%)</label>
                  <Input type="number" min={0} max={100} value={item.desconto} onChange={(e) => updateItem(idx, 'desconto', Number(e.target.value))} />
                </div>
              </div>
              <p className="text-right text-sm text-gray-600 dark:text-gray-400">
                Subtotal:{' '}
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(item.quantidade * item.valorUnitario - (item.quantidade * item.valorUnitario * item.desconto) / 100)}
                </span>
              </p>
            </div>
          ))}
          <button onClick={addItem} className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors">
            <Plus className="h-4 w-4" />Adicionar item
          </button>
        </CardContent>
      </Card>

      {/* Totais */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total da NF-e</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(total)}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline"><Save className="h-4 w-4" />Salvar Rascunho</Button>
            <Button onClick={() => setStep('success')}><Send className="h-4 w-4" />Transmitir para SEFAZ</Button>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-right">
            A NF-e será transmitida e autorizada em segundos pela SEFAZ / Receita Federal
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center font-bold shrink-0">
      {n}
    </span>
  )
}
