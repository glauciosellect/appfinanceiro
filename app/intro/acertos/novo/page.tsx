'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { hojeISO } from '@/lib/intro/produtos'
import { diasParaVencer } from '@/lib/intro/estoque'
import { fecharAcerto, previaAcerto, type AcaoSobra, type Previa } from '@/lib/intro/acertos'

interface Forn { id: string; nome: string; cpf_cnpj: string | null; telefone: string | null }
interface Escolha { acao: AcaoSobra; quantidade: string; nova_validade: string }

const rotulo = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

function primeiroDiaDoMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function NovoAcertoConteudo() {
  const router = useRouter()
  const params = useSearchParams()
  const [fornecedores, setFornecedores] = useState<Forn[]>([])
  const [fornecedorId, setFornecedorId] = useState(params.get('fornecedor') ?? '')
  const [ini, setIni] = useState(params.get('ini') ?? primeiroDiaDoMes())
  const [fim, setFim] = useState(params.get('fim') ?? hojeISO())
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({})
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [fechando, setFechando] = useState(false)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return
      const { data } = await createClient().from('fornecedores').select('id, nome, cpf_cnpj, telefone').eq('user_id', user.id).is('deleted_at', null).order('nome')
      setFornecedores((data ?? []) as Forn[])
    }
    carregar()
  }, [])

  // Vindo de "Editar": fornecedor e período já preenchidos, então calcula na hora
  useEffect(() => {
    if (params.get('fornecedor') && params.get('ini') && params.get('fim')) calcular()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function calcular() {
    setErro('')
    setPrevia(null)
    if (!fornecedorId) { setErro('Escolha o fornecedor.'); return }
    setCarregando(true)
    const { previa: p, erro: e } = await previaAcerto(fornecedorId, ini, fim)
    setCarregando(false)
    if (e || !p) { setErro(e ?? 'Erro ao calcular.'); return }
    setPrevia(p)
    const inicial: Record<string, Escolha> = {}
    p.sobras.forEach((s) => { inicial[s.lote_id] = { acao: 'manter', quantidade: String(s.quantidade), nova_validade: '' } })
    setEscolhas(inicial)
  }

  function alterar(id: string, parcial: Partial<Escolha>) {
    setEscolhas((es) => ({ ...es, [id]: { ...es[id], ...parcial } }))
  }

  async function fechar() {
    if (!previa) return
    setErro('')
    const forn = fornecedores.find((f) => f.id === fornecedorId)
    if (!forn?.cpf_cnpj) { setErro('Cadastre o CPF/CNPJ do fornecedor antes de fechar o acerto: ele é conferido na confirmação do recibo.'); return }
    if (!forn.telefone) { setErro('Cadastre o telefone (WhatsApp) do fornecedor.'); return }
    for (const s of previa.sobras) {
      const e = escolhas[s.lote_id]
      if (e.acao === 'manter') continue
      const q = Number(e.quantidade)
      if (!(q > 0) || q > s.quantidade) { setErro(`Quantidade inválida: ${s.produto}`); return }
      if (e.acao === 'trocar' && s.controla_validade && !e.nova_validade) { setErro(`Informe a nova validade: ${s.produto}`); return }
    }
    const resumo = previa.itens.length === 0 ? 'Não há vendas no período; só devolução/troca.' : `A receber: ${formatCurrency(previa.total_repasse)}.`
    if (!confirm(`Fechar o acerto? ${resumo}\nDepois de fechado, o conteúdo não pode ser alterado.`)) return

    setFechando(true)
    const { id, erro: e } = await fecharAcerto({
      fornecedor_id: fornecedorId,
      ini,
      fim,
      sobras: previa.sobras.map((s) => {
        const x = escolhas[s.lote_id]
        return { lote_id: s.lote_id, acao: x.acao, quantidade: x.acao === 'manter' ? s.quantidade : Number(x.quantidade), nova_validade: x.nova_validade || null }
      }),
    })
    setFechando(false)
    if (e || !id) { setErro(e ?? 'Erro ao fechar o acerto.'); return }
    router.push(`/intro/acertos/${id}`)
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/intro/acertos" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Novo acerto com fornecedor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Escolha o fornecedor e o período para ver o que foi vendido e o que sobrou.</p>
        </div>
      </div>

      <Card><CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-2">
          <label className={rotulo}>Fornecedor</label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={fornecedorId} onChange={(e) => { setFornecedorId(e.target.value); setPrevia(null) }}>
            <option value="">Selecione...</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
        <div><label className={rotulo}>De</label><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
        <div><label className={rotulo}>Até</label><Input type="date" value={fim} max={hojeISO()} onChange={(e) => setFim(e.target.value)} /></div>
        <div className="sm:col-span-4"><Button onClick={calcular} disabled={carregando}><Search className="h-4 w-4 mr-1" />{carregando ? 'Calculando...' : 'Ver acerto'}</Button></div>
      </CardContent></Card>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {previa && (
        <>
          {previa.primeira_venda_pendente && previa.primeira_venda_pendente < ini && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              Há vendas consignadas pendentes desde {formatDate(previa.primeira_venda_pendente)}, antes do período escolhido. Elas ficarão para o próximo acerto, a menos que você ajuste a data inicial.
            </p>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Produtos vendidos no período</CardTitle></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 text-left">Produto</th><th className="px-4 py-2 text-right">Qtd</th><th className="px-4 py-2 text-right">Valor unit.</th>
                  <th className="px-4 py-2 text-right">Total vendido</th><th className="px-4 py-2 text-right">A receber</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {previa.itens.map((i, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{i.produto}</td>
                      <td className="px-4 py-2 text-right">{i.quantidade}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(i.custo_unitario)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(i.total_vendido)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatCurrency(i.valor_repasse)}</td>
                    </tr>
                  ))}
                  {previa.itens.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Nenhuma venda consignada deste fornecedor no período.</td></tr>}
                  <tr className="font-bold bg-gray-50 dark:bg-gray-700/50">
                    <td className="px-4 py-3" colSpan={3}>Total</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(previa.total_vendido)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(previa.total_repasse)}</td>
                  </tr>
                </tbody>
              </table>
            </div></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Saldo na loja: devolver, trocar ou manter</CardTitle></CardHeader>
            <CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 text-left">Produto</th><th className="px-4 py-2 text-right">Saldo</th><th className="px-4 py-2 text-left">Validade</th>
                  <th className="px-4 py-2 text-left">O que fazer</th><th className="px-4 py-2 text-left">Qtd</th><th className="px-4 py-2 text-left">Nova validade</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {previa.sobras.map((s) => {
                    const e = escolhas[s.lote_id]
                    if (!e) return null
                    const dias = s.validade ? diasParaVencer(s.validade) : null
                    return (
                      <tr key={s.lote_id}>
                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{s.produto}</td>
                        <td className="px-4 py-2 text-right">{s.quantidade}</td>
                        <td className="px-4 py-2">
                          {s.validade ? formatDate(s.validade) : '—'}
                          {dias !== null && dias < 0 && <span className="ml-1 text-xs font-semibold text-red-700">vencido</span>}
                        </td>
                        <td className="px-4 py-2">
                          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={e.acao} onChange={(ev) => alterar(s.lote_id, { acao: ev.target.value as AcaoSobra })}>
                            <option value="manter">Manter na loja</option>
                            <option value="devolver">Devolver</option>
                            <option value="trocar">Trocar (validade nova)</option>
                          </select>
                        </td>
                        <td className="px-4 py-2 w-24">{e.acao !== 'manter' && <Input type="number" min="0" max={s.quantidade} step="1" className="h-9" value={e.quantidade} onChange={(ev) => alterar(s.lote_id, { quantidade: ev.target.value })} />}</td>
                        <td className="px-4 py-2 w-40">{e.acao === 'trocar' && <Input type="date" min={hojeISO()} className={cn('h-9')} value={e.nova_validade} onChange={(ev) => alterar(s.lote_id, { nova_validade: ev.target.value })} />}</td>
                      </tr>
                    )
                  })}
                  {previa.sobras.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Este fornecedor não tem consignado em estoque.</td></tr>}
                </tbody>
              </table>
            </div></CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
            <div><p className="text-xs text-gray-500">Valor a pagar ao fornecedor</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(previa.total_repasse)}</p></div>
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={fechar} disabled={fechando}>{fechando ? 'Fechando...' : 'Fechar acerto e gerar recibo'}</Button>
          </div>
        </>
      )}
    </div>
  )
}

export default function NovoAcertoPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Carregando...</p>}>
      <NovoAcertoConteudo />
    </Suspense>
  )
}
