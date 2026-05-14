'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getPerfilEmpresa, perfilVazio, type PerfilEmpresa } from '@/lib/supabase/perfil-empresa'
import { getNFe, type NFeRecord } from '@/lib/supabase/nfe'

interface ItemJSONB {
  descricao?: string
  // campos salvos pelo emitir-nfe (nomes Focus NFe)
  codigo_ncm?: string
  unidade_comercial?: string
  quantidade_comercial?: number
  valor_unitario_comercial?: number
  valor_bruto?: number
  // campos legados (formulário antigo)
  ncm?: string
  unidade?: string
  quantidade?: number
  valor_unitario?: number
  desconto?: number
  total?: number
  cfop?: string
}

function Cell({ label, value, mono, className = '' }: { label: string; value?: string | null; mono?: boolean; className?: string }) {
  return (
    <div className={`border border-gray-400 dark:border-gray-600 p-1 ${className}`}>
      <p className="text-[8px] font-bold uppercase text-gray-500 dark:text-gray-400 leading-none mb-0.5">{label}</p>
      <p className={`text-xs text-gray-900 dark:text-white leading-tight ${mono ? 'font-mono' : 'font-medium'}`}>{value || '—'}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-400 dark:border-gray-600 px-2 py-0.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">{children}</p>
    </div>
  )
}

