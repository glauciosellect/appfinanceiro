'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getSessaoPorId, getRelatorioFechamento } from '@/lib/supabase/caixa'
import { getFiscalConfig } from '@/lib/supabase/fiscal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import type { CaixaSessao, FiscalConfig } from '@/types'

type Relatorio = Awaited<ReturnType<typeof getRelatorioFechamento>>

export default function FechamentoCaixaPdfPage() {
  const params = useParams()
  const caixaSessaoId = params.id as string
  const { toast } = useToast()

  const [sessao, setSessao] = useState<CaixaSessao | null>(null)
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTudo = useCallback(async () => {
    if (!caixaSessaoId) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [_sessao, _fiscal] = await Promise.all([
        getSessaoPorId(user.id, caixaSessaoId),
        getFiscalConfig(user.id),
      ])
      if (_sessao) {
        setSessao(_sessao)
        const _relatorio = await getRelatorioFechamento(user.id, caixaSessaoId)
        setRelatorio(_relatorio)
      }
      setFiscalConfig(_fiscal)
    } catch {
      toast('Erro ao carregar relatório de fechamento', 'error')
    } finally {
      setLoading(false)
    }
  }, [caixaSessaoId, toast])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando...
      </div>
    )
  }

  if (!sessao || !relatorio) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-xl font-bold text-gray-900">Sessão de caixa não encontrada</p>
        <Button asChild variant="outline">
          <Link href="/caixa"><ArrowLeft className="h-4 w-4 mr-2" />Voltar ao Caixa</Link>
        </Button>
      </div>
    )
  }

  const nomeEmpresa = fiscalConfig?.razao_social || 'Empresa'
  const diferenca = sessao.diferenca ?? 0
  const jaFechado = sessao.status === 'fechado'

  return (
    <div className="max-w-2xl mx-auto space-y-3 print:max-w-none print:space-y-0">

      {/* Barra de ações */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/caixa"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" />Imprimir / Salvar PDF
        </Button>
      </div>

      {/* Documento */}
      <div className="bg-white text-black border-2 border-gray-700 text-[11px]">

        {/* Cabeçalho */}
        <div className="border-b-2 border-gray-700 p-3">
          <p className="font-bold text-base text-gray-900 leading-tight">{nomeEmpresa}</p>
          {fiscalConfig?.cnpj && <p>CNPJ: <strong>{fiscalConfig.cnpj}</strong></p>}
        </div>

        {/* Título */}
        <div className="border-b-2 border-gray-700 bg-gray-50 py-2 text-center">
          <p className="font-bold text-base text-gray-900 tracking-wide">RELATÓRIO DE FECHAMENTO DE CAIXA</p>
          {!jaFechado && <p className="text-[10px] text-amber-700 font-semibold mt-1">(Sessão ainda aberta — prévia)</p>}
        </div>

        {/* Dados da sessão */}
        <div className="border-b border-gray-700 p-3 grid grid-cols-2 gap-2">
          <p>Operador: <strong>{sessao.operador}</strong></p>
          <p>Status: <strong>{jaFechado ? 'Fechado' : 'Aberto'}</strong></p>
          <p>Abertura: <strong>{new Date(sessao.aberto_em).toLocaleString('pt-BR')}</strong></p>
          {sessao.fechado_em && <p>Fechamento: <strong>{new Date(sessao.fechado_em).toLocaleString('pt-BR')}</strong></p>}
          <p>Fundo de troco inicial: <strong>{formatCurrency(sessao.fundo_troco_inicial)}</strong></p>
        </div>

        {/* Saldos */}
        <div className="border-b border-gray-700 p-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded p-2">
              <p className="text-[9px] uppercase text-gray-500">Esperado</p>
              <p className="font-bold text-gray-900">{formatCurrency(relatorio.saldoEsperado)}</p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-[9px] uppercase text-gray-500">Contado</p>
              <p className="font-bold text-gray-900">{formatCurrency(sessao.saldo_contado ?? 0)}</p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <p className="text-[9px] uppercase text-gray-500">Diferença</p>
              <p className={`font-bold ${diferenca > 0 ? 'text-green-700' : diferenca < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {formatCurrency(diferenca)}
              </p>
            </div>
          </div>
        </div>

        {/* Vendas por forma de pagamento */}
        <div className="border-b border-gray-700">
          <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Vendas por forma de pagamento</p>
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {relatorio.vendasPorFormaPagamento.length === 0 ? (
                <tr><td className="text-center px-3 py-4 text-gray-400">Nenhuma venda concluída nesta sessão</td></tr>
              ) : (
                relatorio.vendasPorFormaPagamento.map((v) => (
                  <tr key={v.forma_pagamento_nome} className="border-b border-gray-200">
                    <td className="px-3 py-1.5">{v.forma_pagamento_nome} ({v.quantidade})</td>
                    <td className="px-3 py-1.5 text-right font-medium">{formatCurrency(v.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Movimentações */}
        <div className="p-3 space-y-1">
          <div className="flex justify-between"><span className="text-gray-600">Total sangrias</span><span className="font-medium text-red-600">{formatCurrency(relatorio.totalSangrias)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Total suprimentos</span><span className="font-medium text-green-600">{formatCurrency(relatorio.totalSuprimentos)}</span></div>
        </div>

        <div className="p-4 text-center">
          <p className="text-[9px] text-gray-400 italic">Relatório gerado no Syncromoney — syncromoney.com.br</p>
        </div>

      </div>
    </div>
  )
}
