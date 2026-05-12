'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Download, XCircle, Receipt, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'

interface NfseRow {
  id: string
  numero?: string
  numero_rps: number
  tomador_razao_social: string
  tomador_cnpj_cpf?: string
  valor_servicos: number
  valor_iss?: number
  valor_liquido?: number
  aliquota_iss?: number
  iss_retido: boolean
  status: string
  ambiente: string
  codigo_verificacao?: string
  link_pdf?: string
  link_xml?: string
  data_emissao: string
  erro_mensagem?: string
  focus_ref?: string
}

const STATUS_CFG: Record<string, { label: string; className: string }> = {
  autorizada:   { label: 'Autorizada',   className: 'bg-green-100 text-green-800'  },
  processando:  { label: 'Processando',  className: 'bg-yellow-100 text-yellow-800' },
  erro:         { label: 'Erro',         className: 'bg-red-100 text-red-800'       },
  cancelada:    { label: 'Cancelada',    className: 'bg-red-100 text-red-800'       },
}

export default function NFSePage() {
  const [notas, setNotas] = useState<NfseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [userId, setUserId] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const fetchNotas = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await createClient()
      .from('nfse')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setNotas((data ?? []) as NfseRow[])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchNotas() }, [fetchNotas])

  async function handleCancelar(nota: NfseRow) {
    if (!confirm(`Cancelar NFS-e RPS ${nota.numero_rps}?`)) return
    try {
      const res = await fetch(`/api/nfse/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: nota.focus_ref, id: nota.id }),
      })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.ok) {
        toast('NFS-e cancelada', 'success')
        fetchNotas()
      } else {
        toast(json.error ?? 'Erro ao cancelar', 'error')
      }
    } catch {
      toast('Erro ao cancelar NFS-e', 'error')
    }
  }

  const filtradas = notas.filter(
    n => !busca ||
      n.tomador_razao_social.toLowerCase().includes(busca.toLowerCase()) ||
      (n.numero ?? '').includes(busca) ||
      String(n.numero_rps).includes(busca)
  )

  const autorizadas = notas.filter(n => n.status === 'autorizada')
  const totalLiquido = autorizadas.reduce((s, n) => s + (n.valor_liquido ?? 0), 0)
  const totalIss = autorizadas.reduce((s, n) => s + (n.valor_iss ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NFS-e</h1>
          <p className="text-sm text-gray-500 mt-0.5">Nota Fiscal de Serviços — Prefeitura de Juiz de Fora / MG</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700 text-white" asChild>
          <Link href="/nfse/nova"><Plus className="h-4 w-4 mr-1" />Emitir NFS-e</Link>
        </Button>
      </div>

      {/* Banner */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 border border-green-200">
        <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-green-800 text-sm">Integração ativa — Focus NFe</p>
          <p className="text-green-700 text-sm">Emita NFS-e diretamente pelo Syncromoney, sem acessar o portal da prefeitura.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Valor Líquido',   value: formatCurrency(totalLiquido) },
          { label: 'ISS recolhido',   value: formatCurrency(totalIss) },
          { label: 'Autorizadas',     value: String(autorizadas.length) },
          { label: 'Total de notas',  value: String(notas.length) },
        ].map(({ label, value }) => (
          <Card key={label}><CardContent className="pt-6">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por tomador ou número..." className="pl-9" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0"><CardTitle className="text-base">Notas Fiscais de Serviço</CardTitle></CardHeader>
        <CardContent className="p-0 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Número/RPS', 'Tomador', 'Data', 'Valor Serviços', 'ISS', 'Valor Líquido', 'Status', 'Ações'].map(h => (
                      <th key={h} className={cn('px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide',
                        ['Valor Serviços','ISS','Valor Líquido','Ações'].includes(h) ? 'text-right' : 'text-left')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtradas.map(nota => <NFSeLine key={nota.id} nota={nota} onCancelar={handleCancelar} />)}
                  {filtradas.length === 0 && (
                    <tr><td colSpan={8} className="px-6 py-12 text-center">
                      <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-400">Nenhuma NFS-e encontrada</p>
                      <Link href="/nfse/nova" className="text-green-600 text-sm font-medium mt-1 inline-block hover:underline">Emitir primeira NFS-e</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NFSeLine({ nota, onCancelar }: { nota: NfseRow; onCancelar: (n: NfseRow) => void }) {
  const st = STATUS_CFG[nota.status] ?? STATUS_CFG['processando']
  const isHom = nota.ambiente === 'homologacao'
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-green-500 shrink-0" />
          <span className="font-mono font-semibold text-gray-800">{nota.numero ?? `RPS ${nota.numero_rps}`}</span>
        </div>
        {isHom && <span className="text-xs text-amber-600 font-medium">Homologação</span>}
        {nota.codigo_verificacao && <p className="text-xs text-gray-400">CÓD: {nota.codigo_verificacao}</p>}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-800">{nota.tomador_razao_social}</p>
        {nota.tomador_cnpj_cpf && <p className="text-xs text-gray-400">{nota.tomador_cnpj_cpf}</p>}
      </td>
      <td className="px-4 py-3 text-gray-600">{formatDate(nota.data_emissao)}</td>
      <td className="px-4 py-3 text-right">{formatCurrency(nota.valor_servicos)}</td>
      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(nota.valor_iss ?? 0)}</td>
      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(nota.valor_liquido ?? nota.valor_servicos)}</td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', st.className)}>
          {st.label}
        </span>
        {nota.status === 'erro' && nota.erro_mensagem && (
          <p className="text-xs text-red-500 mt-0.5 max-w-[140px] truncate" title={nota.erro_mensagem}>{nota.erro_mensagem}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/nfse/${nota.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg inline-flex">
            <Eye className="h-4 w-4" />
          </Link>
          {nota.link_pdf && (
            <a href={nota.link_pdf} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg inline-flex">
              <Download className="h-4 w-4" />
            </a>
          )}
          {nota.status === 'autorizada' && (
            <button onClick={() => onCancelar(nota)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
