'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Send, Save, CheckCircle2, Info, AlertCircle, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

const SERVICOS_LC116 = [
  { codigo: '1.01', descricao: 'Análise e desenvolvimento de sistemas', aliquota: 2 },
  { codigo: '1.02', descricao: 'Programação', aliquota: 2 },
  { codigo: '1.03', descricao: 'Processamento de dados e congêneres', aliquota: 2 },
  { codigo: '1.04', descricao: 'Elaboração de programas de computadores', aliquota: 2 },
  { codigo: '1.05', descricao: 'Licenciamento ou cessão de direito de uso de programas', aliquota: 2 },
  { codigo: '1.07', descricao: 'Suporte técnico em informática', aliquota: 2 },
  { codigo: '6.02', descricao: 'Medicina e biomedicina', aliquota: 3 },
  { codigo: '6.09', descricao: 'Psicologia, psicanálise, terapia ocupacional', aliquota: 3 },
  { codigo: '7.01', descricao: 'Engenharia, agronomia, agrimensura, arquitetura', aliquota: 3 },
  { codigo: '10.01', descricao: 'Agenciamento, corretagem de seguros', aliquota: 5 },
  { codigo: '17.01', descricao: 'Assessoria ou consultoria de qualquer natureza', aliquota: 2 },
  { codigo: '17.06', descricao: 'Propaganda e publicidade', aliquota: 2 },
  { codigo: '17.19', descricao: 'Contabilidade, auditoria, guarda-livros', aliquota: 2 },
  { codigo: '25.01', descricao: 'Estúdios fotográficos e cinematográficos', aliquota: 2 },
]

interface ItemForm {
  codigoServico: string
  descricao: string
  quantidade: number
  valorUnitario: number
  aliquota: number
}

type Etapa = 'form' | 'enviando' | 'sucesso' | 'erro'

