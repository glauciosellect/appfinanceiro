'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, XCircle, Printer, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getNFe, type NFeRecord } from '@/lib/supabase/nfe'
import { createClient } from '@/lib/supabase/client'
import { getPerfilEmpresa, perfilVazio, type PerfilEmpresa } from '@/lib/supabase/perfil-empresa'

function Cell({ label, value, mono, className = '' }: { label: string; value?: string | null; mono?: boolean; className?: string }) {
  return (
    <div className={`border border-gray-400 p-1 ${className}`}>
      <p className="text-[8px] font-bold uppercase text-gray-500 leading-none mb-0.5">{label}</p>
      <p className={`text-xs text-gray-900 leading-tight ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-100 border border-gray-400 px-2 py-0.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-700">{children}</p>
    </div>
  )
}

interface ItemNFe {
  codigo?: string
  descricao?: string
  ncm?: string
  cfop?: string
  unidade?: string
  quantidade?: number
  valor_unitario?: number
  valor_total?: number
  icms_aliquota?: number
}

export default function NFeVisualizarPage() {
  const { id } = useParams()
  const idStr = Array.isArray(id) ? id[0] : id
  const [nota, setNota] = useState<NFeRecord | null>(null)
  const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!idStr) return
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const [n, p] = await Promise.all([
        getNFe(data.user.id, idStr),
        getPerfilEmpresa(data.user.id),
      ])
      setNota(n)
      setPerfil(p ?? { ...perfilVazio, user_id: data.user.id })
      setLoading(false)
    })
  }, [idStr])

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
        <p className="text-xl font-bold text-gray-900">NF-e não encontrada</p>
        <p className="text-sm text-gray-500">Não há nota com este identificador ou ela foi removida.</p>
        <Button asChild variant="outline">
          <Link href="/nfe"><ArrowLeft className="h-4 w-4 mr-2" />Voltar às NF-e</Link>
        </Button>
      </div>
    )
  }

  const nome     = perfil?.razao_social || perfil?.nome_fantasia || 'Empresa'
  const cnpj     = perfil?.cnpj_cpf || '—'
  const ie       = perfil?.inscricao_estadual || '—'
  const im       = perfil?.inscricao_municipal || '—'
  const end      = [perfil?.logradouro, perfil?.numero].filter(Boolean).join(', ')
  const bairro   = perfil?.bairro || '—'
  const cidadeUf = [perfil?.cidade, perfil?.uf].filter(Boolean).join(' / ')
  const cep      = perfil?.cep || '—'
  const tel      = perfil?.telefone || '—'

  const itens: ItemNFe[] = Array.isArray(nota.itens) ? nota.itens as ItemNFe[] : []
  const totalProdutos = itens.reduce((s, i) => s + (i.valor_total ?? 0), 0) || nota.valor_total
  const valorICMS     = totalProdutos * 0.12
  const valorPIS      = totalProdutos * 0.0065
  const valorCOFINS   = totalProdutos * 0.03

  const chave          = nota.chave_acesso ?? ''
  const chaveFormatada = chave.length >= 44 ? chave.replace(/(\d{4})/g, '$1 ').trim() : (chave || '—')

  const endDest    = [nota.logradouro_destinatario, nota.numero_destinatario].filter(Boolean).join(', ')
  const cidadeDest = nota.municipio_destinatario || '—'
  const ufDest     = nota.uf_destinatario || '—'
  const cepDest    = nota.cep_destinatario || '—'
  const bairroDest = nota.bairro_destinatario || '—'

  return (
    <div className="max-w-5xl mx-auto space-y-3 print:max-w-none print:space-y-0">

      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/nfe"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div className="flex gap-2">
          {nota.danfe_url && (
            <a href={nota.danfe_url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Baixar DANFE</Button>
            </a>
          )}
          {nota.xml_url && (
            <Button variant="outline" size="sm" onClick={async () => {
              const filename = `nfe_${nota.numero || nota.id}.xml`
              const res = await fetch(`/api/fiscal/download-xml?url=${encodeURIComponent(nota.xml_url!)}&filename=${filename}`)
              const blob = await res.blob()
              const link = document.createElement('a')
              link.href = URL.createObjectURL(blob)
              link.download = filename
              link.click()
              URL.revokeObjectURL(link.href)
            }}>
              <Download className="h-4 w-4 mr-1" />Baixar XML
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />Imprimir
          </Button>
          {nota.status !== 'cancelada' && (
            <Button variant="destructive" size="sm">
              <XCircle className="h-4 w-4 mr-1" />Cancelar NF-e
            </Button>
          )}
        </div>
      </div>

      {/* DANFE */}
      <div className="bg-white border-2 border-gray-800 text-[11px]" id="danfe">

        {/* Cabeçalho */}
        <div className="grid grid-cols-[1fr_200px_1fr] border-b-2 border-gray-800">
          <div className="p-3 border-r border-gray-800 flex items-center justify-center">
            <div className="flex flex-col items-center text-center gap-2">
              {perfil?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.logo_url} alt="Logo" className="w-14 h-14 object-contain" />
              ) : (
                <div className="w-14 h-14 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">
                  {nome.slice(0,2).toUpperCase()}
                </div>
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-gray-900 text-sm leading-tight">{nome}</p>
                {end && <p className="text-gray-600 text-[10px]">{end}</p>}
                {bairro !== '—' && <p className="text-gray-600 text-[10px]">{bairro}</p>}
                {cidadeUf && <p className="text-gray-600 text-[10px]">{cidadeUf} — CEP {cep}</p>}
                {tel !== '—' && <p className="text-gray-600 text-[10px]">Tel: {tel}</p>}
              </div>
            </div>
          </div>

          <div className="p-3 border-r border-gray-800 flex flex-col items-center justify-between text-center">
            <div>
              <p className="font-bold text-gray-800 text-sm tracking-wide">DANFE</p>
              <p className="text-[9px] text-gray-500 mt-0.5 leading-tight">Documento Auxiliar da Nota Fiscal Eletrônica</p>
            </div>
            <div className="border border-gray-400 rounded px-3 py-1 my-2 w-full">
              <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                <span>0 - Entrada</span><span>1 - Saída</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="font-bold text-gray-900 text-base w-8 h-8 border-2 border-blue-600 rounded-full flex items-center justify-center">
                  {nota.tipo === 'entrada' ? '0' : '1'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-gray-500">Nº</p>
              <p className="font-bold text-gray-900 text-base">{String(nota.numero).padStart(9, '0')}</p>
              <p className="text-[9px] text-gray-500">SÉRIE {nota.serie}</p>
              <p className="text-[9px] text-gray-400 mt-1">Página 1 de 1</p>
            </div>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <div>
              <p className="text-[8px] font-bold uppercase text-gray-500 mb-1">Chave de Acesso</p>
              <div className="flex gap-px h-8 mb-1">
                {chave.length >= 44 && Array.from({ length: 44 }).map((_, i) => (
                  <div key={i} className="bg-gray-900 flex-1" style={{ opacity: i % 3 === 0 ? 1 : i % 2 === 0 ? 0.6 : 0.3 }} />
                ))}
              </div>
              <p className="font-mono text-[9px] text-gray-700 break-all leading-relaxed tracking-wider">{chaveFormatada}</p>
              <p className="text-[8px] text-gray-400 mt-1">Consulta em <span className="text-blue-600">www.nfe.fazenda.gov.br</span></p>
            </div>
            <div className={`mt-2 px-2 py-1 rounded text-center text-[10px] font-bold ${
              nota.status === 'emitida'   ? 'bg-green-100 text-green-800' :
              nota.status === 'rascunho'  ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {nota.status === 'emitida'  ? '✓ AUTORIZADA PELA SEFAZ' :
               nota.status === 'rascunho' ? '⚠ NÃO TRANSMITIDA' : '✕ CANCELADA'}
            </div>
          </div>
        </div>

        {/* Natureza / IE / CNPJ */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Natureza da Operação" value={nota.natureza_operacao} />
          <Cell label="Inscrição Estadual" value={ie} mono />
          <Cell label="Insc. Est. Subst. Tributário" value="—" mono />
          <Cell label="CNPJ" value={cnpj} mono />
        </div>

        {/* Destinatário */}
        <SectionTitle>Destinatário / Remetente</SectionTitle>
        <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Nome / Razão Social" value={nota.destinatario} />
          <Cell label="CNPJ / CPF" value={nota.cnpj_destinatario} mono />
          <Cell label="Data de Emissão" value={formatDate(nota.data_emissao)} />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Endereço" value={endDest || '—'} />
          <Cell label="Bairro / Distrito" value={bairroDest} />
          <Cell label="CEP" value={cepDest} mono />
          <Cell label="Data Entrada / Saída" value={formatDate(nota.data_emissao)} />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Município" value={cidadeDest} />
          <Cell label="Fone / Fax" value="—" />
          <Cell label="UF" value={ufDest} />
          <Cell label="Inscrição Estadual" value="—" mono />
          <Cell label="Hora Entrada / Saída" value="—" />
        </div>

        {/* Cálculo do Imposto */}
        <SectionTitle>Cálculo do Imposto</SectionTitle>
        <div className="grid grid-cols-6 border-b border-gray-400">
          <Cell label="Base de Cálculo do ICMS"   value={formatCurrency(totalProdutos)} />
          <Cell label="Valor do ICMS"              value={formatCurrency(valorICMS)} />
          <Cell label="BC ICMS ST"                 value={formatCurrency(0)} />
          <Cell label="Valor do ICMS ST"           value={formatCurrency(0)} />
          <Cell label="Valor Total dos Produtos"   value={formatCurrency(totalProdutos)} />
          <Cell label="Valor Total da Nota"        value={formatCurrency(nota.valor_total)} className="font-bold" />
        </div>
        <div className="grid grid-cols-6 border-b border-gray-400">
          <Cell label="Valor do Frete"         value={formatCurrency(0)} />
          <Cell label="Valor do Seguro"        value={formatCurrency(0)} />
          <Cell label="Desconto"               value={formatCurrency(0)} />
          <Cell label="Outras Despesas"        value={formatCurrency(0)} />
          <Cell label="Valor do IPI"           value={formatCurrency(0)} />
          <Cell label="Valor PIS / COFINS"     value={formatCurrency(valorPIS + valorCOFINS)} />
        </div>

        {/* Transportador */}
        <SectionTitle>Transportador / Volumes Transportados</SectionTitle>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Razão Social do Transportador" value={nota.transportadora || '—'} />
          <Cell label="Frete por Conta" value="9 — Sem transporte" />
          <Cell label="Código ANTT" value="—" mono />
          <Cell label="Placa do Veículo" value="—" />
          <Cell label="UF da Placa" value="—" />
        </div>

        {/* Produtos */}
        <SectionTitle>Dados dos Produtos / Serviços</SectionTitle>
        <div className="overflow-x-auto border-b border-gray-400">
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {[['Código','w-16'],['Descrição','min-w-[180px]'],['NCM','w-20'],['CFOP','w-12'],['Un.','w-10'],['Qtd.','w-12'],['Vlr. Unit.','w-20 text-right'],['Vlr. Total','w-20 text-right'],['BC ICMS','w-20 text-right'],['Vlr. ICMS','w-20 text-right']].map(([h, cls]) => (
                  <th key={h} className={`border border-gray-300 px-1 py-1 font-bold text-gray-600 uppercase tracking-wide text-left ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr><td colSpan={10} className="border border-gray-200 px-2 py-6 text-center text-gray-500 text-xs">Nenhum item.</td></tr>
              ) : itens.map((item, i) => {
                const total   = item.valor_total ?? 0
                const bcIcms  = total
                const vlrIcms = total * ((item.icms_aliquota ?? 12) / 100)
                return (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-1 py-1 font-mono text-gray-700">{item.codigo || '—'}</td>
                    <td className="border border-gray-200 px-1 py-1 font-medium text-gray-800">{item.descricao || '—'}</td>
                    <td className="border border-gray-200 px-1 py-1 font-mono text-gray-600">{item.ncm || '—'}</td>
                    <td className="border border-gray-200 px-1 py-1 font-mono text-gray-600">{item.cfop || '—'}</td>
                    <td className="border border-gray-200 px-1 py-1 text-gray-600">{item.unidade || '—'}</td>
                    <td className="border border-gray-200 px-1 py-1 text-gray-700">{(item.quantidade ?? 0).toFixed(4)}</td>
                    <td className="border border-gray-200 px-1 py-1 text-right text-gray-700">{formatCurrency(item.valor_unitario ?? 0)}</td>
                    <td className="border border-gray-200 px-1 py-1 text-right font-semibold text-gray-900">{formatCurrency(total)}</td>
                    <td className="border border-gray-200 px-1 py-1 text-right text-gray-600">{formatCurrency(bcIcms)}</td>
                    <td className="border border-gray-200 px-1 py-1 text-right text-gray-600">{formatCurrency(vlrIcms)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Dados Adicionais */}
        <SectionTitle>Dados Adicionais</SectionTitle>
        <div className="grid grid-cols-[3fr_1fr] border-b border-gray-400 min-h-[60px]">
          <div className="border-r border-gray-400 p-2">
            <p className="text-[8px] font-bold uppercase text-gray-500 mb-1">Informações Complementares</p>
            <p className="text-[10px] text-gray-700 leading-relaxed">
              {perfil?.regime_tributario === 'simples' || perfil?.regime_tributario === 'mei'
                ? 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito de ICMS, ISS, PIS e COFINS. '
                : ''}
              Emitido pelo sistema Syncromoney — syncromoney.com.br
              {nota.erro_mensagem ? ` | Obs: ${nota.erro_mensagem}` : ''}
            </p>
          </div>
          <div className="p-2">
            <p className="text-[8px] font-bold uppercase text-gray-500 mb-1">Reserva ao Fisco</p>
            <Cell label="Inscrição Municipal" value={im} mono />
          </div>
        </div>

      </div>
    </div>
  )
}
