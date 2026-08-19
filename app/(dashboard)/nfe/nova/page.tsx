'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Search, Send, Save, CheckCircle2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getTransportadoras } from '@/lib/supabase/transportadoras'
import type { NFeRecord } from '@/lib/supabase/nfe'
import type { Transportadora } from '@/types'

interface ProdutoRow {
  id: string
  codigo: string
  descricao: string
  ncm: string
  cfop: string
  unidade: string
  preco_custo: number
  preco_venda: number
  estoque: number
  estoque_minimo: number
}

interface ClienteRow {
  id: string
  nome: string
  cpf_cnpj: string | null
  email: string | null
  telefone: string | null
  endereco?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  cep?: string | null
}

interface ItemForm {
  produto: ProdutoRow | null
  quantidade: number
  valorUnitario: number
  desconto: number
}

const MODALIDADES_FRETE = [
  { value: '0', label: '0 — Por conta do Emitente (CIF)' },
  { value: '1', label: '1 — Por conta do Destinatário (FOB)' },
  { value: '2', label: '2 — Por conta de Terceiros' },
  { value: '3', label: '3 — Próprio por conta do Remetente' },
  { value: '4', label: '4 — Próprio por conta do Destinatário' },
  { value: '9', label: '9 — Sem Ocorrência de Transporte' },
]

