'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, XCircle, Printer, CheckCircle2, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notasDeServico } from '@/lib/fiscal/mock-data'
import { createClient } from '@/lib/supabase/client'
import { getPerfilEmpresa, perfilVazio, type PerfilEmpresa } from '@/lib/supabase/perfil-empresa'

/* ── helpers ── */
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
  const nota = idStr ? notasDeServico.find((n) => n.id === idStr) : undefined
  const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const p = await getPerfilEmpresa(data.user.id)
        setPerfil(p ?? { ...perfilVazio, user_id: data.user.id })
      }
    })
  }, [])

  if (!nota) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-xl font-bold text-gray-900 dark:text-white">NFS-e não encontrada</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Não há nota com este identificador ou ela ainda não foi emitida.</p>
        <Button asChild variant="outline">
          <Link href="/nfse"><ArrowLeft className="h-4 w-4 mr-2" />Voltar às NFS-e</Link>
        </Button>
      </div>
    )
  }

  const nomeEmitente = perfil?.razao_social || perfil?.nome_fantasia || 'Empresa'
  const cnpjEmitente = perfil?.cnpj_cpf || '—'
  const imEmitente   = perfil?.inscricao_municipal || '—'
  const endEmitente  = [perfil?.logradouro, perfil?.numero, perfil?.bairro, perfil?.cep].filter(Boolean).join(' - ')
  const cidadeEmit   = perfil?.cidade || '—'
  const ufEmit       = perfil?.uf || '—'

  const aliquota     = nota.itens[0]?.servico?.aliquotaIss ?? 2
  const issRetido    = nota.valorLiquido < nota.valorServicos
  const horaEmissao  = '17:53' // campo futuro — placeholder até integração real
  const serie        = '1'

  // Brasão da prefeitura por cidade (código IBGE → logo oficial)
  const brasoesPrefeitura: Record<string, string> = {
    'juiz de fora': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Brasao_juiz_de_fora.png/120px-Brasao_juiz_de_fora.png',
    'belo horizonte': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Coat_of_arms_of_Belo_Horizonte.svg/120px-Coat_of_arms_of_Belo_Horizonte.svg.png',
    'são paulo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Coat_of_arms_of_S%C3%A3o_Paulo_city.svg/120px-Coat_of_arms_of_S%C3%A3o_Paulo_city.svg.png',
    'rio de janeiro': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Bras%C3%A3o_do_Rio_de_Janeiro.svg/120px-Bras%C3%A3o_do_Rio_de_Janeiro.svg.png',
  }
  const cidadeKey     = cidadeEmit.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const logoMunicipio = brasoesPrefeitura[cidadeKey] ?? null

  function baixarPDF() {
    const titulo = document.title
    document.title = `NFS-e-${nota!.numero}`
    window.print()
    document.title = titulo
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3 print:max-w-none print:space-y-0">

      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/nfse"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={baixarPDF}>
            <Download className="h-4 w-4" />Baixar PDF
          </Button>
          {nota.status !== 'cancelada' && (
            <Button variant="destructive" size="sm">
              <XCircle className="h-4 w-4" />Cancelar NFS-e
            </Button>
          )}
        </div>
      </div>

      {/* ════════════════════════
          DOCUMENTO NFS-e
      ════════════════════════ */}
      <div className="bg-white text-black border-2 border-gray-700 text-[11px]" id="nfse-doc">

        {/* ── CABEÇALHO ── */}
        <div className="grid grid-cols-[1fr_180px] border-b-2 border-gray-700">

          {/* Esquerda: brasão da prefeitura + título */}
          <div className="p-3 border-r border-gray-700 flex items-center gap-3">
            <div className="w-16 h-16 shrink-0 flex items-center justify-center">
              {logoMunicipio ? (
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
                Nota Nº {nota.numero} Série {serie}, emitido em {formatDate(nota.dataEmissao)}
              </p>
            </div>
          </div>

          {/* Direita: número / data / código */}
          <div className="divide-y divide-gray-700">
            <div className="px-3 py-2">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Número da nota</p>
              <p className="font-bold text-gray-900 text-sm">{nota.numero}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Data e Hora da Emissão</p>
              <p className="font-bold text-gray-900 text-sm">{formatDate(nota.dataEmissao)} {horaEmissao}</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Código de Verificação</p>
              <p className="font-bold text-gray-900 text-sm font-mono">{nota.codigoVerificacao ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* ── STATUS (autorizada) ── */}
        {nota.status === 'emitida' && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-green-50 border-b border-green-300 print:hidden">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-800 font-semibold">
              NFS-e Autorizada — Prefeitura de {cidadeEmit}
            </p>
          </div>
        )}

        {/* ── PRESTADOR DE SERVIÇOS ── */}
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

        {/* ── TOMADOR DE SERVIÇOS ── */}
        <div className="border-b border-gray-700">
          <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Tomador de Serviços</p>
          </div>
          <div className="p-3 space-y-0.5 text-[11px]">
            <p>Razão Social: <strong>{nota.tomador}</strong></p>
            <p>CNPJ: <strong>{nota.cnpjTomador}</strong></p>
            <p>Endereço: <strong>—</strong></p>
            <p>Município: <strong>—</strong> &nbsp; UF: <strong>—</strong> &nbsp; E-mail: <strong>—</strong></p>
          </div>
        </div>

        {/* ── DISCRIMINAÇÃO DOS SERVIÇOS ── */}
        <div className="border-b border-gray-700">
          <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Discriminação dos Serviços</p>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[11px] text-gray-900 font-medium">{nota.discriminacao}</p>
            {nota.itens.map((item, i) => (
              <div key={i}>
                <p className="text-[9px] font-bold uppercase text-gray-500 mt-2">Código do Serviço</p>
                <p className="text-[11px] font-bold text-gray-900">
                  {item.servico.codigoLc116} / {item.servico.descricao.toUpperCase()}
                </p>
              </div>
            ))}
          </div>

          {/* COD MUNICÍPIO + NATUREZA — linha 2 colunas */}
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

        {/* ── TABELA DE TRIBUTOS ── */}
        <div className="border-b border-gray-700">
          <table className="w-full border-collapse">
            <tbody>
              {/* Linha 1 */}
              <tr>
                <Row label="Deduções"    value={formatCurrency(0)} />
                <Row label="Descontos"   value={formatCurrency(0)} />
                <Row label="B. Cálculo"  value={formatCurrency(nota.valorServicos)} bold />
                <Row label="ISS"         value={`${formatCurrency(nota.valorIss)} (${aliquota.toFixed(4)} %)`} bold />
                <Row label="ISS Retido"  value={issRetido ? 'SIM' : 'NÃO'} bold />
                <Row label="COFINS"      value={formatCurrency(0)} />
              </tr>
              {/* Linha 2 */}
              <tr>
                <Row label="PIS"         value={formatCurrency(0)} />
                <Row label="CSLL"        value={formatCurrency(0)} />
                <Row label="IR"          value={formatCurrency(0)} />
                <Row label="INSS"        value={formatCurrency(0)} />
                <td colSpan={2} className="border border-gray-400 p-1.5 align-top">
                  <p className="text-[8px] font-bold uppercase text-gray-500 leading-none mb-0.5">Valor dos Serviços</p>
                  <p className="text-[13px] font-bold text-gray-900">{formatCurrency(nota.valorServicos)}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── VALOR LÍQUIDO DA NOTA ── */}
        <div className="border-b-2 border-gray-700 bg-gray-50 py-3 text-center">
          <p className="text-sm font-bold text-gray-900 tracking-wide">
            VALOR LÍQUIDO DA NOTA: <span className="text-base">{formatCurrency(nota.valorLiquido)}</span>
          </p>
        </div>

        {/* ── CANHOTO DE RECIBO ── */}
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
              Os serviços constantes da Nota Fiscal de Serviços Eletrônica n.º <strong>{nota.numero}</strong> emitida em{' '}
              <strong>{formatDate(nota.dataEmissao)} às {horaEmissao}</strong>
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
