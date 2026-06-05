'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, XCircle, Printer, CheckCircle2, Scissors, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getPerfilEmpresa, perfilVazio, type PerfilEmpresa } from '@/lib/supabase/perfil-empresa'
import { useToast } from '@/components/ui/toast'

interface NfseRow {
  id: string
  numero?: string
  numero_rps: number
  serie_rps?: string
  tomador_razao_social: string
  tomador_cnpj_cpf?: string
  tomador_email?: string
  tomador_telefone?: string
  tomador_endereco?: string
  tomador_cidade?: string
  valor_servicos: number
  valor_iss?: number
  valor_liquido?: number
  aliquota_iss?: number
  iss_retido: boolean
  discriminacao?: string
  codigo_servico?: string
  codigo_lc116?: string
  status: string
  ambiente: string
  codigo_verificacao?: string
  link_pdf?: string
  link_xml?: string
  data_emissao: string
  data_competencia?: string
  erro_mensagem?: string
  focus_ref?: string
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <td className="border border-gray-400 p-1.5 align-top">
      <p className="text-[8px] font-bold uppercase text-gray-500 leading-none mb-0.5">{label}</p>
      <p className={`text-[11px] text-gray-900 leading-tight ${bold ? 'font-bold' : 'font-medium'}`}>{value}</p>
    </td>
  )
}

