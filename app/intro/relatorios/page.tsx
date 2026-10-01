'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { BarChart3, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { hojeISO } from '@/lib/intro/produtos'
import {
  RELATORIOS, baixarCsv, executarRelatorio, formatarCelula, totais,
  type LinhaRelatorio,
} from '@/lib/intro/relatorios'

const rotulo = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

function primeiroDiaDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function maisDias(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function RelatoriosPage() {
  const [tipoId, setTipoId] = useState(RELATORIOS[0].id)
  const [ini, setIni] = useState(primeiroDiaDoMes())
  const [fim, setFim] = useState(hojeISO())
  const [linhas, setLinhas] = useState<LinhaRelatorio[] | null>(null)
  const [geradoDe, setGeradoDe] = useState<string>('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const def = RELATORIOS.find((r) => r.id === tipoId)!

  function escolher(id: string) {
    setTipoId(id)
    setLinhas(null)
    setErro('')
    // Validade: padrão "vence nos próximos 30 dias"; os demais usam o mês atual
    if (id === 'validade') setFim(maisDias(30))
    else if (fim > hojeISO()) setFim(hojeISO())
  }

  async function gerar() {
    setErro('')
    setCarregando(true)
    // Relatórios sem período usam datas fictícias válidas
    const inicio = def.periodo === 'intervalo' ? ini : '2000-01-01'
    const final = def.periodo === 'nenhum' ? hojeISO() : fim
    const { linhas: l, erro: e } = await executarRelatorio(def.id, inicio, final)
    setCarregando(false)
    if (e) { setErro(e); setLinhas(null); return }
    setLinhas(l)
    setGeradoDe(
      def.periodo === 'intervalo' ? `${new Date(ini + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(fim + 'T00:00:00').toLocaleDateString('pt-BR')}`
        : def.periodo === 'ate' ? `até ${new Date(fim + 'T00:00:00').toLocaleDateString('pt-BR')}` : 'posição atual'
    )
  }

  const tot = linhas ? totais(def.colunas, linhas) : {}

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Escolha o relatório e o período. Exporte para Excel (CSV) ou imprima/salve em PDF.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-1 print:hidden">
          {RELATORIOS.map((r) => (
            <button key={r.id} onClick={() => escolher(r.id)}
              className={cn('w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                r.id === tipoId ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}>
              {r.titulo}
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <Card className="print:hidden"><CardContent className="pt-4 space-y-4">
            <p className="text-sm text-gray-500">{def.descricao}</p>
            <div className="flex flex-wrap items-end gap-3">
              {def.periodo === 'intervalo' && (
                <>
                  <div><label className={rotulo}>De</label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
                  <div><label className={rotulo}>Até</label><Input type="date" value={fim} max={hojeISO()} onChange={(e) => setFim(e.target.value)} /></div>
                </>
              )}
              {def.periodo === 'ate' && (
                <div><label className={rotulo}>Vencendo até</label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
              )}
              <Button onClick={gerar} disabled={carregando}><BarChart3 className="h-4 w-4 mr-1" />{carregando ? 'Gerando...' : 'Gerar relatório'}</Button>
              {linhas && linhas.length > 0 && (
                <>
                  <Button variant="outline" onClick={() => baixarCsv(`${def.id}-${hojeISO()}`, def, linhas)}><Download className="h-4 w-4 mr-1" />Excel (CSV)</Button>
                  <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimir / PDF</Button>
                </>
              )}
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
          </CardContent></Card>

          {linhas && (
            <Card><CardContent className="p-0">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-white">{def.titulo}</p>
                <p className="text-xs text-gray-500">{geradoDe} · {linhas.length} linha(s)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
                      {def.colunas.map((c) => (
                        <th key={c.key} className={cn('px-4 py-3', c.tipo === 'moeda' || c.tipo === 'numero' ? 'text-right' : 'text-left')}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {linhas.map((l, i) => (
                      <tr key={i}>
                        {def.colunas.map((c) => (
                          <td key={c.key} className={cn('px-4 py-2', c.tipo === 'moeda' || c.tipo === 'numero' ? 'text-right' : 'text-left',
                            c.key === 'diferenca' && Number(l[c.key]) < 0 && 'text-red-600', c.key === 'dias' && Number(l[c.key]) < 0 && 'text-red-600 font-semibold')}>
                            {formatarCelula(l[c.key], c.tipo)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {linhas.length === 0 && <tr><td colSpan={def.colunas.length} className="px-4 py-10 text-center text-gray-400">Nada encontrado neste período.</td></tr>}
                    {linhas.length > 0 && Object.keys(tot).length > 0 && (
                      <tr className="font-bold bg-gray-50 dark:bg-gray-700/50">
                        {def.colunas.map((c, idx) => (
                          <td key={c.key} className={cn('px-4 py-3', c.tipo === 'moeda' || c.tipo === 'numero' ? 'text-right' : 'text-left')}>
                            {idx === 0 ? 'Total' : c.key in tot ? formatarCelula(tot[c.key], c.tipo) : ''}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  )
}