export default function NFeVisualizarPage() {
  const { id } = useParams<{ id: string }>()
  const [nota, setNota] = useState<NFeRecord | null>(null)
  const [perfil, setPerfil] = useState<PerfilEmpresa | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const [n, p] = await Promise.all([
        getNFe(data.user.id, id),
        getPerfilEmpresa(data.user.id),
      ])
      setNota(n)
      setPerfil(p ?? { ...perfilVazio, user_id: data.user.id })
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando…</div>
  if (!nota)   return <div className="p-8 text-center text-gray-400">Nota não encontrada.</div>

  const itens = (nota.itens as ItemJSONB[]) ?? []

  const nome     = perfil?.razao_social || perfil?.nome_fantasia || 'Empresa'
  const cnpj     = perfil?.cnpj_cpf || '—'
  const ie       = perfil?.inscricao_estadual || '—'
  const im       = perfil?.inscricao_municipal || '—'
  const end      = [perfil?.logradouro, perfil?.numero].filter(Boolean).join(', ')
  const bairro   = perfil?.bairro || '—'
  const cidadeUf = [perfil?.cidade, perfil?.uf].filter(Boolean).join(' / ')
  const cep      = perfil?.cep || '—'
  const tel      = perfil?.telefone || '—'

  const totalProdutos = nota.valor_total
  const valorICMS     = totalProdutos * 0.12
  const valorPIS      = totalProdutos * 0.0065
  const valorCOFINS   = totalProdutos * 0.03

  const numeroFmt = `${nota.serie}/${String(nota.numero).padStart(6, '0')}`
  const chave     = nota.chave_acesso ?? '0000000000000000000000000000000000000000000'
  const chaveFormatada = chave.replace(/(\d{4})/g, '$1 ').trim()

  function imprimir() {
    const titulo = document.title
    document.title = `NF-e-${numeroFmt}`
    window.print()
    document.title = titulo
  }

  return (
    <div className="max-w-5xl mx-auto space-y-3 print:max-w-none print:space-y-0">

      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/nfe"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={imprimir}>
            <Printer className="h-4 w-4" />Imprimir
          </Button>
          <Button size="sm" onClick={imprimir}>
            <Download className="h-4 w-4" />Baixar PDF
          </Button>
        </div>
      </div>

      {/* DANFE */}
      <div className="bg-white dark:bg-gray-950 border-2 border-gray-800 dark:border-gray-300 text-[11px]" id="danfe">

        {/* CABEÇALHO */}
        <div className="grid grid-cols-[1fr_200px_1fr] border-b-2 border-gray-800 dark:border-gray-300">

          {/* Emitente */}
          <div className="p-3 border-r border-gray-800 dark:border-gray-300 flex items-center justify-center">
            <div className="flex flex-col items-center text-center gap-2">
              {perfil?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={perfil.logo_url} alt="Logo" className="w-14 h-14 object-contain" />
              ) : (
                <div className="w-14 h-14 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-lg">
                  {nome.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{nome}</p>
                {end && <p className="text-gray-600 dark:text-gray-400 text-[10px]">{end}</p>}
                {bairro !== '—' && <p className="text-gray-600 dark:text-gray-400 text-[10px]">{bairro}</p>}
                {cidadeUf && <p className="text-gray-600 dark:text-gray-400 text-[10px]">{cidadeUf} — CEP {cep}</p>}
                {tel !== '—' && <p className="text-gray-600 dark:text-gray-400 text-[10px]">Tel: {tel}</p>}
              </div>
            </div>
          </div>

          {/* Centro */}
          <div className="p-3 border-r border-gray-800 dark:border-gray-300 flex flex-col items-center justify-between text-center">
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-200 text-sm tracking-wide">DANFE</p>
              <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Documento Auxiliar da Nota Fiscal Eletrônica</p>
            </div>
            <div className="border border-gray-400 dark:border-gray-500 rounded px-3 py-1 my-2 w-full">
              <div className="flex items-center justify-between text-[9px] text-gray-500 dark:text-gray-400 mb-1">
                <span>0 - Entrada</span>
                <span>1 - Saída</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">□</span>
                <span className="font-bold text-gray-900 dark:text-white text-base w-8 h-8 border-2 border-blue-600 rounded-full flex items-center justify-center mx-auto">
                  {nota.tipo === 'entrada' ? '0' : '1'}
                </span>
                <span className="text-[10px] text-blue-600">■</span>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 dark:text-gray-400">Nº</p>
              <p className="font-bold text-gray-900 dark:text-white text-base">{String(nota.numero).padStart(6, '0')}</p>
              <p className="text-[9px] text-gray-500 dark:text-gray-400">SÉRIE {nota.serie}</p>
              <p className="text-[9px] text-gray-400 mt-1">Página 1 de 1</p>
            </div>
          </div>

          {/* Chave de acesso */}
          <div className="p-3 flex flex-col justify-between">
            <div>
              <p className="text-[8px] font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Chave de Acesso</p>
              <div className="flex gap-px h-8 mb-1">
                {Array.from({ length: 44 }).map((_, i) => (
                  <div key={i} className="bg-gray-900 dark:bg-gray-100 flex-1" style={{ opacity: (i % 3 === 0) ? 1 : i % 2 === 0 ? 0.6 : 0.3 }} />
                ))}
              </div>
              <p className="font-mono text-[9px] text-gray-700 dark:text-gray-300 break-all leading-relaxed tracking-wider">{chaveFormatada}</p>
              <p className="text-[8px] text-gray-400 dark:text-gray-500 mt-1">
                Consulta em <span className="text-blue-600">www.nfe.fazenda.gov.br</span> ou site da SEFAZ
              </p>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Protocolo de Autorização de Uso</p>
              <p className="font-mono text-[9px] text-gray-700 dark:text-gray-300">
                {nota.chave_acesso ? `135240000000001 — ${formatDate(nota.data_emissao)} 14:32:15` : 'Aguardando integração SEFAZ'}
              </p>
              <div className={`mt-1.5 px-2 py-1 rounded text-center text-[10px] font-bold ${
                nota.status === 'emitida'   ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                nota.status === 'rascunho'  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {nota.status === 'emitida'  ? '✓ REGISTRADA' :
                 nota.status === 'rascunho' ? '⚠ NÃO TRANSMITIDA' : '✕ CANCELADA'}
              </div>
            </div>
          </div>
        </div>

        {/* NATUREZA / IE / CNPJ */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-gray-400 dark:border-gray-600">
          <Cell label="Natureza da Operação" value={nota.natureza_operacao} />
          <Cell label="Inscrição Estadual" value={ie} mono />
          <Cell label="Insc. Est. Subst. Tributário" value="—" mono />
          <Cell label="CNPJ" value={cnpj} mono />
        </div>

        {/* DESTINATÁRIO */}
        <SectionTitle>Destinatário / Remetente</SectionTitle>
        <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-gray-400 dark:border-gray-600">
          <Cell label="Nome / Razão Social" value={nota.destinatario} />
          <Cell label="CNPJ / CPF" value={nota.cnpj_destinatario} mono />
          <Cell label="Data de Emissão" value={formatDate(nota.data_emissao)} />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-gray-400 dark:border-gray-600">
          <Cell label="Endereço" value={[nota.logradouro_destinatario, nota.numero_destinatario].filter(Boolean).join(', ') || '—'} />
          <Cell label="Bairro / Distrito" value={nota.bairro_destinatario} />
          <Cell label="CEP" value={nota.cep_destinatario} mono />
          <Cell label="Data Entrada / Saída" value={formatDate(nota.data_emissao)} />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-gray-400 dark:border-gray-600">
          <Cell label="Município" value={nota.municipio_destinatario} />
          <Cell label="Fone / Fax" value={nota.email_destinatario || '—'} />
          <Cell label="UF" value={nota.uf_destinatario} />
          <Cell label="Inscrição Estadual" value="—" mono />
          <Cell label="Hora Entrada / Saída" value="—" />
        </div>

        {/* FATURA */}
        <SectionTitle>Fatura</SectionTitle>
        <div className="border-b border-gray-400 dark:border-gray-600 px-2 py-1.5 flex gap-4">
          <p className="text-[9px] text-gray-400 dark:text-gray-500 italic">Sem fatura (pagamento à vista)</p>
        </div>

        {/* CÁLCULO DO IMPOSTO */}
        <SectionTitle>Cálculo do Imposto</SectionTitle>
        <div className="grid grid-cols-6 border-b border-gray-400 dark:border-gray-600">
          <Cell label="Base de Cálculo do ICMS"   value={formatCurrency(totalProdutos)} />
          <Cell label="Valor do ICMS"              value={formatCurrency(valorICMS)} />
          <Cell label="BC ICMS ST"                 value={formatCurrency(0)} />
          <Cell label="Valor do ICMS ST"           value={formatCurrency(0)} />
          <Cell label="Valor Total dos Produtos"   value={formatCurrency(totalProdutos)} />
          <Cell label="Valor Total da Nota"        value={formatCurrency(totalProdutos)} className="font-bold" />
        </div>
        <div className="grid grid-cols-6 border-b border-gray-400 dark:border-gray-600">
          <Cell label="Valor do Frete"             value={formatCurrency(0)} />
          <Cell label="Valor do Seguro"            value={formatCurrency(0)} />
          <Cell label="Desconto"                   value={formatCurrency(0)} />
          <Cell label="Outras Despesas Acess."     value={formatCurrency(0)} />
          <Cell label="Valor do IPI"               value={formatCurrency(0)} />
          <Cell label="Valor do PIS / COFINS"      value={formatCurrency(valorPIS + valorCOFINS)} />
        </div>

        {/* TRANSPORTADOR */}
        <SectionTitle>Transportador / Volumes Transportados</SectionTitle>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-gray-400 dark:border-gray-600">
          <Cell label="Razão Social do Transportador" value={nota.transportadora || '—'} />
          <Cell label="Frete por Conta" value={nota.transportadora ? '0 — Emitente' : '9 — Sem transporte'} />
          <Cell label="Código ANTT / RNTRC" value="—" mono />
          <Cell label="Placa do Veículo" value="—" />
          <Cell label="UF da Placa" value="—" />
        </div>
        <div className="grid grid-cols-6 border-b-2 border-gray-800 dark:border-gray-300">
          <Cell label="Quantidade" value="—" />
          <Cell label="Espécie" value="—" />
          <Cell label="Marca" value="—" />
          <Cell label="Numeração" value="—" />
          <Cell label="Peso Bruto (kg)" value="—" />
          <Cell label="Peso Líquido (kg)" value="—" />
        </div>

        {/* PRODUTOS */}
        <SectionTitle>Dados dos Produtos / Serviços</SectionTitle>
        <div className="overflow-x-auto border-b border-gray-400 dark:border-gray-600">
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                {[
                  ['#',            'w-8'],
                  ['Descrição do Produto / Serviço', 'min-w-[180px]'],
                  ['NCM/SH',       'w-20'],
                  ['CFOP',         'w-12'],
                  ['Unid.',        'w-10'],
                  ['Qtd.',         'w-12'],
                  ['Vlr. Unit.',   'w-20 text-right'],
                  ['Desc.%',       'w-12 text-right'],
                  ['Vlr. Total',   'w-20 text-right'],
                  ['BC ICMS',      'w-20 text-right'],
                  ['Vlr. ICMS',    'w-20 text-right'],
                  ['Alíq. ICMS',  'w-16 text-right'],
                ].map(([h, cls]) => (
                  <th key={h} className={`border border-gray-300 dark:border-gray-600 px-1 py-1 font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide text-left ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-3 text-center text-gray-400">Nenhum item</td>
                </tr>
              ) : itens.map((item, i) => {
                const qtd      = item.quantidade_comercial ?? item.quantidade ?? 0
                const vlrUnit  = item.valor_unitario_comercial ?? item.valor_unitario ?? 0
                const desc     = item.desconto ?? 0
                const total    = item.valor_bruto ?? item.total ?? qtd * vlrUnit * (1 - desc / 100)
                const ncm      = item.codigo_ncm ?? item.ncm ?? '—'
                const unidade  = item.unidade_comercial ?? item.unidade ?? '—'
                const bcIcms   = total
                const vlrIcms  = total * 0.12
                return (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50 dark:bg-gray-800/40'}>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-gray-500">{i + 1}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 font-medium text-gray-800 dark:text-gray-200">{item.descricao || '—'}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 font-mono text-gray-600 dark:text-gray-400">{ncm}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 font-mono text-gray-600 dark:text-gray-400">{item.cfop || '—'}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-gray-600 dark:text-gray-400">{unidade}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-gray-700 dark:text-gray-300">{qtd.toFixed(2)}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-right text-gray-700 dark:text-gray-300">{formatCurrency(vlrUnit)}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-right text-gray-600 dark:text-gray-400">{desc}%</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(total)}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-right text-gray-600 dark:text-gray-400">{formatCurrency(bcIcms)}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-right text-gray-600 dark:text-gray-400">{formatCurrency(vlrIcms)}</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-1 py-1 text-right text-gray-600 dark:text-gray-400">12,00%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ISSQN */}
        <SectionTitle>Cálculo do ISSQN</SectionTitle>
        <div className="grid grid-cols-4 border-b border-gray-400 dark:border-gray-600">
          <Cell label="Inscrição Municipal" value={im} mono />
          <Cell label="Valor Total dos Serviços" value={formatCurrency(0)} />
          <Cell label="Base de Cálculo do ISSQN"  value={formatCurrency(0)} />
          <Cell label="Valor do ISSQN"             value={formatCurrency(0)} />
        </div>

        {/* DADOS ADICIONAIS */}
        <SectionTitle>Dados Adicionais</SectionTitle>
        <div className="grid grid-cols-[3fr_1fr] min-h-[60px]">
          <div className="border-r border-gray-400 dark:border-gray-600 p-2">
            <p className="text-[8px] font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Informações Complementares</p>
            <p className="text-[10px] text-gray-700 dark:text-gray-300 leading-relaxed">
              {perfil?.regime_tributario === 'simples' || perfil?.regime_tributario === 'mei'
                ? 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito de ICMS, ISS, PIS e COFINS. '
                : ''}
              Emitido pelo sistema SyncroMoney — syncromoney.com.br
            </p>
          </div>
          <div className="p-2">
            <p className="text-[8px] font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Reserva ao Fisco</p>
          </div>
        </div>

      </div>
    </div>
  )
}
