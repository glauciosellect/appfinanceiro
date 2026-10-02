'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Plus, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { hojeISO } from '@/lib/intro/produtos'
import {
  baixarParcela, cancelarConta, criarConta, listarParcelas, resumoFornecedores,
  type ParcelaLinha, type ResumoFornecedor, type TipoConta,
} from '@/lib/intro/contas'

interface Pessoa { id: string; nome: string }
type Status = 'abertas' | 'pagas' | 'todas'

const ORIGEM: Record<string, string> = { entrada: 'Entrada de mercadoria', consignado: 'Acerto de consignação', fiado: 'Fiado (venda)', manual: 'Lançamento manual' }
const rotulo = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export function ContasLista({ tipo }: { tipo: TipoConta }) {
  const pagar = tipo === 'pagar'
  const [userId, setUserId] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [resumo, setResumo] = useState<ResumoFornecedor[]>([])
  const [parcelas, setParcelas] = useState<ParcelaLinha[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [pessoaId, setPessoaId] = useState('')
  const [status, setStatus] = useState<Status>('abertas')

  const [baixa, setBaixa] = useState<ParcelaLinha | null>(null)
  const [dataBaixa, setDataBaixa] = useState(hojeISO())
  const [baixando, setBaixando] = useState(false)

  const [novaOpen, setNovaOpen] = useState(false)
  const [nova, setNova] = useState({ pessoa: '', descricao: '', valor: '', vencimento: hojeISO(), parcelas: 1 })
  const [novaErro, setNovaErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    try {
      const [ps, rs, pess] = await Promise.all([
        listarParcelas(tipo, user.id, { status, pessoaId: pessoaId || undefined }),
        pagar ? resumoFornecedores() : Promise.resolve([] as ResumoFornecedor[]),
        (pagar
          ? supabase.from('fornecedores').select('id, nome').eq('user_id', user.id).is('deleted_at', null).order('nome')
          : supabase.from('clientes').select('id, nome').eq('user_id', user.id).is('deleted_at', null).order('nome')),
      ])
      setParcelas(ps)
      setResumo(rs)
      if (!pess.error) setPessoas((pess.data ?? []) as Pessoa[])
      setErro('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
    }
    setLoading(false)
  }, [tipo, pagar, status, pessoaId])

  useEffect(() => { carregar() }, [carregar])

  const hoje = hojeISO()
  const abertas = parcelas.filter((p) => !p.paga)
  const vencidas = abertas.filter((p) => p.vencimento < hoje)
  const totalVencido = vencidas.reduce((s, p) => s + p.valor, 0)
  const em7 = new Date(hoje + 'T00:00:00'); em7.setDate(em7.getDate() + 7)
  const limite7 = `${em7.getFullYear()}-${String(em7.getMonth() + 1).padStart(2, '0')}-${String(em7.getDate()).padStart(2, '0')}`
  const totalProx7 = abertas.filter((p) => p.vencimento >= hoje && p.vencimento <= limite7).reduce((s, p) => s + p.valor, 0)
  const totalConsignado = resumo.reduce((s, r) => s + r.consignado_a_acertar, 0)
  const resumoSel = useMemo(() => resumo.find((r) => r.fornecedor_id === pessoaId), [resumo, pessoaId])
  const nomeSel = pessoas.find((p) => p.id === pessoaId)?.nome

  async function confirmarBaixa() {
    if (!baixa) return
    setBaixando(true)
    const msg = await baixarParcela(tipo, baixa.id, dataBaixa)
    setBaixando(false)
    if (msg) { setErro(msg); setBaixa(null); return }
    setBaixa(null)
    carregar()
  }

  async function salvarNova() {
    setNovaErro('')
    const valor = Number(String(nova.valor).replace(',', '.'))
    setSalvando(true)
    const msg = await criarConta({
      tipo,
      fornecedor_id: pagar ? nova.pessoa || null : null,
      cliente_id: pagar ? null : nova.pessoa || null,
      descricao: nova.descricao,
      valor,
      vencimento: nova.vencimento,
      parcelas: nova.parcelas,
    })
    setSalvando(false)
    if (msg) { setNovaErro(msg); return }
    setNovaOpen(false)
    setNova({ pessoa: '', descricao: '', valor: '', vencimento: hojeISO(), parcelas: 1 })
    carregar()
  }

  async function excluir(p: ParcelaLinha) {
    if (!confirm('Cancelar esta conta lançada manualmente?')) return
    const msg = await cancelarConta(tipo, p.contaId)
    if (msg) { setErro(msg); return }
    carregar()
  }

  const verbo = pagar ? 'Pagar' : 'Receber'
  const baixadaLabel = pagar ? 'Pago' : 'Recebido'

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pagar ? 'Contas a pagar' : 'Contas a receber'}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {pagar ? 'Compras a prazo, acertos de consignação e outras contas da loja.' : 'Fiado de clientes e outros valores a receber.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={pagar ? '/intro/relatorios?tipo=contas_pagas' : '/intro/relatorios?tipo=contas_recebidas'}>{pagar ? 'Ver pagamentos por período' : 'Ver recebimentos por período'}</Link>
          </Button>
          <Button onClick={() => { setNovaErro(''); setNovaOpen(true) }}><Plus className="h-4 w-4 mr-1" />Nova conta</Button>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className={cn('grid gap-4', pagar ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2')}>
        <Card><CardContent className="py-4"><p className="text-xs text-gray-500">Vencidas</p><p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalVencido)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-gray-500">Vencem em 7 dias</p><p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalProx7)}</p></CardContent></Card>
        {pagar && <Card><CardContent className="py-4"><p className="text-xs text-gray-500">Consignado vendido, a acertar</p><p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(totalConsignado)}</p></CardContent></Card>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-72" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
          <option value="">{pagar ? 'Todos os fornecedores' : 'Todos os clientes'}</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-48" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="abertas">Em aberto</option>
          <option value="pagas">{baixadaLabel}s</option>
          <option value="todas">Todas</option>
        </select>
      </div>

      {pagar && pessoaId && (
        <Card className="border-blue-200">
          <CardContent className="py-4 space-y-3">
            <p className="font-semibold text-gray-900 dark:text-white">Você deve a {nomeSel}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">A prazo vencido</p><p className="font-bold text-red-600">{formatCurrency(resumoSel?.vencido ?? 0)}</p></div>
              <div><p className="text-xs text-gray-500">A prazo a vencer</p><p className="font-bold">{formatCurrency(resumoSel?.a_vencer ?? 0)}</p></div>
              <div><p className="text-xs text-gray-500">Consignado a acertar</p><p className="font-bold text-blue-700">{formatCurrency(resumoSel?.consignado_a_acertar ?? 0)}</p></div>
              <div><p className="text-xs text-gray-500">Total devido</p><p className="font-extrabold text-lg">{formatCurrency(resumoSel?.total ?? 0)}</p></div>
            </div>
            {(resumoSel?.consignado_a_acertar ?? 0) > 0 && (
              <Button asChild size="sm"><Link href={`/intro/acertos/novo?fornecedor=${pessoaId}`}>Fazer acerto com {nomeSel}</Link></Button>
            )}
          </CardContent>
        </Card>
      )}

      {pagar && !pessoaId && resumo.length > 0 && (
        <Card><CardContent className="p-0">
          <p className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700">Quanto devo a cada fornecedor</p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100 dark:border-gray-700">
              <th className="px-4 py-2 text-left">Fornecedor</th><th className="px-4 py-2 text-right">Vencido</th><th className="px-4 py-2 text-right">A vencer</th>
              <th className="px-4 py-2 text-right">Consignado a acertar</th><th className="px-4 py-2 text-right">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {resumo.map((r) => (
                <tr key={r.fornecedor_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer" onClick={() => setPessoaId(r.fornecedor_id)}>
                  <td className="px-4 py-2 font-medium text-emerald-700 dark:text-emerald-400">{r.nome}</td>
                  <td className="px-4 py-2 text-right text-red-600">{formatCurrency(r.vencido)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(r.a_vencer)}</td>
                  <td className="px-4 py-2 text-right text-blue-700">{formatCurrency(r.consignado_a_acertar)}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3 text-left">Vencimento</th>
            <th className="px-4 py-3 text-left">{pagar ? 'Fornecedor' : 'Cliente'}</th>
            <th className="px-4 py-3 text-left">Descrição</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3 text-left">Situação</th>
            <th className="w-28" />
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {parcelas.map((p) => {
              const atrasada = !p.paga && p.vencimento < hoje
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">{formatDate(p.vencimento)}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{p.pessoa ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800 dark:text-gray-200">{p.descricao}{p.total > 1 ? ` (${p.numero}/${p.total})` : ''}</p>
                    <p className="text-xs text-gray-400">{ORIGEM[p.origem] ?? p.origem}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(p.valor)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full',
                      p.paga ? 'bg-green-50 text-green-700' : atrasada ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>
                      {p.paga ? `${baixadaLabel}${p.dataBaixa ? ` em ${formatDate(p.dataBaixa)}` : ''}` : atrasada ? 'Vencida' : 'Em aberto'}
                    </span>
                  </td>
                  <td className="px-2 text-right whitespace-nowrap">
                    {!p.paga && <Button size="sm" variant="outline" onClick={() => { setDataBaixa(hojeISO()); setBaixa(p) }}><Check className="h-3.5 w-3.5 mr-1" />{verbo === 'Pagar' ? 'Pagar' : 'Receber'}</Button>}
                    {!p.paga && p.origem === 'manual' && (
                      <button onClick={() => excluir(p)} title="Cancelar conta" className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              )
            })}
            {!loading && parcelas.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center"><Wallet className="h-10 w-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-400">Nada por aqui.</p></td></tr>
            )}
          </tbody>
        </table>
      </div></CardContent></Card>

      <Dialog open={!!baixa} onOpenChange={(o) => !o && setBaixa(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{pagar ? 'Registrar pagamento' : 'Registrar recebimento'}</DialogTitle></DialogHeader>
          {baixa && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{baixa.pessoa ?? ''} · {baixa.descricao}<br /><strong>{formatCurrency(baixa.valor)}</strong></p>
              <div><label className={rotulo}>Data</label><Input type="date" value={dataBaixa} max={hojeISO()} onChange={(e) => setDataBaixa(e.target.value)} /></div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setBaixa(null)} disabled={baixando}>Cancelar</Button>
                <Button className="flex-1" onClick={confirmarBaixa} disabled={baixando || !dataBaixa}>{baixando ? 'Salvando...' : 'Confirmar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{pagar ? 'Nova conta a pagar' : 'Nova conta a receber'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className={rotulo}>{pagar ? 'Fornecedor (opcional)' : 'Cliente (opcional)'}</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={nova.pessoa} onChange={(e) => setNova({ ...nova, pessoa: e.target.value })}>
                <option value="">—</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div><label className={rotulo}>Descrição *</label><Input value={nova.descricao} onChange={(e) => setNova({ ...nova, descricao: e.target.value })} placeholder={pagar ? 'Ex.: aluguel, energia' : 'Ex.: serviço prestado'} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={rotulo}>Valor (R$) *</label><Input type="number" min="0" step="0.01" value={nova.valor} onChange={(e) => setNova({ ...nova, valor: e.target.value })} /></div>
              <div><label className={rotulo}>1º vencimento *</label><Input type="date" value={nova.vencimento} onChange={(e) => setNova({ ...nova, vencimento: e.target.value })} /></div>
              <div><label className={rotulo}>Parcelas</label><Input type="number" min={1} max={60} value={nova.parcelas} onChange={(e) => setNova({ ...nova, parcelas: Math.min(60, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} /></div>
            </div>
            {novaErro && <p className="text-sm text-red-600">{novaErro}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setNovaOpen(false)} disabled={salvando}>Cancelar</Button>
              <Button className="flex-1" onClick={salvarNova} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