export default function NovaNFSePage() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>('form')
  const [tomador, setTomador] = useState('')
  const [cnpjTomador, setCnpjTomador] = useState('')
  const [emailTomador, setEmailTomador] = useState('')
  const [dataCompetencia, setDataCompetencia] = useState(new Date().toISOString().split('T')[0])
  const [itens, setItens] = useState<ItemForm[]>([
    { codigoServico: '', descricao: '', quantidade: 1, valorUnitario: 0, aliquota: 2 },
  ])
  const [issRetidoFonte, setIssRetidoFonte] = useState(false)
  const [resultadoEmissao, setResultadoEmissao] = useState<Record<string, unknown> | null>(null)
  const [erroMsg, setErroMsg] = useState('')
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const cnpjTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const digits = cnpjTomador.replace(/\D/g, '')
    if (digits.length !== 14) return
    if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current)
    cnpjTimerRef.current = setTimeout(async () => {
      setBuscandoCnpj(true)
      try {
        const res = await fetch(`/api/cnpj/${digits}`)
        if (res.ok) {
          const d = await res.json() as { razaoSocial?: string; email?: string }
          if (d.razaoSocial) setTomador(d.razaoSocial)
          if (d.email) setEmailTomador(d.email)
        }
      } catch {
        // silencia — usuário preenche manualmente
      } finally {
        setBuscandoCnpj(false)
      }
    }, 600)
    return () => { if (cnpjTimerRef.current) clearTimeout(cnpjTimerRef.current) }
  }, [cnpjTomador])

  const totalServicos = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)
  const aliquotaPrincipal = itens[0]?.aliquota ?? 2
  const valorIss = (totalServicos * aliquotaPrincipal) / 100
  const valorLiquido = issRetidoFonte ? totalServicos - valorIss : totalServicos

  function addItem() {
    setItens([...itens, { codigoServico: '', descricao: '', quantidade: 1, valorUnitario: 0, aliquota: 2 }])
  }
  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, field: keyof ItemForm, value: unknown) {
    setItens(itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function selecionarServico(idx: number, codigo: string) {
    const svc = SERVICOS_LC116.find(s => s.codigo === codigo)
    if (svc) {
      setItens(itens.map((it, i) =>
        i === idx ? { ...it, codigoServico: svc.codigo, descricao: svc.descricao, aliquota: svc.aliquota } : it
      ))
    }
  }

  const discriminacao = itens
    .map(i => `${i.descricao} - Qtd: ${i.quantidade} x ${formatCurrency(i.valorUnitario)}`)
    .join('\n')

  async function handleTransmitir() {
    if (!tomador) { setErroMsg('Informe o nome do tomador'); return }
    if (!itens[0]?.codigoServico) { setErroMsg('Selecione o serviço'); return }
    if (totalServicos <= 0) { setErroMsg('Valor total deve ser maior que zero'); return }
    setErroMsg('')
    setEtapa('enviando')

    const isCnpj = cnpjTomador.replace(/\D/g, '').length === 14
    const isCpf = cnpjTomador.replace(/\D/g, '').length === 11

    try {
      const res = await fetch('/api/nfse/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tomador_razao_social: tomador,
          tomador_cnpj: isCnpj ? cnpjTomador : undefined,
          tomador_cpf: isCpf ? cnpjTomador : undefined,
          tomador_email: emailTomador || undefined,
          valor_servicos: totalServicos,
          iss_retido: issRetidoFonte,
          aliquota_iss: aliquotaPrincipal,
          codigo_servico: itens[0].codigoServico,
          codigo_lc116: itens[0].codigoServico,
          discriminacao,
          data_competencia: dataCompetencia,
        }),
      })
      const json = await res.json() as Record<string, unknown>
      setResultadoEmissao(json)
      if (json.ok) {
        setEtapa('sucesso')
      } else {
        setErroMsg((json.error as string) ?? 'Erro ao emitir NFS-e')
        setEtapa('erro')
      }
    } catch (e) {
      setErroMsg(String(e))
      setEtapa('erro')
    }
  }

  async function handleSalvarRascunho() {
    // TODO: salvar como rascunho no banco
    alert('Funcionalidade de rascunho em breve.')
  }

  if (etapa === 'enviando') {
    return (
      <div className="max-w-lg mx-auto mt-24 text-center">
        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-green-600" />
        <h2 className="text-xl font-bold text-gray-800">Transmitindo à Prefeitura de JF...</h2>
        <p className="text-gray-500 mt-2">Aguarde, pode levar alguns segundos.</p>
      </div>
    )
  }

  if (etapa === 'sucesso') {
    const retorno = (resultadoEmissao?.retorno ?? {}) as Record<string, unknown>
    const nfse = (resultadoEmissao?.nfse ?? {}) as Record<string, unknown>
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">NFS-e transmitida!</h1>
        <p className="text-gray-500 mb-4">Prefeitura de Juiz de Fora / MG</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-1.5">
          {!!retorno.numero && <p className="text-sm"><span className="font-semibold">Número:</span> {String(retorno.numero)}</p>}
          {!!retorno.codigo_verificacao && <p className="text-sm"><span className="font-semibold">Cód. Verificação:</span> {String(retorno.codigo_verificacao)}</p>}
          <p className="text-sm"><span className="font-semibold">Valor Serviços:</span> {formatCurrency(totalServicos)}</p>
          <p className="text-sm"><span className="font-semibold">ISS ({aliquotaPrincipal}%):</span> {formatCurrency(valorIss)}{issRetidoFonte && <span className="ml-2 text-xs text-orange-600 font-semibold">(Retido na Fonte)</span>}</p>
          <p className="text-sm font-bold"><span className="font-semibold">Valor Líquido:</span> {formatCurrency(valorLiquido)}</p>
          <p className="text-sm">
            <span className="font-semibold">Status:</span>{' '}
            <span className="text-green-600 font-semibold capitalize">{String((nfse.status ?? retorno.status) ?? 'processando')}</span>
          </p>
          <p className="text-xs text-amber-600 mt-1">
            {retorno.status === 'processando_autorizacao'
              ? 'A Prefeitura está processando — o número final chegará em instantes. Consulte a listagem.'
              : ''}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          {!!retorno.link_nfse_pdf && (
            <a href={String(retorno.link_nfse_pdf)} target="_blank" rel="noreferrer">
              <Button variant="outline">Baixar PDF</Button>
            </a>
          )}
          <Button variant="success" onClick={() => router.push('/nfse')}>Ver todas as NFS-e</Button>
        </div>
      </div>
    )
  }

  if (etapa === 'erro') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Erro na transmissão</h1>
        <p className="text-gray-600 mb-6 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">{erroMsg}</p>
        <Button onClick={() => setEtapa('form')}>Corrigir e tentar novamente</Button>
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
          <h1 className="text-2xl font-bold text-gray-900">Emitir Nova NFS-e</h1>
          <p className="text-sm text-gray-500 mt-0.5">Prefeitura de Juiz de Fora / MG — via Focus NFe</p>
        </div>
      </div>

      {erroMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {erroMsg}
        </div>
      )}

      {/* Tomador */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={1} />Tomador do Serviço</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ / CPF</label>
            <div className="relative">
              <Input
                placeholder="00.000.000/0001-00"
                value={cnpjTomador}
                onChange={e => setCnpjTomador(e.target.value)}
                className="pr-8"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                {buscandoCnpj
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />}
              </div>
            </div>
            {buscandoCnpj && <p className="text-xs text-blue-500 mt-1">Consultando Receita Federal...</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
            <Input
              placeholder="Preenchido automaticamente pelo CNPJ"
              value={tomador}
              onChange={e => setTomador(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <Input type="email" placeholder="email@empresa.com.br" value={emailTomador} onChange={e => setEmailTomador(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Competência *</label>
            <Input type="date" value={dataCompetencia} onChange={e => setDataCompetencia(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={2} />Serviços Prestados</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {itens.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Serviço {idx + 1}</span>
                {itens.length > 1 && (
                  <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código LC 116 *</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={item.codigoServico}
                  onChange={e => selecionarServico(idx, e.target.value)}
                >
                  <option value="">Selecione o serviço...</option>
                  {SERVICOS_LC116.map(s => (
                    <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.descricao}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discriminação</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2}
                  placeholder="Descrição detalhada..."
                  value={item.descricao}
                  onChange={e => updateItem(idx, 'descricao', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                  <Input type="number" min={1} value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Unitário (R$)</label>
                  <Input type="number" step="0.01" value={item.valorUnitario} onChange={e => updateItem(idx, 'valorUnitario', Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alíquota ISS (%)</label>
                  <Input type="number" step="0.01" value={item.aliquota} onChange={e => updateItem(idx, 'aliquota', Number(e.target.value))} />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addItem} className="flex items-center gap-2 text-sm text-green-600 font-medium hover:text-green-700">
            <Plus className="h-4 w-4" />Adicionar serviço
          </button>
        </CardContent>
      </Card>

      {/* Resumo fiscal */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={3} />Resumo Fiscal</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            onClick={() => setIssRetidoFonte(!issRetidoFonte)}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer select-none transition-all ${
              issRetidoFonte ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
              issRetidoFonte ? 'bg-orange-500' : 'border-2 border-gray-300'
            }`}>
              {issRetidoFonte && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${issRetidoFonte ? 'text-orange-800' : 'text-gray-700'}`}>
                ISS retido na fonte pelo tomador
              </p>
              <p className={`text-xs mt-0.5 ${issRetidoFonte ? 'text-orange-700' : 'text-gray-500'}`}>
                O tomador recolhe o ISS diretamente à Prefeitura de JF
              </p>
            </div>
            <Info className={`h-4 w-4 shrink-0 mt-0.5 ${issRetidoFonte ? 'text-orange-500' : 'text-gray-400'}`} />
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Valor dos Serviços</span>
              <span className="font-medium">{formatCurrency(totalServicos)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">ISS ({aliquotaPrincipal}%)</span>
                {issRetidoFonte && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Retido na fonte</span>}
              </div>
              <span className={issRetidoFonte ? 'font-medium text-red-600' : 'font-medium text-gray-500'}>
                {issRetidoFonte ? `- ${formatCurrency(valorIss)}` : formatCurrency(valorIss)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
              <span>Valor Líquido</span>
              <span className="text-green-700">{formatCurrency(valorLiquido)}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={handleSalvarRascunho}><Save className="h-4 w-4 mr-1" />Salvar Rascunho</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleTransmitir}
              disabled={totalServicos <= 0}
            >
              <Send className="h-4 w-4 mr-1" />Transmitir à Prefeitura JF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center font-bold shrink-0">
      {n}
    </span>
  )
}
