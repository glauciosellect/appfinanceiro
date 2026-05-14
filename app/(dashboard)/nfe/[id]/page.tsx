'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getPerfilEmpresa, perfilVazio, type PerfilEmpresa } from '@/lib/supabase/perfil-empresa'
import { getNFe, type NFeRecord } from '@/lib/supabase/nfe'

interface ItemJSONB {
  descricao?: string
  codigo_produto?: string
  cfop?: string
  // nomes Focus NFe (emitir-nfe route)
  codigo_ncm?: string
  unidade_comercial?: string
  quantidade_comercial?: number
  valor_unitario_comercial?: number
  valor_bruto?: number
  icms_origem?: string
  icms_situacao_tributaria?: string
  icms_base_calculo?: number
  icms_aliquota?: number
  pis_base_calculo?: number
  pis_aliquota_porcentual?: number
  cofins_base_calculo?: number
  cofins_aliquota_porcentual?: number
  // nomes legados
  ncm?: string
  unidade?: string
  quantidade?: number
  valor_unitario?: number
  desconto?: number
  total?: number
}

function Cell({ label, value, mono, bold, className = '' }: {
  label: string; value?: string | null; mono?: boolean; bold?: boolean; className?: string
}) {
  return (
    <div className={`border border-gray-400 px-1.5 py-0.5 ${className}`}>
      <p className="text-[7px] font-bold uppercase text-gray-500 leading-none mb-0.5 tracking-wide">{label}</p>
      <p className={`text-[10px] leading-tight ${mono ? 'font-mono' : ''} ${bold ? 'font-bold' : 'font-medium'} text-gray-900`}>
        {value || '—'}
      </p>
    </div>
  )
}

function Sec({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-200 border border-gray-400 px-2 py-0.5">
      <p className="text-[8px] font-bold uppercase tracking-wider text-gray-700">{children}</p>
    </div>
  )
}

