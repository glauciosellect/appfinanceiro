'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Boxes, Building2, Clock, Package, Settings, ShoppingCart, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatCurrency } from '@/lib/utils'
import { carregarContextoSistema } from '@/lib/intro/sistema-client'
import { diasRestantesTrial, assinaturaAtiva } from '@/lib/supabase/assinatura'
import { carregarDashboard, type DashboardDados } from '@/lib/intro/relatorios'

function Cartao({ titulo, valor, sub, cor, href }: { titulo: string; valor: string; sub?: string; cor?: string; href?: string }) {
  const corpo = (
    <Card className={href ? 'hover:shadow-md transition-shadow h-full' : 'h-full'}>
      <CardContent className="py-4">
        <p className="text-xs text-gray-500">{titulo}</p>
        <p className={cn('text-xl font-bold mt-1 text-gray-900 dark:text-white', cor)}>{valor}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{corpo}</Link> : corpo
}

export default function IntroDashboardPage() {
  const [d, setD] = useState<DashboardDados | null>(null)
  const [erro, setErro] = useState('')
  const [diasTrial, setDiasTrial] = useState<number | null>(null)

  useEffect(() => {
    carregarDashboard().then(({ dados, erro: e }) => { setD(dados); setErro(e ?? '') })
    carregarContextoSistema().then((ctx) => {
      if (ctx) setDiasTrial(assinaturaAtiva(ctx.assinatura) ? null : diasRestantesTrial(ctx.user.created_at))
    })
  }, [])

  const totalConsignado = d?.consignado_a_acertar.reduce((s, c) => s + Number(c.valor), 0) ?? 0
  const maxDia = Math.max(1, ...(d?.vendas_7d.map((v) => Number(v.total)) ?? [1]))
  const semDados = d && d.mes_qtd === 0 && d.hoje_qtd === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Resumo da sua loja hoje.</p>
      </div>

      {diasTrial !== null && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 px-4 py-3">
          <Clock className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300 flex-1">
            {diasTrial > 0 ? `Você está no período grátis: restam ${diasTrial} ${diasTrial === 1 ? 'dia' : 'dias'}.` : 'Seu período grátis terminou.'}
          </p>
          <Link href="/assinar" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap">Assinar — R$ 57,90/mês</Link>
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {!d && !erro && <p className="text-sm text-gray-500">Carregando...</p>}

      {d && (
        <>
          {!d.caixa_aberto && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">O caixa está fechado. Abra o caixa para começar a vender.</p>
              <Link href="/intro/caixa" className="text-sm font-semibold text-amber-800 hover:underline whitespace-nowrap">Abrir caixa</Link>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Cartao titulo="Vendas hoje" valor={formatCurrency(Number(d.hoje_total))} sub={`${d.hoje_qtd} venda(s)`} href="/intro/pdv" />
            <Cartao titulo="Últimos 7 dias" valor={formatCurrency(Number(d.semana_total))} />
            <Cartao titulo="Vendas no mês" valor={formatCurrency(Number(d.mes_total))} sub={`${d.mes_qtd} venda(s)`} />
            <Cartao titulo="Ticket médio do mês" valor={formatCurrency(d.mes_qtd > 0 ? Number(d.mes_total) / d.mes_qtd : 0)} />
          </div>

          {semDados && (
            <Card><CardContent className="py-4">
              <p className="font-semibold text-gray-900 dark:text-white mb-3">Primeiros passos</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { href: '/intro/fornecedores', label: '1. Cadastre fornecedores', icon: Building2 },
                  { href: '/intro/produtos', label: '2. Cadastre produtos', icon: Package },
                  { href: '/intro/entrada/nova', label: '3. Registre uma entrada', icon: Boxes },
                  { href: '/intro/caixa', label: '4. Abra o caixa e venda', icon: ShoppingCart },
                ].map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                    <Icon className="h-4 w-4 text-emerald-600 shrink-0" /><span>{label}</span>
                  </Link>
                ))}
              </div>
              <Link href="/intro/configuracoes" className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:underline"><Settings className="h-4 w-4" />Preencha os dados da sua loja</Link>
            </CardContent></Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardContent className="py-4">
              <p className="font-semibold text-gray-900 dark:text-white mb-3">Vendas dos últimos 7 dias</p>
              <div className="flex items-end gap-2 h-32">
                {d.vendas_7d.map((v) => (
                  <div key={v.data} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR')}: ${formatCurrency(Number(v.total))}`}>
                    <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(2, (Number(v.total) / maxDia) * 100)}%` }} />
                    <span className="text-[10px] text-gray-500">{new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>

            <Card><CardContent className="py-4">
              <p className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Wallet className="h-4 w-4 text-gray-400" />Entradas de hoje por forma de pagamento</p>
              {d.por_forma_hoje.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma venda hoje ainda.</p>
              ) : (
                <div className="space-y-2">
                  {d.por_forma_hoje.map((f) => (
                    <div key={f.forma} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{f.forma}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(f.total))}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Cartao titulo="A pagar vencido" valor={formatCurrency(Number(d.a_pagar_vencido))} cor={Number(d.a_pagar_vencido) > 0 ? 'text-red-600' : undefined} href="/intro/contas-pagar" />
            <Cartao titulo="A pagar em 7 dias" valor={formatCurrency(Number(d.a_pagar_7d))} href="/intro/contas-pagar" />
            <Cartao titulo="A receber vencido" valor={formatCurrency(Number(d.a_receber_vencido))} cor={Number(d.a_receber_vencido) > 0 ? 'text-red-600' : undefined} href="/intro/contas-receber" />
            <Cartao titulo="A receber em 7 dias" valor={formatCurrency(Number(d.a_receber_7d))} href="/intro/contas-receber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-gray-900 dark:text-white">Consignado a acertar</p>
                <p className="font-bold text-blue-700">{formatCurrency(totalConsignado)}</p>
              </div>
              {d.consignado_a_acertar.length === 0 ? (
                <p className="text-sm text-gray-400">Nada pendente com fornecedores.</p>
              ) : (
                <div className="space-y-2">
                  {d.consignado_a_acertar.map((c) => (
                    <div key={c.fornecedor_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{c.nome}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold">{formatCurrency(Number(c.valor))}</span>
                        <Link href={`/intro/acertos/novo?fornecedor=${c.fornecedor_id}`} className="text-xs font-semibold text-emerald-700 hover:underline">Acertar</Link>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <Card><CardContent className="py-4 space-y-3">
              <p className="font-semibold text-gray-900 dark:text-white">Atenção no estoque</p>
              {d.lotes_vencidos === 0 && d.lotes_vencendo === 0 && d.estoque_baixo === 0 ? (
                <p className="text-sm text-gray-400">Tudo em ordem: sem vencidos, vencendo ou estoque baixo.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {d.lotes_vencidos > 0 && (
                    <Link href="/intro/estoque" className="flex items-center gap-2 text-red-700 hover:underline"><AlertTriangle className="h-4 w-4" />{d.lotes_vencidos} lote(s) vencido(s)</Link>
                  )}
                  {d.lotes_vencendo > 0 && (
                    <Link href="/intro/estoque" className="flex items-center gap-2 text-amber-700 hover:underline"><AlertTriangle className="h-4 w-4" />{d.lotes_vencendo} lote(s) vencem em até {d.dias_alerta} dias</Link>
                  )}
                  {d.estoque_baixo > 0 && (
                    <Link href="/intro/estoque" className="flex items-center gap-2 text-yellow-700 hover:underline"><AlertTriangle className="h-4 w-4" />{d.estoque_baixo} produto(s) com estoque baixo</Link>
                  )}
                </div>
              )}
            </CardContent></Card>
          </div>

          <Card><CardContent className="py-4">
            <p className="font-semibold text-gray-900 dark:text-white mb-3">Mais vendidos do mês</p>
            {d.mais_vendidos.length === 0 ? (
              <p className="text-sm text-gray-400">Ainda não há vendas neste mês.</p>
            ) : (
              <div className="space-y-2">
                {d.mais_vendidos.map((p, i) => (
                  <div key={p.produto} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{i + 1}. {p.produto}</span>
                    <span className="text-gray-500">{Number(p.quantidade)} un. · <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(p.total))}</span></span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </>
      )}
    </div>
  )
}