const ESTADOS_BR = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function NovaNFePage() {
  const supabase = createClient()

  const [step, setStep] = useState<'form' | 'success'>('form')
  const [nfeEmitida, setNfeEmitida] = useState<NFeRecord | null>(null)
  const [transmitindo, setTransmitindo] = useState(false)
  const [erroTransmissao, setErroTransmissao] = useState('')
  const [natureza, setNatureza] = useState('Venda de Mercadoria')
  const [itens, setItens] = useState<ItemForm[]>([
    { produto: null, quantidade: 1, valorUnitario: 0, desconto: 0 },
  ])

  // Destinatário
  const [destinatario, setDestinatario] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  // Endereço destinatário
  const [endLogradouro, setEndLogradouro] = useState('')
  const [endNumero, setEndNumero] = useState('')
  const [endBairro, setEndBairro] = useState('')
  const [endMunicipio, setEndMunicipio] = useState('')
  const [endUf, setEndUf] = useState('')
  const [endCep, setEndCep] = useState('')
  // Opções da nota
  const [consumidorFinal, setConsumidorFinal] = useState(false)
  const [presencaComprador, setPresencaComprador] = useState('9')

  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [showDropCnpj, setShowDropCnpj] = useState(false)
  const [showDropRazao, setShowDropRazao] = useState(false)
  const refCnpj = useRef<HTMLDivElement>(null)
  const refRazao = useRef<HTMLDivElement>(null)

  // Produtos
  const [produtos, setProdutos] = useState<ProdutoRow[]>([])
  const [buscaIdx, setBuscaIdx] = useState<number | null>(null)
  const [termoBusca, setTermoBusca] = useState('')
  const refProdutos = useRef<HTMLDivElement[]>([])

  // Transportador
  const [modalidadeFrete, setModalidadeFrete] = useState('9')
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([])
  const [transportadoraSelecionada, setTransportadoraSelecionada] = useState<Transportadora | null>(null)
  const [buscaTransp, setBuscaTransp] = useState('')
  const [showDropdownTransp, setShowDropdownTransp] = useState(false)
  const [placa, setPlaca] = useState('')
  const [ufPlaca, setUfPlaca] = useState('')
  const [userId, setUserId] = useState('')
  const searchParams = useSearchParams()
  const reenviarId = searchParams.get('reenviar')

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  // Pré-preenche o formulário quando é um reenvio
  useEffect(() => {
    if (!reenviarId || !userId) return
    createClient()
      .from('nfe_emitidas')
      .select('*')
      .eq('id', reenviarId)
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (!data) return
        const nota = data as NFeRecord
        setNatureza(nota.natureza_operacao ?? 'Venda de Mercadoria')
        setDestinatario(nota.destinatario ?? '')
        setCnpj(nota.cnpj_destinatario ?? '')
        setEmail(nota.email_destinatario ?? '')
        setEndLogradouro(nota.logradouro_destinatario ?? '')
        setEndNumero(nota.numero_destinatario ?? '')
        setEndBairro(nota.bairro_destinatario ?? '')
        setEndMunicipio(nota.municipio_destinatario ?? '')
        setEndUf(nota.uf_destinatario ?? '')
        setEndCep(nota.cep_destinatario ?? '')
        const digits = (nota.cnpj_destinatario ?? '').replace(/\D/g, '')
        setConsumidorFinal(digits.length === 11)
        // Reconstrói itens a partir do JSONB salvo
        type StoredItem = {
          descricao?: string; codigo_produto?: string; codigo_ncm?: string
          cfop?: string; unidade_comercial?: string; quantidade_comercial?: number
          valor_unitario_comercial?: number; valor_bruto?: number
        }
        const stored = (nota.itens as StoredItem[]) ?? []
        if (stored.length > 0) {
          setItens(stored.map(it => ({
            produto: {
              id: '', codigo: it.codigo_produto ?? 'PROD',
              descricao: it.descricao ?? '',
              ncm: it.codigo_ncm ?? '00000000',
              cfop: it.cfop ?? '5102',
              unidade: it.unidade_comercial ?? 'UN',
              preco_custo: it.valor_unitario_comercial ?? 0,
              preco_venda: it.valor_unitario_comercial ?? 0,
              estoque: 0, estoque_minimo: 0,
            },
            quantidade: it.quantidade_comercial ?? 1,
            valorUnitario: it.valor_unitario_comercial ?? 0,
            desconto: 0,
          })))
        }
      })
  }, [reenviarId, userId])

  // Carrega produtos do Supabase
  useEffect(() => {
    if (!userId) return
    supabase
      .from('produtos_fiscais')
      .select('id,codigo,descricao,ncm,cfop,unidade,preco_custo,preco_venda,estoque,estoque_minimo')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('descricao')
      .then(({ data }) => setProdutos((data ?? []) as ProdutoRow[]))
  }, [userId])

  // Carrega clientes do Supabase
  useEffect(() => {
    if (!userId) return
    supabase
      .from('clientes')
      .select('id,nome,cpf_cnpj,email,telefone,endereco,numero,bairro,cidade,estado,cep')
      .eq('user_id', userId)
      .order('nome')
      .then(({ data }) => setClientes((data ?? []) as ClienteRow[]))
  }, [userId])

  const fetchTransportadoras = useCallback(async () => {
    if (!userId) return
    try {
      const data = await getTransportadoras(userId, buscaTransp || undefined)
      setTransportadoras(data)
    } catch { /* silent */ }
  }, [userId, buscaTransp])

  useEffect(() => { fetchTransportadoras() }, [fetchTransportadoras])

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (refCnpj.current && !refCnpj.current.contains(e.target as Node)) setShowDropCnpj(false)
      if (refRazao.current && !refRazao.current.contains(e.target as Node)) setShowDropRazao(false)
      if (buscaIdx !== null) {
        const ref = refProdutos.current[buscaIdx]
        if (ref && !ref.contains(e.target as Node)) setBuscaIdx(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [buscaIdx])

  const total = itens.reduce((s, i) => {
    const sub = i.quantidade * i.valorUnitario
    return s + sub - (sub * i.desconto) / 100
  }, 0)

  const semTransporte = modalidadeFrete === '9'

  function addItem() {
    setItens([...itens, { produto: null, quantidade: 1, valorUnitario: 0, desconto: 0 }])
  }
  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }
  function updateItem(idx: number, field: keyof ItemForm, value: unknown) {
    setItens(itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function selecionarProduto(idx: number, produto: ProdutoRow) {
    setItens(itens.map((it, i) =>
      i === idx ? { ...it, produto, valorUnitario: produto.preco_venda || produto.preco_custo } : it
    ))
    setBuscaIdx(null)
    setTermoBusca('')
  }
  function selecionarCliente(c: ClienteRow) {
    setDestinatario(c.nome)
    setCnpj(c.cpf_cnpj ?? '')
    setEmail(c.email ?? '')
    setTelefone(c.telefone ?? '')
    setEndLogradouro(c.endereco ?? '')
    setEndNumero(c.numero ?? '')
    setEndBairro(c.bairro ?? '')
    setEndMunicipio(c.cidade ?? '')
    setEndUf(c.estado ?? '')
    setEndCep(c.cep ?? '')
    // Se CPF (11 dígitos sem máscara) = consumidor final
    const digits = (c.cpf_cnpj ?? '').replace(/\D/g, '')
    setConsumidorFinal(digits.length === 11)
    setShowDropCnpj(false)
    setShowDropRazao(false)
  }
  function selecionarTransportadora(t: Transportadora) {
    setTransportadoraSelecionada(t)
    setBuscaTransp(t.razao_social)
    setShowDropdownTransp(false)
  }

  const clientesPorCnpj = clientes.filter(
    (c) => cnpj.length >= 2 && (c.cpf_cnpj ?? '').replace(/\D/g, '').startsWith(cnpj.replace(/\D/g, ''))
  )
  const clientesPorNome = clientes.filter(
    (c) => destinatario.length >= 2 && c.nome.toLowerCase().startsWith(destinatario.toLowerCase())
  )
  const produtosFiltrados = produtos.filter(
    (p) => !termoBusca || p.descricao.toLowerCase().includes(termoBusca.toLowerCase()) || p.codigo.includes(termoBusca)
  )

  async function handleTransmitir() {
    if (!userId) return
    if (!destinatario) { setErroTransmissao('Informe o destinatário.'); return }
    setTransmitindo(true)
    setErroTransmissao('')
    try {
      const res = await fetch('/api/fiscal/emitir-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          natureza_operacao: natureza,
          consumidor_final: consumidorFinal,
          presenca_comprador: presencaComprador,
          destinatario: {
            nome: destinatario,
            cnpj: cnpj.replace(/\D/g, '').length === 14 ? cnpj : undefined,
            cpf:  cnpj.replace(/\D/g, '').length === 11 ? cnpj : undefined,
            email: email || undefined,
            logradouro: endLogradouro || 'Não informado',
            numero:     endNumero    || 'S/N',
            bairro:     endBairro    || 'Não informado',
            municipio:  endMunicipio || 'Não informado',
            uf:         endUf        || 'SP',
            cep:        endCep       || '00000000',
          },
          itens: itens.map((it) => ({
            codigo_produto: it.produto?.codigo || 'PROD',
            descricao:      it.produto?.descricao || 'Produto',
            ncm:            it.produto?.ncm || '00000000',
            cfop:           it.produto?.cfop || '5102',
            unidade:        it.produto?.unidade || 'UN',
            quantidade:     it.quantidade,
            valor_unitario: it.valorUnitario,
            desconto:       it.desconto,
          })),
          frete: {
            modalidade:          modalidadeFrete,
            transportadora_nome: transportadoraSelecionada?.razao_social,
            transportadora_cnpj: transportadoraSelecionada?.cnpj,
            placa:               placa || undefined,
            uf_placa:            ufPlaca || undefined,
          },
        }),
      })
      const json = await res.json() as {
        ok?: boolean; error?: string; simulada?: boolean; aviso?: string
        numero?: string | number; serie?: string; chave_nfe?: string; danfe_url?: string
        status?: string; mensagem_sefaz?: string
      }
      if (!res.ok || json.error) {
        setErroTransmissao(json.error ?? 'Erro ao transmitir NF-e')
        return
      }
      // Busca o registro salvo para exibir na tela de sucesso
      const { data: saved } = await createClient()
        .from('nfe_emitidas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      setNfeEmitida(saved as NFeRecord)
      setStep('success')
    } catch (e) {
      setErroTransmissao(e instanceof Error ? e.message : 'Erro ao transmitir NF-e')
    } finally {
      setTransmitindo(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">NF-e emitida com sucesso!</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Sua NF-e foi transmitida e autorizada pela SEFAZ.</p>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 text-left space-y-1.5">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Número:</span>{' '}
            {nfeEmitida ? `${nfeEmitida.serie}/${String(nfeEmitida.numero).padStart(6, '0')}` : '—'}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Destinatário:</span> {destinatario}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Valor:</span> {formatCurrency(total)}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Data de emissão:</span>{' '}
            {nfeEmitida ? formatDate(nfeEmitida.data_emissao) : '—'}
          </p>
          {nfeEmitida?.transportadora && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-semibold">Transportadora:</span> {nfeEmitida.transportadora}
            </p>
          )}
          <p className="text-sm">
            <span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>{' '}
            <span className="text-green-600 font-semibold">Registrada</span>
          </p>
          {nfeEmitida?.chave_acesso && (
            <p className="text-xs text-gray-400 mt-1 font-mono break-all">
              Chave: {nfeEmitida.chave_acesso}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          {nfeEmitida && (
            <Button variant="outline" asChild>
              <Link href={`/nfe/${nfeEmitida.id}`}>Imprimir / Ver DANFE</Link>
            </Button>
          )}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {reenviarId ? 'Editar / Reenviar NF-e' : 'Emitir Nova NF-e'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {reenviarId ? 'Corrija os dados e reenvie a nota' : 'Nota Fiscal de Saída — SEFAZ / Receita Federal'}
          </p>
        </div>
      </div>

      {/* Step 1 — Dados */}
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

      {/* Step 2 — Destinatário */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Step n={2} />Destinatário</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* CNPJ com autocomplete */}
          <div className="relative" ref={refCnpj}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CNPJ / CPF</label>
            <Input
              placeholder="00.000.000/0001-00"
              value={cnpj}
              onChange={(e) => { setCnpj(e.target.value); setShowDropCnpj(true) }}
              onFocus={() => setShowDropCnpj(true)}
              autoComplete="off"
            />
            {showDropCnpj && clientesPorCnpj.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                {clientesPorCnpj.map((c) => (
                  <button key={c.id} onClick={() => selecionarCliente(c)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.nome}</span>
                    <span className="text-xs text-gray-400 ml-3 font-mono">{c.cpf_cnpj}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Razão Social com autocomplete */}
          <div className="relative" ref={refRazao}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Razão Social</label>
            <Input
              placeholder="Nome do destinatário"
              value={destinatario}
              onChange={(e) => { setDestinatario(e.target.value); setShowDropRazao(true) }}
              onFocus={() => setShowDropRazao(true)}
              autoComplete="off"
            />
            {showDropRazao && clientesPorNome.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                {clientesPorNome.map((c) => (
                  <button key={c.id} onClick={() => selecionarCliente(c)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.nome}</span>
                    {c.cpf_cnpj && <span className="text-xs text-gray-400 ml-3 font-mono">{c.cpf_cnpj}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
            <Input type="email" placeholder="email@empresa.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
            <Input placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>

          {/* Endereço destinatário */}
          <div className="col-span-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-1">Endereço do Destinatário</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Logradouro</label>
            <Input placeholder="Rua, Av., Rodovia..." value={endLogradouro} onChange={e => setEndLogradouro(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número</label>
            <Input placeholder="S/N" value={endNumero} onChange={e => setEndNumero(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bairro</label>
            <Input placeholder="Bairro" value={endBairro} onChange={e => setEndBairro(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CEP</label>
            <Input placeholder="00000-000" value={endCep} onChange={e => setEndCep(e.target.value)} maxLength={9} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Município</label>
            <Input placeholder="Cidade" value={endMunicipio} onChange={e => setEndMunicipio(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UF</label>
            <select
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={endUf} onChange={e => setEndUf(e.target.value)}>
              <option value="">Selecione</option>
              {ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          {/* Opções */}
          <div className="col-span-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-1">Opções da Nota</p>
          </div>
          <div
            onClick={() => setConsumidorFinal(v => !v)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer select-none transition-all ${
              consumidorFinal ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-10 h-5 rounded-full transition-colors shrink-0 ${consumidorFinal ? 'bg-blue-500' : 'bg-gray-300'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${consumidorFinal ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Consumidor Final</p>
              <p className="text-xs text-gray-500">Marque quando o destinatário é pessoa física ou consumidor final</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Indicador de Presença</label>
            <select
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={presencaComprador} onChange={e => setPresencaComprador(e.target.value)}>
              <option value="0">0 — Não se aplica</option>
              <option value="1">1 — Operação presencial</option>
              <option value="2">2 — Operação não presencial — Internet</option>
              <option value="3">3 — Operação não presencial — Teleatendimento</option>
              <option value="4">4 — NFC-e em operação com entrega domiciliar</option>
              <option value="9">9 — Operação não presencial — Outros</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Step 3 — Itens */}
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

              {/* Busca produto com autocomplete */}
              <div className="relative" ref={(el) => { if (el) refProdutos.current[idx] = el }}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Produto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar produto por nome ou código..."
                    value={buscaIdx === idx ? termoBusca : item.produto?.descricao || ''}
                    onFocus={() => { setBuscaIdx(idx); setTermoBusca(item.produto?.descricao || '') }}
                    onChange={(e) => { setTermoBusca(e.target.value); setBuscaIdx(idx) }}
                    autoComplete="off"
                  />
                </div>
                {buscaIdx === idx && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {produtosFiltrados.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Nenhum produto encontrado.{' '}
                        <Link href="/fiscal-produtos" className="text-blue-500 hover:underline">Cadastrar</Link>
                      </div>
                    ) : produtosFiltrados.map((p) => (
                      <button key={p.id} onClick={() => selecionarProduto(idx, p)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.descricao}</p>
                          <p className="text-xs text-gray-400">Cód: {p.codigo} | NCM: {p.ncm} | Estoque: {p.estoque} {p.unidade}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-sm font-semibold text-green-600">{formatCurrency(p.preco_venda || p.preco_custo)}</p>
                          {p.preco_venda > 0 && <p className="text-xs text-gray-400">venda</p>}
                        </div>
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

      {/* Step 4 — Transportador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Step n={4} />
            <Truck className="h-4 w-4 text-gray-500" />
            Transportador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modalidade do Frete</label>
            <select
              className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={modalidadeFrete}
              onChange={(e) => {
                setModalidadeFrete(e.target.value)
                if (e.target.value === '9') { setTransportadoraSelecionada(null); setBuscaTransp('') }
              }}
            >
              {MODALIDADES_FRETE.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {!semTransporte && (
            <>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transportadora
                  <Link href="/transportadoras" className="ml-2 text-xs text-blue-500 hover:underline" target="_blank">
                    + Cadastrar nova
                  </Link>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar transportadora por nome ou CNPJ..."
                    value={buscaTransp}
                    onFocus={() => setShowDropdownTransp(true)}
                    onChange={(e) => { setBuscaTransp(e.target.value); setTransportadoraSelecionada(null); setShowDropdownTransp(true) }}
                  />
                </div>
                {showDropdownTransp && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {transportadoras.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-400">
                        Nenhuma transportadora encontrada.{' '}
                        <Link href="/transportadoras" className="text-blue-500 hover:underline">Cadastrar</Link>
                      </div>
                    ) : (
                      transportadoras.map((t) => (
                        <button key={t.id} onClick={() => selecionarTransportadora(t)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.razao_social}</p>
                            <p className="text-xs text-gray-400">CNPJ: {t.cnpj || '—'} {t.rntrc ? `| RNTRC: ${t.rntrc}` : ''}</p>
                          </div>
                          {t.cidade && <span className="text-xs text-gray-400 ml-4">{t.cidade}/{t.estado}</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {transportadoraSelecionada && (
                  <div className="mt-2 flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <Truck className="h-5 w-5 text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 truncate">{transportadoraSelecionada.razao_social}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        CNPJ: {transportadoraSelecionada.cnpj || '—'}{transportadoraSelecionada.rntrc ? ` | RNTRC: ${transportadoraSelecionada.rntrc}` : ''}
                      </p>
                    </div>
                    <button onClick={() => { setTransportadoraSelecionada(null); setBuscaTransp('') }}
                      className="text-blue-400 hover:text-blue-600 text-xs font-medium">
                      Trocar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placa do Veículo</label>
                  <Input placeholder="AAA-0000 ou AAA0A00" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} maxLength={8} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UF da Placa</label>
                  <select
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={ufPlaca} onChange={(e) => setUfPlaca(e.target.value)}>
                    <option value="">Selecione</option>
                    {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {semTransporte && (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              Sem ocorrência de transporte — dados do transportador não são necessários.
            </p>
          )}
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
          {erroTransmissao && (
            <p className="text-sm text-red-600 dark:text-red-400 text-right">{erroTransmissao}</p>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline"><Save className="h-4 w-4" />Salvar Rascunho</Button>
            <Button onClick={handleTransmitir} disabled={transmitindo}>
              <Send className="h-4 w-4" />
              {transmitindo ? 'Registrando…' : 'Transmitir para SEFAZ'}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-right">
            A NF-e será registrada e poderá ser visualizada na listagem de notas
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