function fmt(n: number) { return formatCurrency(n).replace('R$ ', '') }

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

  // Emitente
  const nome     = perfil?.razao_social || perfil?.nome_fantasia || 'Empresa'
  const cnpjEm   = perfil?.cnpj_cpf || '—'
  const ie       = perfil?.inscricao_estadual || '—'
  const im       = perfil?.inscricao_municipal || '—'
  const end      = [perfil?.logradouro, perfil?.numero].filter(Boolean).join(', ')
  const cidadeUf = [perfil?.cidade, perfil?.uf].filter(Boolean).join(' / ')
  const cep      = perfil?.cep || '—'
  const tel      = perfil?.telefone || '—'
  const isSimples = perfil?.regime_tributario === 'simples' || perfil?.regime_tributario === 'mei'

  // Número formatado: 000.000.108 / Série 001
  const numPad = String(nota.numero).padStart(9, '0').replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
  const serPad = String(nota.serie).padStart(3, '0')

  // Chave de acesso
  const chave = nota.chave_acesso ?? '0'.repeat(44)
  const chaveGrupos = chave.match(/.{1,4}/g)?.join(' ') ?? chave

  // Protocolo
  const protocolo = nota.chave_acesso
    ? `${nota.chave_acesso.slice(0, 15)} — ${formatDate(nota.data_emissao)}`
    : 'Aguardando integração SEFAZ'

  // Hora saída — usa created_at se disponível
  const horaSaida = nota.created_at
    ? new Date(nota.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  // Cálculo de impostos a partir dos itens
  const totalProdutos = nota.valor_total
  const totalIcmsBase = itens.reduce((s, it) => s + (it.icms_base_calculo ?? 0), 0)
  const totalIcms = itens.reduce((s, it) =>
    s + (it.icms_base_calculo && it.icms_aliquota ? it.icms_base_calculo * it.icms_aliquota / 100 : 0), 0)
  const totalPis = itens.reduce((s, it) =>
    s + (it.pis_base_calculo && it.pis_aliquota_porcentual ? it.pis_base_calculo * it.pis_aliquota_porcentual / 100 : 0), 0)
  const totalCofins = itens.reduce((s, it) =>
    s + (it.cofins_base_calculo && it.cofins_aliquota_porcentual ? it.cofins_base_calculo * it.cofins_aliquota_porcentual / 100 : 0), 0)
  const valorTributos = totalIcms + totalPis + totalCofins

  // Destinatário endereço
  const endDest = [nota.logradouro_destinatario, nota.numero_destinatario].filter(Boolean).join(', ')

  function imprimir() {
    const t = document.title
    document.title = `NF-e ${numPad} Série ${serPad}`
    window.print()
    document.title = t
  }

  const statusCor = nota.status === 'emitida'
    ? 'bg-green-100 text-green-800 border-green-400'
    : nota.status === 'rascunho'
    ? 'bg-yellow-100 text-yellow-800 border-yellow-400'
    : 'bg-red-100 text-red-800 border-red-400'

  const statusLabel = nota.status === 'emitida' ? '✓ AUTORIZADO PELA SEFAZ'
    : nota.status === 'rascunho' ? '⚠ NÃO TRANSMITIDA'
    : '✕ CANCELADA'

  return (
    <div className="max-w-5xl mx-auto space-y-3 print:max-w-none print:space-y-0">

      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/nfe"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <Button size="sm" onClick={imprimir}>
          <Printer className="h-4 w-4 mr-1" />Imprimir / Baixar PDF
        </Button>
      </div>

      {/* DANFE */}
      <div className="bg-white border-2 border-gray-800 text-[10px] font-sans" id="danfe">

        {/* ── CANHOTO ── */}
        <div className="border-b-2 border-dashed border-gray-500 p-2 grid grid-cols-[1fr_auto] gap-4 items-start">
          <div>
            <p className="text-[8px] font-bold text-gray-700 leading-tight">
              RECEBEMOS DE {nome.toUpperCase()} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL
              ELETRÔNICA INDICADA AO LADO. EMISSÃO: {formatDate(nota.data_emissao)}{' '}
              VALOR TOTAL: R$ {fmt(totalProdutos)}{' '}
              DESTINATÁRIO: {nota.destinatario?.toUpperCase()}
              {nota.logradouro_destinatario ? ` - ${nota.logradouro_destinatario.toUpperCase()}` : ''}
              {nota.bairro_destinatario ? ` ${nota.bairro_destinatario.toUpperCase()}` : ''}
              {nota.municipio_destinatario ? ` ${nota.municipio_destinatario}-${nota.uf_destinatario}` : ''}
            </p>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="border border-gray-400 px-2 py-1">
                <p className="text-[7px] font-bold uppercase text-gray-500">Data de Recebimento</p>
                <p className="text-[9px] mt-3"> </p>
              </div>
              <div className="border border-gray-400 px-2 py-1">
                <p className="text-[7px] font-bold uppercase text-gray-500">Identificação e Assinatura do Recebedor</p>
                <p className="text-[9px] mt-3"> </p>
              </div>
            </div>
          </div>
          <div className="text-right border-l-2 border-dashed border-gray-400 pl-3 min-w-[120px]">
            <p className="font-bold text-gray-800 text-sm">NF-e</p>
            <p className="font-bold text-gray-900 text-sm">Nº. {numPad}</p>
            <p className="text-gray-600 text-[9px]">Série {serPad}</p>
          </div>
        </div>

        {/* ── CABEÇALHO ── */}
        <div className="grid grid-cols-[1fr_190px_1fr] border-b-2 border-gray-800">

          {/* Emitente */}
          <div className="p-2 border-r border-gray-500 flex flex-col items-center justify-center text-center gap-1">
            <p className="text-[8px] font-bold uppercase text-gray-500 tracking-wide">Identificação do Emitente</p>
            {perfil?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={perfil.logo_url} alt="Logo" className="h-10 object-contain" />
            ) : (
              <div className="w-10 h-10 bg-blue-700 rounded flex items-center justify-center text-white font-bold text-base">
                {nome.slice(0, 2).toUpperCase()}
              </div>
            )}
            <p className="font-bold text-gray-900 text-[11px] leading-tight">{nome}</p>
            {end && <p className="text-gray-600 text-[8px]">{end}</p>}
            {perfil?.bairro && <p className="text-gray-600 text-[8px]">{perfil.bairro} - {cep}</p>}
            {cidadeUf && <p className="text-gray-600 text-[8px]">{cidadeUf} Fone/Fax: {tel}</p>}
          </div>

          {/* Centro */}
          <div className="p-2 border-r border-gray-500 flex flex-col items-center justify-between text-center">
            <div>
              <p className="font-bold text-gray-900 text-sm tracking-widest">DANFE</p>
              <p className="text-[8px] text-gray-500 leading-tight">Documento Auxiliar da Nota<br/>Fiscal Eletrônica</p>
            </div>
            <div className="border border-gray-400 rounded px-3 py-1 my-1 w-full">
              <div className="flex justify-between text-[8px] text-gray-500 mb-0.5">
                <span>0 - ENTRADA</span><span>1 - SAÍDA</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-400">□</span>
                <span className="font-bold text-gray-900 text-base w-8 h-8 border-2 border-blue-600 rounded-full flex items-center justify-center mx-auto">
                  {nota.tipo === 'entrada' ? '0' : '1'}
                </span>
                <span className="text-[10px] text-blue-600">■</span>
              </div>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Nº. {numPad}</p>
              <p className="text-[8px] text-gray-600">Série {serPad}</p>
              <p className="text-[8px] text-gray-400">Folha 1/1</p>
            </div>
          </div>

          {/* Chave + Protocolo */}
          <div className="p-2 flex flex-col justify-between">
            <div>
              <p className="text-[7px] font-bold uppercase text-gray-500 mb-1">Chave de Acesso</p>
              {/* Código de barras simulado */}
              <div className="flex gap-px h-7 mb-1">
                {Array.from({ length: 60 }).map((_, i) => (
                  <div key={i} className="bg-gray-900 flex-1" style={{ opacity: i % 5 === 0 ? 1 : i % 3 === 0 ? 0.15 : i % 2 === 0 ? 0.7 : 0.45 }} />
                ))}
              </div>
              <p className="font-mono text-[8px] text-gray-700 break-all leading-relaxed tracking-wider">{chaveGrupos}</p>
              <p className="text-[7px] text-gray-400 mt-0.5">
                Consulta de autenticidade no portal nacional da NF-e<br/>
                <span className="text-blue-600">www.nfe.fazenda.gov.br/portal</span> ou no site da Sefaz Autorizadora
              </p>
            </div>
            <div className="mt-1">
              <p className="text-[7px] font-bold uppercase text-gray-500 mb-0.5">Protocolo de Autorização de Uso</p>
              <p className="font-mono text-[8px] text-gray-700">{protocolo}</p>
              <div className={`mt-1 px-2 py-0.5 border text-center text-[9px] font-bold ${statusCor}`}>
                {statusLabel}
              </div>
            </div>
          </div>
        </div>

        {/* ── NATUREZA / IE / IM / IE SUBST / CNPJ ── */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.2fr] border-b border-gray-400">
          <Cell label="Natureza da Operação" value={nota.natureza_operacao} bold />
          <Cell label="Inscrição Estadual" value={ie} mono />
          <Cell label="Inscrição Municipal" value={im} mono />
          <Cell label="Insc. Estadual do Subst. Tribut." value="—" mono />
          <Cell label="CNPJ / CPF" value={cnpjEm} mono bold />
        </div>

        {/* ── DESTINATÁRIO ── */}
        <Sec>Destinatário / Remetente</Sec>
        <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Nome / Razão Social" value={nota.destinatario} bold />
          <Cell label="CNPJ / CPF" value={nota.cnpj_destinatario} mono />
          <Cell label="Data da Emissão" value={formatDate(nota.data_emissao)} bold />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Endereço" value={endDest || '—'} bold />
          <Cell label="Bairro / Distrito" value={nota.bairro_destinatario} />
          <Cell label="CEP" value={nota.cep_destinatario} mono />
          <Cell label="Data da Saída/Entrada" value={formatDate(nota.data_emissao)} bold />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Município" value={nota.municipio_destinatario} bold />
          <Cell label="UF" value={nota.uf_destinatario} />
          <Cell label="Fone / Fax" value={nota.email_destinatario || '—'} />
          <Cell label="Inscrição Estadual" value="—" mono />
          <Cell label="Hora da Saída/Entrada" value={horaSaida} bold />
        </div>

        {/* ── FATURA ── */}
        <Sec>Fatura / Duplicata</Sec>
        <div className="border-b border-gray-400 px-2 py-1.5 flex gap-6">
          <div>
            <p className="text-[7px] font-bold uppercase text-gray-500">Num.</p>
            <p className="text-[9px] font-bold">001</p>
          </div>
          <div>
            <p className="text-[7px] font-bold uppercase text-gray-500">Venc.</p>
            <p className="text-[9px]">{formatDate(nota.data_emissao)}</p>
          </div>
          <div>
            <p className="text-[7px] font-bold uppercase text-gray-500">Valor</p>
            <p className="text-[9px] font-bold">R$ {fmt(totalProdutos)}</p>
          </div>
        </div>

        {/* ── CÁLCULO DO IMPOSTO ── */}
        <Sec>Cálculo do Imposto</Sec>
        <div className="grid grid-cols-7 border-b border-gray-400">
          <Cell label="Base de Cálc. do ICMS"   value={fmt(totalIcmsBase)} />
          <Cell label="Valor do ICMS"            value={fmt(totalIcms)} />
          <Cell label="Base de Cálc. ICMS S.T."  value={fmt(0)} />
          <Cell label="Valor do ICMS Subst."     value={fmt(0)} />
          <Cell label="V. Imp. Importação"       value={fmt(0)} />
          <Cell label="Valor do PIS"             value={fmt(totalPis)} />
          <Cell label="V. Total Produtos"        value={fmt(totalProdutos)} bold />
        </div>
        <div className="grid grid-cols-7 border-b-2 border-gray-800">
          <Cell label="Valor do Frete"           value={fmt(0)} />
          <Cell label="Valor do Seguro"          value={fmt(0)} />
          <Cell label="Desconto"                 value={fmt(0)} />
          <Cell label="Outras Despesas"          value={fmt(0)} />
          <Cell label="Valor Total IPI"          value={fmt(0)} />
          <Cell label="Valor da COFINS"          value={fmt(totalCofins)} />
          <Cell label="V. Total da Nota"         value={fmt(totalProdutos)} bold />
        </div>

        {/* ── TRANSPORTADOR ── */}
        <Sec>Transportador / Volumes Transportados</Sec>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Nome / Razão Social" value={nota.transportadora || '—'} />
          <Cell label="Frete" value={nota.transportadora ? '0-Por conta emitente' : '9-Sem Transporte'} />
          <Cell label="Código ANTT" value="—" mono />
          <Cell label="Placa do Veículo" value="—" />
          <Cell label="UF" value="—" />
          <Cell label="CNPJ / CPF" value="—" mono />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-gray-400">
          <Cell label="Endereço" value="—" />
          <Cell label="Município" value="—" />
          <Cell label="UF" value="—" />
          <Cell label="Inscrição Estadual" value="—" mono />
        </div>
        <div className="grid grid-cols-6 border-b-2 border-gray-800">
          <Cell label="Quantidade" value={itens.length > 0 ? String(itens.reduce((s, it) => s + Math.ceil(it.quantidade_comercial ?? it.quantidade ?? 1), 0)) : '—'} />
          <Cell label="Espécie" value="—" />
          <Cell label="Marca" value="—" />
          <Cell label="Numeração" value="—" />
          <Cell label="Peso Bruto" value="—" />
          <Cell label="Peso Líquido" value="—" />
        </div>

        {/* ── PRODUTOS ── */}
        <Sec>Dados dos Produtos / Serviços</Sec>
        <div className="overflow-x-auto border-b border-gray-400">
          <table className="w-full text-[8px] border-collapse">
            <thead>
              <tr className="bg-gray-100">
                {[
                  ['Código',        'w-14'],
                  ['Descrição do Produto / Serviço', 'min-w-[180px]'],
                  ['NCM/SH',        'w-16 text-center'],
                  ['O/CSOSN',       'w-14 text-center'],
                  ['CFOP',          'w-10 text-center'],
                  ['UN',            'w-8  text-center'],
                  ['Quant',         'w-14 text-right'],
                  ['Valor Unit',    'w-18 text-right'],
                  ['Valor Total',   'w-18 text-right'],
                  ['Valor Desc',    'w-14 text-right'],
                  ['B.Cálc ICMS',   'w-18 text-right'],
                  ['Valor ICMS',    'w-16 text-right'],
                  ['Valor IPI',     'w-14 text-right'],
                  ['Alíq. ICMS',    'w-14 text-right'],
                  ['Alíq. IPI',     'w-12 text-right'],
                ].map(([h, cls]) => (
                  <th key={h} className={`border border-gray-300 px-1 py-0.5 font-bold text-gray-600 uppercase tracking-wide text-left ${cls}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr><td colSpan={15} className="px-2 py-3 text-center text-gray-400">Nenhum item</td></tr>
              ) : itens.map((item, i) => {
                const qtd     = item.quantidade_comercial ?? item.quantidade ?? 0
                const vlrUnit = item.valor_unitario_comercial ?? item.valor_unitario ?? 0
                const desc    = item.desconto ?? 0
                const total   = item.valor_bruto ?? item.total ?? qtd * vlrUnit * (1 - desc / 100)
                const ncm     = item.codigo_ncm ?? item.ncm ?? '—'
                const un      = item.unidade_comercial ?? item.unidade ?? '—'
                const orig    = item.icms_origem ?? '0'
                const csosn   = item.icms_situacao_tributaria ?? '—'
                const ocsosn  = csosn !== '—' ? `${orig}/${csosn}` : '—'
                const bcIcms  = item.icms_base_calculo ?? 0
                const vlrIcms = bcIcms && item.icms_aliquota ? bcIcms * item.icms_aliquota / 100 : 0
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-200 px-1 py-0.5 font-mono text-gray-600">{item.codigo_produto || '—'}</td>
                    <td className="border border-gray-200 px-1 py-0.5 font-medium text-gray-800">{item.descricao || '—'}</td>
                    <td className="border border-gray-200 px-1 py-0.5 font-mono text-center text-gray-600">{ncm}</td>
                    <td className="border border-gray-200 px-1 py-0.5 font-mono text-center text-gray-600">{ocsosn}</td>
                    <td className="border border-gray-200 px-1 py-0.5 font-mono text-center text-gray-600">{item.cfop || '—'}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-center text-gray-600">{un}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-700">{qtd.toFixed(4)}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-700">{vlrUnit.toFixed(4)}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right font-bold text-gray-900">{total.toFixed(2)}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-600">{desc > 0 ? (total * desc / 100).toFixed(2) : '0,00'}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-600">{bcIcms.toFixed(2)}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-600">{vlrIcms.toFixed(2)}</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-600">0,00</td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-600">
                      {item.icms_aliquota ? `${item.icms_aliquota},00` : '0,00'}
                    </td>
                    <td className="border border-gray-200 px-1 py-0.5 text-right text-gray-600">0,00</td>
                  </tr>
                )
              })}
              {/* Linhas vazias para preencher espaço */}
              {Array.from({ length: Math.max(0, 5 - itens.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className={itens.length % 2 === i % 2 ? 'bg-white' : 'bg-gray-50'}>
                  {Array.from({ length: 15 }).map((__, j) => (
                    <td key={j} className="border border-gray-200 px-1 py-2"> </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── DADOS ADICIONAIS ── */}
        <Sec>Dados Adicionais</Sec>
        <div className="grid grid-cols-[3fr_1fr] min-h-[56px]">
          <div className="border-r border-gray-400 p-1.5">
            <p className="text-[7px] font-bold uppercase text-gray-500 mb-0.5">Informações Complementares</p>
            <p className="text-[8px] text-gray-700 leading-relaxed">
              {isSimples
                ? 'Inf. Contribuinte: Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito de ICMS, ISS, PIS e COFINS. '
                : ''}
              {valorTributos > 0 ? `Valor Aprox dos Tributos: R$ ${fmt(valorTributos)} ` : ''}
              Emitido pelo sistema SyncroMoney — syncromoney.com.br
            </p>
          </div>
          <div className="p-1.5">
            <p className="text-[7px] font-bold uppercase text-gray-500 mb-0.5">Reservado ao Fisco</p>
            {nota.created_at && (
              <p className="text-[7px] text-gray-400">
                Impresso em {new Date(nota.created_at).toLocaleDateString('pt-BR')} às {horaSaida}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
