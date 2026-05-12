'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, XCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notasFiscaisEletronicas, produtosFiscais } from '@/lib/fiscal/mock-data'

// Nota de exemplo para visualização
const notaDemo = notasFiscaisEletronicas[0]
const itensDemo = [
  { produto: produtosFiscais[0], quantidade: 2, valorUnitario: 3200.0, desconto: 0, total: 6400.0 },
  { produto: produtosFiscais[2], quantidade: 1, valorUnitario: 249.0, desconto: 0, total: 249.0 },
]

export default function NFeVisualizarPage() {
  const { id } = useParams()
  const nota = notasFiscaisEletronicas.find((n) => n.id === id) ?? notasFiscaisEletronicas[0]
  const itens = nota.itens.length > 0 ? nota.itens : itensDemo
  const totalNota = itens.reduce((s, i) => s + i.total, 0)

  function baixarPDF() {
    const titulo = document.title
    document.title = `NF-e-${nota.numero}`
    window.print()
    document.title = titulo
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 print:max-w-none print:space-y-0">
      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/nfe"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
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
              <XCircle className="h-4 w-4" />Cancelar NF-e
            </Button>
          )}
        </div>
      </div>

      {/* DANFE */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden print:shadow-none print:border-none" id="danfe">

        {/* Cabeçalho */}
        <div className="border-b-2 border-gray-800 dark:border-gray-200">
          <div className="grid grid-cols-[1fr_auto_1fr] divide-x divide-gray-800 dark:divide-gray-200">
            {/* Emitente */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0">
                  SM
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">Empresa Exemplo Ltda</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">CNPJ: 12.345.678/0001-90</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">IE: 123.456.789/0001-40</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Rua das Flores, 123 — Centro</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Juiz de Fora / MG — CEP 36010-010</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Tel: (32) 99999-9999</p>
            </div>

            {/* Centro — título */}
            <div className="p-4 flex flex-col items-center justify-center text-center min-w-[180px]">
              <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">DANFE</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Documento Auxiliar da</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Nota Fiscal Eletrônica</p>
              <div className="mt-3 border border-gray-300 dark:border-gray-600 rounded px-3 py-1">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">ENTRADA</p>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 text-center">□ 1</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">SAÍDA</p>
                <p className="text-xs font-bold text-blue-600 text-center">■ 2</p>
              </div>
              <div className="mt-3">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Nº</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{nota.numero}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">SÉRIE {nota.serie}</p>
              </div>
            </div>

            {/* Chave de acesso */}
            <div className="p-4 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Chave de Acesso</p>
                <p className="text-[10px] font-mono text-gray-700 dark:text-gray-300 break-all leading-relaxed">
                  {nota.chaveAcesso ?? '3124 0512 3456 7800 0190 5500 1000 0001 0012 3456 7890'}
                </p>
              </div>
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Data / Hora de Emissão</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">{formatDate(nota.dataEmissao)} 14:32:10</p>
              </div>
              <div className={`mt-2 px-3 py-1.5 rounded text-center text-xs font-bold ${
                nota.status === 'emitida' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                nota.status === 'rascunho' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {nota.status === 'emitida' ? '✓ AUTORIZADA PELA SEFAZ' :
                 nota.status === 'rascunho' ? '⚠ NÃO TRANSMITIDA' : '✕ CANCELADA'}
              </div>
            </div>
          </div>
        </div>

        {/* Natureza da operação */}
        <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700">
          <div className="p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Natureza da Operação</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{nota.naturezaOperacao}</p>
          </div>
          <div className="p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Protocolo de Autorização</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">135240000000001 — {formatDate(nota.dataEmissao)} 14:32:15</p>
          </div>
        </div>

        {/* Destinatário */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Destinatário / Remetente</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700 p-0">
            <div className="p-3 col-span-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Razão Social</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{nota.destinatario}</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">CNPJ / CPF</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white">{nota.cnpjDestinatario}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 divide-x divide-gray-200 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700">
            <div className="p-3 col-span-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Endereço</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">Av. Barão do Rio Branco, 2000 — Centro</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">Município</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">Juiz de Fora</p>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase">UF / CEP</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">MG / 36010-000</p>
            </div>
          </div>
        </div>

        {/* Produtos */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Dados dos Produtos / Serviços</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  {['Cód.','Descrição do Produto','NCM','CFOP','Un.','Qtd.','Valor Unit.','Desconto','Valor Total'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {itens.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                    <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{item.produto.codigo}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{item.produto.descricao}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{item.produto.ncm}</td>
                    <td className="px-3 py-2 font-mono text-gray-500">{item.produto.cfop}</td>
                    <td className="px-3 py-2 text-gray-500">{item.produto.unidade}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.quantidade}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatCurrency(item.valorUnitario)}</td>
                    <td className="px-3 py-2 text-gray-500">{formatCurrency(item.desconto)}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totais */}
        <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Cálculo do Imposto</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Base de Cálculo ICMS', formatCurrency(totalNota)],
                ['Valor do ICMS', formatCurrency(totalNota * 0.12)],
                ['Base de Cálculo ICMS ST', formatCurrency(0)],
                ['Valor do ICMS ST', formatCurrency(0)],
                ['Valor dos Produtos', formatCurrency(totalNota)],
                ['Valor do Frete', formatCurrency(0)],
                ['Valor do Seguro', formatCurrency(0)],
                ['Outras Despesas', formatCurrency(0)],
                ['Valor do IPI', formatCurrency(0)],
                ['Valor do PIS', formatCurrency(totalNota * 0.0065)],
                ['Valor do COFINS', formatCurrency(totalNota * 0.03)],
                ['Desconto', formatCurrency(0)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">Transportador</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                <div>
                  <p className="font-semibold">Frete por conta</p>
                  <p>0 — Emitente</p>
                </div>
                <div>
                  <p className="font-semibold">Modalidade</p>
                  <p>Sem frete</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t-2 border-gray-800 dark:border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">VALOR TOTAL DA NF-e</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalNota)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Informações Complementares</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito de ICMS, ISS, PIS e COFINS.
            Emitido pelo sistema Syncromoney PREMIUM — syncromoney.com.br
          </p>
        </div>
      </div>
    </div>
  )
}