export default function NFSeVisualizarPage() {
  const { id } = useParams()
  const idStr = Array.isArray(id) ? id[0] : id
  const [nota, setNota] = useState<NfseRow | null>(null)
  const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null)
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const { toast } = useToast()

  const fetchNota = useCallback(async () => {
    if (!idStr) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: notaData }, perfilData] = await Promise.all([
      supabase.from('nfse').select('*').eq('id', idStr).eq('user_id', user.id).single(),
      getPerfilEmpresa(user.id),
    ])

    setNota(notaData as NfseRow | null)
    setPerfil(perfilData ?? { ...perfilVazio, user_id: user.id })
    setLoading(false)
  }, [idStr])

  useEffect(() => { fetchNota() }, [fetchNota])

  async function handleSincronizar() {
    if (!nota?.focus_ref) return
    setSincronizando(true)
    try {
      const res = await fetch('/api/nfse/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: nota.focus_ref, id: nota.id }),
      })
      const json = await res.json() as { ok?: boolean; error?: string; status?: string; retorno?: Record<string, unknown> }
      console.log('[sincronizar retorno]', json)
      if (json.ok) {
        toast(`Status: ${json.status ?? 'ok'}${json.retorno?.numero ? ` — Nº ${json.retorno.numero}` : ''}`, 'success')
        fetchNota()
      } else {
        toast(json.error ?? 'Erro ao sincronizar', 'error')
      }
    } catch {
      toast('Erro ao sincronizar status', 'error')
    } finally {
      setSincronizando(false)
    }
  }

  async function handleCancelar() {
    if (!nota || !confirm(`Cancelar NFS-e RPS ${nota.numero_rps}?`)) return
    try {
      const res = await fetch('/api/nfse/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: nota.focus_ref, id: nota.id }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.ok) {
        toast('NFS-e cancelada', 'success')
        fetchNota()
      } else {
        toast(json.error ?? 'Erro ao cancelar', 'error')
      }
    } catch {
      toast('Erro ao cancelar NFS-e', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando...
      </div>
    )
  }

  if (!nota) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-xl font-bold text-gray-900">NFS-e não encontrada</p>
        <p className="text-sm text-gray-500">Não há nota com este identificador ou ela foi removida.</p>
        <Button asChild variant="outline">
          <Link href="/nfse"><ArrowLeft className="h-4 w-4 mr-2" />Voltar às NFS-e</Link>
        </Button>
      </div>
    )
  }

  const nomeEmitente  = perfil?.razao_social || perfil?.nome_fantasia || 'Empresa'
  const cnpjEmitente  = perfil?.cnpj_cpf || '—'
  const imEmitente    = perfil?.inscricao_municipal || '—'
  const endEmitente   = [perfil?.logradouro, perfil?.numero, perfil?.bairro, perfil?.cep].filter(Boolean).join(' - ')
  const cidadeEmit    = perfil?.cidade || '—'
  const ufEmit        = perfil?.uf || '—'

  const aliquota      = nota.aliquota_iss ?? 2
  const valorIss      = nota.valor_iss ?? 0
  const valorLiquido  = nota.valor_liquido ?? nota.valor_servicos
  const serie         = nota.serie_rps ?? 'RPS'
  const numeroNota    = nota.numero ?? `RPS ${nota.numero_rps}`
  const isProcessando = nota.status === 'processando'
  const isAutorizada  = nota.status === 'autorizada'

  function normalizarCidade(cidade: string) {
    return cidade.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  }
  const cidadeKey = normalizarCidade(cidadeEmit)
  const logoMunicipio: string | null = null // brasões via URL externa bloqueiam hotlink

  return (
    <div className="max-w-3xl mx-auto space-y-3 print:max-w-none print:space-y-0">

      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/nfse"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div className="flex gap-2">
          {isProcessando && (
            <Button variant="outline" size="sm" onClick={handleSincronizar} disabled={sincronizando}>
              {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar status
            </Button>
          )}
          {nota.link_pdf && (
            <a href={nota.link_pdf} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Baixar PDF</Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />Imprimir
          </Button>
          {isAutorizada && (
            <Button variant="destructive" size="sm" onClick={handleCancelar}>
              <XCircle className="h-4 w-4 mr-1" />Cancelar NFS-e
            </Button>
          )}
        </div>
      </div>

      {/* Banner processando */}
      {isProcessando && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-300 rounded-xl print:hidden">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Aguardando autorização da Prefeitura</p>
            <p className="text-yellow-700 text-xs mt-0.5">Clique em &quot;Sincronizar status&quot; para consultar a situação atual na Focus NFe.</p>
          </div>
        </div>
      )}

      {/* Banner erro */}
      {nota.status === 'erro' && nota.erro_mensagem && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-300 rounded-xl print:hidden">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="font-semibold text-red-800 text-sm">Erro na transmissão</p>
            <p className="text-red-700 text-xs mt-0.5">{nota.erro_mensagem}</p>
          </div>
        </div>
      )}

      {/* Documento NFS-e */}
      <div className="bg-white text-black border-2 border-gray-700 text-[11px]" id="nfse-doc">

        {/* Cabeçalho */}
        <div className="grid grid-cols-[1fr_180px] border-b-2 border-gray-700">
          <div className="p-3 border-r border-gray-700 flex items-center gap-3">
            <div className="w-16 h-16 shrink-0 flex items-center justify-center">
              {cidadeKey === 'juiz de fora' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/brasao-juiz-de-fora.png" alt="Brasão Juiz de Fora" className="w-16 h-16 object-contain" />
              ) : logoMunicipio ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoMunicipio} alt={`Brasão ${cidadeEmit}`} className="w-16 h-16 object-contain" />
              ) : (
                <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center text-white text-[9px] font-bold text-center leading-tight p-2">
                  BRASÃO<br />{cidadeEmit.toUpperCase().slice(0, 6)}
                </div>
              )}
            </div>
            <div className="text-center flex-1">
              <p className="font-bold text-base text-gray-900 leading-tight">PREFEITURA DE {cidadeEmit.toUpperCase()}</p>
              <p className="font-bold text-sm text-gray-800 leading-tight mt-0.5">NFS-E - NOTA FISCAL DE SERVIÇOS ELETRÔNICA</p>
              <p className="text-[10px] text-gray-600 mt-1 italic">
                Nota Nº {numeroNota} Série {serie}, emitido em {formatDate(nota.data_emissao)}
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-700">
            <div className="px-3 py-2">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Número da nota</p>
              <p className="font-bold text-gray-900 text-sm">{numeroNota}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Data de Emissão</p>
              <p className="font-bold text-gray-900 text-sm">{formatDate(nota.data_emissao)}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Código de Verificação</p>
              <p className="font-bold text-gray-900 text-sm font-mono">{nota.codigo_verificacao ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Status autorizada */}
        {isAutorizada && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-green-50 border-b border-green-300 print:hidden">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-800 font-semibold">
              NFS-e Autorizada — Prefeitura de {cidadeEmit}
            </p>
          </div>
        )}

        {/* Prestador */}
        <div className="border-b border-gray-700">
          <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Prestador de Serviços</p>
          </div>
          <div className="p-3 flex items-start gap-3">
            <div className="w-12 h-12 shrink-0 border border-gray-300 rounded overflow-hidden flex items-center justify-center">
              {perfil?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.logo_url} alt="Logo" className="w-full h-full object-contain p-0.5" />
              ) : (
                <div className="w-full h-full bg-blue-700 flex items-center justify-center text-white font-bold">
                  {nomeEmitente.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="space-y-0.5 text-[11px]">
              <p>Nome: <strong>{nomeEmitente}</strong></p>
              <p>CNPJ: <strong>{cnpjEmitente}</strong>{imEmitente !== '—' && <> &nbsp; Inscrição Municipal: <strong>{imEmitente}</strong></>}</p>
              {endEmitente && <p>Endereço: <strong>{endEmitente}</strong></p>}
              <p>Município: <strong>{cidadeEmit}</strong> &nbsp; UF: <strong>{ufEmit}</strong></p>
            </div>
          </div>
        </div>

        {/* Tomador */}
        <div className="border-b border-gray-700">
          <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Tomador de Serviços</p>
          </div>
          <div className="p-3 space-y-0.5 text-[11px]">
            <p>Razão Social: <strong>{nota.tomador_razao_social}</strong></p>
            {nota.tomador_cnpj_cpf && <p>CPF/CNPJ: <strong>{nota.tomador_cnpj_cpf}</strong></p>}
            {nota.tomador_endereco && <p>Endereço: <strong>{nota.tomador_endereco}</strong></p>}
            {nota.tomador_cidade && <p>Município: <strong>{nota.tomador_cidade}</strong></p>}
            <div className="flex gap-6">
              {nota.tomador_telefone && <p>Telefone: <strong>{nota.tomador_telefone}</strong></p>}
              {nota.tomador_email && <p>E-mail: <strong>{nota.tomador_email}</strong></p>}
            </div>
          </div>
        </div>

        {/* Discriminação */}
        <div className="border-b border-gray-700">
          <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Discriminação dos Serviços</p>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[11px] text-gray-900 font-medium whitespace-pre-wrap">{nota.discriminacao ?? '—'}</p>
            {nota.codigo_lc116 && (
              <div>
                <p className="text-[9px] font-bold uppercase text-gray-500 mt-2">Código do Serviço (LC 116)</p>
                <p className="text-[11px] font-bold text-gray-900">{nota.codigo_lc116}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 border-t border-gray-400">
            <div className="px-3 py-1.5 border-r border-gray-400">
              <p className="text-[8px] font-bold uppercase text-gray-500 leading-none mb-0.5">Cod/Município da Incidência do ISSQN:</p>
              <p className="text-[11px] font-bold text-gray-900">3136702 / {cidadeEmit.toUpperCase()} ({ufEmit})</p>
            </div>
            <div className="px-3 py-1.5">
              <p className="text-[8px] font-bold uppercase text-gray-500 leading-none mb-0.5">Natureza da Operação:</p>
              <p className="text-[11px] font-bold text-gray-900">TRIBUTAÇÃO NO MUNICÍPIO</p>
            </div>
          </div>
        </div>

        {/* Tabela de tributos */}
        <div className="border-b border-gray-700">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <Row label="Deduções"    value={formatCurrency(0)} />
                <Row label="Descontos"   value={formatCurrency(0)} />
                <Row label="B. Cálculo"  value={formatCurrency(nota.valor_servicos)} bold />
                <Row label="ISS"         value={`${formatCurrency(valorIss)} (${aliquota.toFixed(4)} %)`} bold />
                <Row label="ISS Retido"  value={nota.iss_retido ? 'SIM' : 'NÃO'} bold />
                <Row label="COFINS"      value={formatCurrency(0)} />
              </tr>
              <tr>
                <Row label="PIS"  value={formatCurrency(0)} />
                <Row label="CSLL" value={formatCurrency(0)} />
                <Row label="IR"   value={formatCurrency(0)} />
                <Row label="INSS" value={formatCurrency(0)} />
                <td colSpan={2} className="border border-gray-400 p-1.5 align-top">
                  <p className="text-[8px] font-bold uppercase text-gray-500 leading-none mb-0.5">Valor dos Serviços</p>
                  <p className="text-[13px] font-bold text-gray-900">{formatCurrency(nota.valor_servicos)}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Valor líquido */}
        <div className="border-b-2 border-gray-700 bg-gray-50 py-3 text-center">
          <p className="text-sm font-bold text-gray-900 tracking-wide">
            VALOR LÍQUIDO DA NOTA: <span className="text-base">{formatCurrency(valorLiquido)}</span>
          </p>
        </div>

        {/* Canhoto */}
        <div className="border-t-2 border-dashed border-gray-500 mt-4 relative">
          <div className="absolute -top-3 left-2 flex items-center gap-1 text-gray-400">
            <Scissors className="h-4 w-4" />
            <span className="text-[9px]">- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</span>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-[11px] text-gray-800">
              Recebi(emos) do Prestador: <strong>{nomeEmitente}</strong> &nbsp; CNPJ: <strong>{cnpjEmitente}</strong>
            </p>
            <p className="text-[11px] text-gray-800">
              Os serviços constantes da Nota Fiscal de Serviços Eletrônica n.º <strong>{numeroNota}</strong> emitida em{' '}
              <strong>{formatDate(nota.data_emissao)}</strong>
            </p>
            <div className="pt-4 pb-1 flex items-end gap-2">
              <p className="text-[11px] text-gray-700">Ass:</p>
              <div className="flex-1 border-b border-gray-700" />
              <p className="text-[11px] text-gray-700 whitespace-nowrap">em ______/______/________,</p>
            </div>
            <p className="text-[10px] text-gray-500">Assinatura do Destinatário/Tomador dos Serviços</p>
            <div className="flex justify-end pt-1">
              <p className="text-[9px] text-gray-400 italic">Nota fiscal emitida no Syncromoney — syncromoney.com.br</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
