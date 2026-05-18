'use client'

export const dynamic = 'force-dynamic'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Download, Printer, BarChart3 } from 'lucide-react'
import { useEffect, useRef } from 'react'

type TipoRelatorio = 'recebimentos' | 'pagamentos' | 'inadimplencia' | 'fluxo' | 'categorias'

interface LinhaRelatorio {
  data: string
  descricao: string
  valor: number
  status: string
  tipo?: string
  categoria?: string
  cliente_fornecedor?: string
}

function exportarCSV(dados: LinhaRelatorio[], nome: string) {
  const cabecalho = 'Data,Descrição,Valor,Status,Cliente/Fornecedor\n'
  const linhas = dados.map(r =>
    `${r.data},"${r.descricao}",${r.valor},${r.status},"${r.cliente_fornecedor ?? ''}"`
  ).join('\n')
  const blob = new Blob(['﻿' + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function imprimirRelatorio(dados: LinhaRelatorio[], titulo: string, periodo: string, total: number) {
  const linhas = dados.map(r => `
    <tr>
      <td>${r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td>${r.descricao ?? '—'}</td>
      <td>${r.cliente_fornecedor || '—'}</td>
      <td style="text-align:center">${r.status}</td>
      <td style="text-align:right">R$ ${Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .sub { color: #555; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #e5e7eb; }
    td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
    tr:hover td { background: #fafafa; }
    tfoot td { font-weight: bold; background: #f9fafb; border-top: 2px solid #e5e7eb; }
    .total-val { text-align: right; }
    @media print {
      body { padding: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <h1>Relatório de ${titulo}</h1>
  <p class="sub">Período: ${periodo} &nbsp;|&nbsp; ${dados.length} registro(s)</p>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Descrição</th>
        <th>Cliente / Fornecedor</th>
        <th style="text-align:center">Status</th>
        <th style="text-align:right">Valor</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">Total</td>
        <td class="total-val">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tfoot>
  </table>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

  const janela = window.open('', '_blank', 'width=900,height=650')
  if (janela) {
    janela.document.write(html)
    janela.document.close()
  }
}

export default function RelatoriosPage() {
  const [tipo, setTipo] = useState<TipoRelatorio>('recebimentos')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  })
  const [dados, setDados] = useState<LinhaRelatorio[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const { toast: _toast } = useToast()
  const tabelaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const gerarRelatorio = useCallback(async () => {
    if (!userId || !dateFrom || !dateTo) return
    setLoading(true)
    try {
      const supabase = createClient()
      let linhas: LinhaRelatorio[] = []

      if (tipo === 'recebimentos') {
        const { data } = await supabase
          .from('parcelas_receber')
          .select('data_recebimento, valor_recebido, status, contas_receber(descricao, clientes(nome))')
          .eq('user_id', userId)
          .eq('status', 'recebido')
          .gte('data_recebimento', dateFrom)
          .lte('data_recebimento', dateTo)
          .order('data_recebimento')

        linhas = (data ?? []).map((p: Record<string, unknown>) => {
          const cr = p.contas_receber as { descricao?: string; clientes?: { nome?: string } } | null
          return {
            data: p.data_recebimento as string,
            descricao: cr?.descricao ?? '',
            valor: (p.valor_recebido as number) ?? 0,
            status: 'Recebido',
            cliente_fornecedor: cr?.clientes?.nome ?? '',
          }
        })
      }

      if (tipo === 'pagamentos') {
        const { data } = await supabase
          .from('parcelas_pagar')
          .select('data_pagamento, valor_pago, status, contas_pagar(descricao, fornecedores(nome))')
          .eq('user_id', userId)
          .eq('status', 'pago')
          .gte('data_pagamento', dateFrom)
          .lte('data_pagamento', dateTo)
          .order('data_pagamento')

        linhas = (data ?? []).map((p: Record<string, unknown>) => {
          const cp = p.contas_pagar as { descricao?: string; fornecedores?: { nome?: string } } | null
          return {
            data: p.data_pagamento as string,
            descricao: cp?.descricao ?? '',
            valor: (p.valor_pago as number) ?? 0,
            status: 'Pago',
            cliente_fornecedor: cp?.fornecedores?.nome ?? '',
          }
        })
      }

      if (tipo === 'inadimplencia') {
        const { data } = await supabase
          .from('parcelas_receber')
          .select('data_vencimento, valor, status, contas_receber(descricao, clientes(nome))')
          .eq('user_id', userId)
          .eq('status', 'atrasado')
          .order('data_vencimento')

        linhas = (data ?? []).map((p: Record<string, unknown>) => {
          const cr = p.contas_receber as { descricao?: string; clientes?: { nome?: string } } | null
          return {
            data: p.data_vencimento as string,
            descricao: cr?.descricao ?? '',
            valor: p.valor as number,
            status: 'Atrasado',
            cliente_fornecedor: cr?.clientes?.nome ?? '',
          }
        })
      }

      if (tipo === 'fluxo') {
        const { data } = await supabase
          .from('movimentacoes_conta')
          .select('data_movimentacao, descricao, valor, tipo')
          .eq('user_id', userId)
          .gte('data_movimentacao', dateFrom)
          .lte('data_movimentacao', dateTo)
          .order('data_movimentacao')

        linhas = (data ?? []).map((m: Record<string, unknown>) => ({
          data: m.data_movimentacao as string,
          descricao: m.descricao as string,
          valor: m.valor as number,
          status: m.tipo as string,
        }))
      }

      setDados(linhas)
    } catch {
      _toast('Erro ao gerar relatório', 'error')
    } finally {
      setLoading(false)
    }
  }, [userId, tipo, dateFrom, dateTo, _toast])

  const totalValor = dados.reduce((s, r) => s + r.valor, 0)

  const RELATORIOS = [
    { id: 'recebimentos', label: 'Recebimentos', icon: '📈' },
    { id: 'pagamentos', label: 'Pagamentos', icon: '📉' },
    { id: 'inadimplencia', label: 'Inadimplência', icon: '⚠️' },
    { id: 'fluxo', label: 'Fluxo de Caixa', icon: '💰' },
  ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500">Análise detalhada das suas finanças</p>
      </div>

      {/* Seleção de relatório */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {RELATORIOS.map((r) => (
          <button
            key={r.id}
            onClick={() => setTipo(r.id as TipoRelatorio)}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              tipo === r.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-200 bg-white'
            }`}
          >
            <p className="text-2xl mb-1">{r.icon}</p>
            <p className={`text-sm font-medium ${tipo === r.id ? 'text-blue-700' : 'text-gray-700'}`}>{r.label}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
              <div>
                <Label className="text-center block mb-1">Data Inicial</Label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full" />
              </div>
              <div>
                <Label className="text-center block mb-1">Data Final</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full" />
              </div>
            </div>
            <Button onClick={gerarRelatorio} disabled={loading} className="w-full max-w-md">
              {loading ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {dados.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                {RELATORIOS.find(r => r.id === tipo)?.label} — {dados.length} registro(s)
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportarCSV(dados, tipo)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const label = RELATORIOS.find(r => r.id === tipo)?.label ?? tipo
                  const periodo = `${new Date(dateFrom + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dateTo + 'T12:00:00').toLocaleDateString('pt-BR')}`
                  imprimirRelatorio(dados, label, periodo, totalValor)
                }}>
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Imprimir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0" ref={tabelaRef}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                    <th className="text-left px-6 py-3">Data</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Cliente/Fornecedor</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-6 py-3">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dados.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3">{formatDate(r.data)}</td>
                      <td className="px-4 py-3 text-gray-900">{r.descricao}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{r.cliente_fornecedor || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r.status}</span>
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(r.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t border-gray-200">
                    <td colSpan={4} className="px-6 py-3 text-gray-700">Total</td>
                    <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(totalValor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
