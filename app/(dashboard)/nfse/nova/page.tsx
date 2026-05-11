'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Search, Send, Save, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { servicosFiscais } from '@/lib/fiscal/mock-data'
import type { ServicoFiscal } from '@/lib/fiscal/types'

interface ItemForm {
  servico: ServicoFiscal | null
  descricao: string
  quantidade: number
  valorUnitario: number
}

export default function NovaNFSePage() {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [tomador, setTomador] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([
    { servico: null, descricao: '', quantidade: 1, valorUnitario: 0 },
  ])
  const [buscaIdx, setBuscaIdx] = useState<number | null>(null)
  const [termoBusca, setTermoBusca] = useState('')

  const totalServicos = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)
  const aliquota = itens[0]?.servico?.aliquotaIss ?? 2
  const valorIss = (totalServicos * aliquota) / 100
  const valorLiquido = totalServicos - valorIss

  function addItem() {
    setItens([...itens, { servico: null, descricao: '', quantidade: 1, valorUnitario: 0 }])
  }
  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, field: keyof ItemForm, value: unknown) {
    setItens(itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function selecionarServico(idx: number, servico: ServicoFiscal) {
    setItens(itens.map((it, i) => i === idx ? { ...it, servico, descricao: servico.descricao, valorUnitario: servico.valorHora ?? 0 } : it))
    setBuscaIdx(null)
    setTermoBusca('')
  }

  const servicosFiltrados = servicosFiscais.filter(
    (s) => s.descricao.toLowerCase().includes(termoBusca.toLowerCase()) || s.codigo.includes(termoBusca)
  )

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">NFS-e emitida com sucesso!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Sua NFS-e foi transmitida à Prefeitura de Juiz de Fora / MG.</p>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 text-left space-y-1.5">
          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Número:</span> 00003</p>
          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Código Verificação:</span> DEF54321</p>
          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Valor Serviços:</span> {formatCurrency(totalServicos)}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">ISS ({aliquota}%):</span> {formatCurrency(valorIss)}</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white"><span className="font-semibold">Valor Líquido:</span> {formatCurrency(valorLiquido)}</p>
          <p className="text-sm"><span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>{' '}
            <span className="text-green-600 font-semibold">Autorizada — Prefeitura JF</span>
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline">Baixar PDF</Button>
          <Button variant="success" asChild><Link href="/nfse">Ver todas as NFS-e</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nfse"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Emitir Nova NFS-e</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Integrado à Prefeitura de Juiz de Fora / MG — sem acessar portal separado
          </p>
        </div>
      </div>

      {/* Tomador */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={1} color="green" />Tomador do Serviço</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ / CPF</label>
            <Input placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razão Social</label>
            <Input placeholder="Nome do tomador" value={tomador} onChange={(e) => setTomador(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
            <Input type="email" placeholder="email@empresa.com.br" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data de Competência</label>
            <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={2} color="green" />Serviços Prestados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {itens.map((item, idx) => (
            <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Serviço {idx + 1}</span>
                {itens.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serviço</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="pl-9" placeholder="Buscar serviço cadastrado..."
                    value={buscaIdx === idx ? termoBusca : item.servico?.descricao || ''}
                    onFocus={() => { setBuscaIdx(idx); setTermoBusca(item.servico?.descricao || '') }}
                    onChange={(e) => { setTermoBusca(e.target.value); setBuscaIdx(idx) }}
                  />
                </div>
                {buscaIdx === idx && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    {servicosFiltrados.map((s) => (
                      <button key={s.id} onClick={() => selecionarServico(idx, s)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{s.descricao}</p>
                          <p className="text-xs text-gray-400">LC 116: {s.codigoLc116} | ISS: {s.aliquotaIss}%</p>
                        </div>
                        {s.valorHora && <span className="text-sm font-semibold text-green-600 ml-4">{formatCurrency(s.valorHora)}/h</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discriminação</label>
                <textarea className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2} placeholder="Descrição detalhada do serviço prestado..."
                  value={item.descricao} onChange={(e) => updateItem(idx, 'descricao', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantidade / Horas</label>
                  <Input type="number" min={1} value={item.quantidade} onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Unitário (R$)</label>
                  <Input type="number" step="0.01" value={item.valorUnitario} onChange={(e) => updateItem(idx, 'valorUnitario', Number(e.target.value))} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addItem} className="flex items-center gap-2 text-sm text-green-600 font-medium hover:text-green-700 transition-colors">
            <Plus className="h-4 w-4" />Adicionar serviço
          </button>
        </CardContent>
      </Card>

      {/* Resumo fiscal */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={3} color="green" />Resumo Fiscal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Valor dos Serviços</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{formatCurrency(totalServicos)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">ISS ({aliquota}%) — Prefeitura JF</span>
              <span className="font-medium text-red-600">- {formatCurrency(valorIss)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-900 dark:text-white">Valor Líquido</span>
              <span className="text-green-700 dark:text-green-400">{formatCurrency(valorLiquido)}</span>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline"><Save className="h-4 w-4" />Salvar Rascunho</Button>
            <Button variant="success" onClick={() => setStep('success')}><Send className="h-4 w-4" />Transmitir à Prefeitura JF</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Step({ n, color = 'blue' }: { n: number; color?: string }) {
  return (
    <span className={`w-6 h-6 ${color === 'green' ? 'bg-green-600' : 'bg-blue-600'} text-white rounded-full text-xs flex items-center justify-center font-bold shrink-0`}>
      {n}
    </span>
  )
}
