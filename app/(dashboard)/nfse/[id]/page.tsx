'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, XCircle, Printer, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notasDeServico } from '@/lib/fiscal/mock-data'

export default function NFSeVisualizarPage() {
  const { id } = useParams()
  const nota = notasDeServico.find((n) => n.id === id) ?? notasDeServico[0]

  return (
    <div className="max-w-3xl mx-auto space-y-4 print:max-w-none print:space-y-0">
      <style>{`
        @media print {
          body > * { display: none !important; }
          #nfse-print-root { display: block !important; }
          .print\\:hidden { display: none !important; }
          #nfse-doc { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/nfse"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />Imprimir
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />Baixar PDF
          </Button>
          {nota.status !== 'cancelada' && (
            <Button variant="destructive" size="sm">
              <XCircle className="h-4 w-4" />Cancelar NFS-e
            </Button>
          )}
        </div>
      </div>

      {/* Documento NFS-e */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden" id="nfse-doc">

        {/* Cabeçalho */}
        <div className="bg-green-700 text-white p-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-green-700 font-bold text-xl shrink-0">
              SM
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">Empresa Exemplo Ltda</p>
              <p className="text-green-200 text-sm">CNPJ: 12.345.678/0001-90</p>
              <p className="text-green-200 text-sm">IM: 98765 — Juiz de Fora / MG</p>
              <p className="text-green-200 text-xs mt-1">Rua das Flores, 123 — Centro — CEP 36010-010</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-green-200 text-xs uppercase tracking-widest font-semibold">Nota Fiscal de Serviços</p>
            <p className="text-white font-bold text-xs">Eletrônica — NFS-e</p>
            <p className="text-green-200 text-xs mt-1">Prefeitura de Juiz de Fora / MG</p>
            <div className="mt-3 bg-white/20 rounded-lg px-4 py-2 text-center">
              <p className="text-green-200 text-[10px] uppercase">Número</p>
              <p className="text-white font-bold text-2xl">{nota.numero}</p>
            </div>
          </div>
        </div>

        {/* Status */}
        {nota.status === 'emitida' && (
          <div className="flex items-center gap-3 px-6 py-3 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-800 dark:text-green-300">NFS-e Autorizada — Prefeitura de Juiz de Fora</p>
              <p className="text-xs text-green-700 dark:text-green-400">
                Código de Verificação: <span className="font-mono font-bold">{nota.codigoVerificacao}</span>
                {' '} — Emitida em {formatDate(nota.dataEmissao)}
              </p>
            </div>
          </div>
        )}

        {/* Tomador */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Tomador do Serviço</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700">
            <div className="p-4 col-span-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Razão Social / Nome</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{nota.tomador}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Av. Barão do Rio Branco, 2000 — Centro — Juiz de Fora / MG</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">CNPJ / CPF</p>
              <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{nota.cnpjTomador}</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase mt-2 mb-1">Inscrição Municipal</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">—</p>
            </div>
          </div>
        </div>

        {/* Discriminação dos serviços */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Discriminação dos Serviços</p>
          </div>
          <div className="p-6 space-y-4">
            {nota.itens.map((item, i) => (
              <div key={i} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Código LC 116</p>
                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{item.servico.codigoLc116}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Código Serviço</p>
                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{item.servico.codigo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Quantidade</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{item.quantidade}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Valor Unitário</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(item.valorUnitario)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Descrição</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{item.descricao}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Valores fiscais */}
        <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Valores do ISS</p>
            <div className="space-y-2 text-sm">
              {[
                ['Alíquota ISS', `${nota.itens[0]?.servico.aliquotaIss ?? 2}%`],
                ['Base de Cálculo', formatCurrency(nota.valorServicos)],
                ['Valor do ISS', formatCurrency(nota.valorIss)],
                ['ISS Retido na Fonte', 'Não'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">Deduções / Descontos</p>
            <div className="space-y-2 text-sm">
              {[
                ['Valor dos Serviços',formatCurrency(nota.valorServicos)],
                ['Deduções', formatCurrency(0)],
                ['Descontos', formatCurrency(0)],
                ['Outras Retenções', formatCurrency(0)],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="p-6 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Valor Total dos Serviços</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(nota.valorServicos)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">(-) ISS ({nota.itens[0]?.servico.aliquotaIss ?? 2}%)</p>
            <p className="text-sm font-medium text-red-600">- {formatCurrency(nota.valorIss)}</p>
          </div>
          <div className="text-right border-l border-gray-300 dark:border-gray-600 pl-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Valor Líquido a Receber</p>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{formatCurrency(nota.valorLiquido)}</p>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-6 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <p>Emitido pelo sistema Syncromoney PREMIUM — syncromoney.com.br</p>
          <p>Prefeitura de Juiz de Fora — ISS-Fácil</p>
        </div>
      </div>
    </div>
  )
}
