'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Wallet, ArrowDownCircle, ArrowUpCircle, LogOut, History, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getSessaoAbertaHoje,
  abrirCaixa,
  registrarMovimentacaoCaixa,
  calcularSaldoEsperado,
  fecharCaixa,
  getRelatorioFechamento,
  getHistoricoSessoes,
  getVendasDaSessao,
} from '@/lib/supabase/caixa'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { getContasCorrentes } from '@/lib/supabase/contas-correntes'
import type { CaixaSessao, Venda, ContaCorrente } from '@/types'

type RelatorioFechamento = Awaited<ReturnType<typeof getRelatorioFechamento>>

export default function CaixaPage() {
  const [userId, setUserId] = useState('')
  const { toast: _toast } = useToast()

  const [sessaoCaixa, setSessaoCaixa] = useState<CaixaSessao | null>(null)
  const [carregandoSessao, setCarregandoSessao] = useState(true)
  const [saldoAoVivo, setSaldoAoVivo] = useState(0)

  const [operadorAbertura, setOperadorAbertura] = useState('')
  const [trocoAbertura, setTrocoAbertura] = useState('')
  const [abrindoCaixa, setAbrindoCaixa] = useState(false)
  const [contasCorrentes, setContasCorrentes] = useState<ContaCorrente[]>([])
  const [contaCorrenteAbertura, setContaCorrenteAbertura] = useState('')

  const [dialogSangria, setDialogSangria] = useState(false)
  const [dialogSuprimento, setDialogSuprimento] = useState(false)
  const [valorMovimentacao, setValorMovimentacao] = useState('')
  const [motivoMovimentacao, setMotivoMovimentacao] = useState('')
  const [registrandoMovimentacao, setRegistrandoMovimentacao] = useState(false)

  const [dialogFechamento, setDialogFechamento] = useState(false)
  const [saldoEsperadoPreview, setSaldoEsperadoPreview] = useState(0)
  const [valorContado, setValorContado] = useState('')
  const [fechando, setFechando] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioFechamento | null>(null)

  const [historico, setHistorico] = useState<CaixaSessao[]>([])
  const [vendasSessao, setVendasSessao] = useState<(Venda & { itensCount: number })[]>([])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    getContasCorrentes(userId).then(setContasCorrentes).catch(() => {})
  }, [userId])

  const carregarSessao = useCallback(() => {
    if (!userId) return
    setCarregandoSessao(true)
    getSessaoAbertaHoje(userId)
      .then(setSessaoCaixa)
      .catch(() => setSessaoCaixa(null))
      .finally(() => setCarregandoSessao(false))
  }, [userId])

  const carregarHistorico = useCallback(() => {
    if (!userId) return
    getHistoricoSessoes(userId).then(setHistorico).catch(() => {})
  }, [userId])

  const carregarVendasSessao = useCallback(() => {
    if (!userId || !sessaoCaixa) { setVendasSessao([]); return }
    getVendasDaSessao(userId, sessaoCaixa.id).then(setVendasSessao).catch(() => {})
  }, [userId, sessaoCaixa])

  useEffect(() => { carregarSessao() }, [carregarSessao])
  useEffect(() => { carregarHistorico() }, [carregarHistorico])
  useEffect(() => { carregarVendasSessao() }, [carregarVendasSessao])

  useEffect(() => {
    if (!userId || !sessaoCaixa) return
    calcularSaldoEsperado(userId, sessaoCaixa.id).then(setSaldoAoVivo).catch(() => {})
  }, [userId, sessaoCaixa])

  async function handleAbrirCaixa() {
    const troco = Number(trocoAbertura)
    if (!operadorAbertura.trim() || trocoAbertura === '' || Number.isNaN(troco) || troco < 0) return
    setAbrindoCaixa(true)
    try {
      const sessao = await abrirCaixa(userId, operadorAbertura.trim(), troco, contaCorrenteAbertura || undefined)
      setSessaoCaixa(sessao)
      setOperadorAbertura('')
      setTrocoAbertura('')
      setContaCorrenteAbertura('')
      _toast('Caixa aberto!', 'success')
    } catch {
      _toast('Erro ao abrir caixa', 'error')
    } finally {
      setAbrindoCaixa(false)
    }
  }

  function abrirDialogMovimentacao(tipo: 'sangria' | 'suprimento') {
    setValorMovimentacao('')
    setMotivoMovimentacao('')
    if (tipo === 'sangria') setDialogSangria(true)
    else setDialogSuprimento(true)
  }

  async function handleRegistrarMovimentacao(tipo: 'sangria' | 'suprimento') {
    const valor = Number(valorMovimentacao)
    if (!sessaoCaixa || !valor || valor <= 0 || !motivoMovimentacao.trim()) return
    setRegistrandoMovimentacao(true)
    try {
      await registrarMovimentacaoCaixa(userId, sessaoCaixa.id, tipo, valor, motivoMovimentacao.trim())
      _toast(tipo === 'sangria' ? 'Sangria registrada!' : 'Suprimento registrado!', 'success')
      setDialogSangria(false)
      setDialogSuprimento(false)
      setValorMovimentacao('')
      setMotivoMovimentacao('')
      const saldo = await calcularSaldoEsperado(userId, sessaoCaixa.id)
      setSaldoAoVivo(saldo)
    } catch {
      _toast('Erro ao registrar movimentação', 'error')
    } finally {
      setRegistrandoMovimentacao(false)
    }
  }

  async function abrirDialogFechamento() {
    if (!sessaoCaixa) return
    setValorContado('')
    setRelatorio(null)
    setDialogFechamento(true)
    try {
      const saldo = await calcularSaldoEsperado(userId, sessaoCaixa.id)
      setSaldoEsperadoPreview(saldo)
    } catch {
      _toast('Erro ao calcular saldo esperado', 'error')
    }
  }

  async function handleFecharCaixa() {
    const contado = Number(valorContado)
    if (!sessaoCaixa || valorContado === '' || Number.isNaN(contado)) return
    setFechando(true)
    try {
      await fecharCaixa(userId, sessaoCaixa.id, contado)
      const rel = await getRelatorioFechamento(userId, sessaoCaixa.id)
      setRelatorio(rel)
    } catch {
      _toast('Erro ao fechar caixa', 'error')
    } finally {
      setFechando(false)
    }
  }

  function handleFecharRelatorio() {
    setDialogFechamento(false)
    setRelatorio(null)
    setSessaoCaixa(null)
    carregarHistorico()
  }

  const diferencaRelatorio = relatorio ? (relatorio.sessao.diferenca ?? 0) : 0

  if (carregandoSessao) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center text-gray-400">
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Caixa</h1>
        <p className="text-sm text-gray-500">Controle da sessão de caixa do PDV</p>
      </div>

      {!sessaoCaixa ? (
        <Card>
          <CardHeader><CardTitle>Abertura de Caixa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Operador</Label>
              <Input
                placeholder="Nome do operador"
                value={operadorAbertura}
                onChange={(e) => setOperadorAbertura(e.target.value)}
              />
            </div>
            <div>
              <Label>Troco Inicial (R$)</Label>
              <Input
                type="number" step="0.01" min="0"
                placeholder="0,00"
                value={trocoAbertura}
                onChange={(e) => setTrocoAbertura(e.target.value)}
              />
            </div>
            <div>
              <Label>Conta para recebimentos em dinheiro (opcional)</Label>
              <Select value={contaCorrenteAbertura} onValueChange={setContaCorrenteAbertura}>
                <SelectTrigger><SelectValue placeholder="Nenhuma conta vinculada" /></SelectTrigger>
                <SelectContent>
                  {contasCorrentes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_apelido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleAbrirCaixa}
              disabled={!operadorAbertura.trim() || trocoAbertura === '' || abrindoCaixa}
            >
              Abrir Caixa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              Caixa Aberto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <span className="font-medium text-gray-900">{sessaoCaixa.operador}</span>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-500">
                  Aberto às {new Date(sessaoCaixa.aberto_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="bg-blue-50 rounded-xl px-3 py-1.5">
                <span className="text-blue-700 font-semibold">Saldo esperado: {formatCurrency(saldoAoVivo)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => abrirDialogMovimentacao('sangria')}>
                <ArrowDownCircle className="h-4 w-4 mr-1.5 text-red-500" />
                Sangria
              </Button>
              <Button variant="outline" size="sm" onClick={() => abrirDialogMovimentacao('suprimento')}>
                <ArrowUpCircle className="h-4 w-4 mr-1.5 text-green-500" />
                Suprimento
              </Button>
              <Button variant="outline" size="sm" onClick={abrirDialogFechamento}>
                <LogOut className="h-4 w-4 mr-1.5 text-gray-500" />
                Fechar Caixa
              </Button>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Vendas desta sessão ({vendasSessao.length})
              </p>
              {vendasSessao.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Nenhuma venda registrada ainda nesta sessão</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                        <th className="text-left px-2 py-2">Número</th>
                        <th className="text-left px-2 py-2">Hora</th>
                        <th className="text-left px-2 py-2">Cliente</th>
                        <th className="text-center px-2 py-2">Itens</th>
                        <th className="text-right px-2 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {vendasSessao.map((v) => (
                        <tr key={v.id}>
                          <td className="px-2 py-2 font-medium text-gray-900">{v.numero_sequencial}</td>
                          <td className="px-2 py-2 text-gray-500">
                            {new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-2 py-2 text-gray-500">{v.clientes?.nome ?? '—'}</td>
                          <td className="px-2 py-2 text-center text-gray-500">{v.itensCount}</td>
                          <td className="px-2 py-2 text-right font-medium text-gray-900">{formatCurrency(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-500" />
            Histórico de Sessões
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historico.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">Nenhuma sessão fechada ainda</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2">Data</th>
                    <th className="text-left px-2 py-2">Operador</th>
                    <th className="text-right px-2 py-2">Esperado</th>
                    <th className="text-right px-2 py-2">Contado</th>
                    <th className="text-right px-4 py-2">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historico.map((s) => {
                    const dif = s.diferenca ?? 0
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-2 text-gray-500">
                          {s.fechado_em ? new Date(s.fechado_em).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="px-2 py-2 font-medium text-gray-900">{s.operador}</td>
                        <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(s.saldo_esperado ?? 0)}</td>
                        <td className="px-2 py-2 text-right text-gray-700">{formatCurrency(s.saldo_contado ?? 0)}</td>
                        <td className={
                          'px-4 py-2 text-right font-medium ' +
                          (dif > 0 ? 'text-green-600' : dif < 0 ? 'text-red-600' : 'text-gray-600')
                        }>
                          {formatCurrency(dif)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sangria */}
      <Dialog open={dialogSangria} onOpenChange={setDialogSangria}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Sangria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorMovimentacao} onChange={(e) => setValorMovimentacao(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={motivoMovimentacao} onChange={(e) => setMotivoMovimentacao(e.target.value)} placeholder="Ex: retirada para depósito" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogSangria(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => handleRegistrarMovimentacao('sangria')}
                disabled={registrandoMovimentacao || !Number(valorMovimentacao) || !motivoMovimentacao.trim()}
                className="flex-1"
              >
                Confirmar Sangria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suprimento */}
      <Dialog open={dialogSuprimento} onOpenChange={setDialogSuprimento}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Suprimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorMovimentacao} onChange={(e) => setValorMovimentacao(e.target.value)} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Input value={motivoMovimentacao} onChange={(e) => setMotivoMovimentacao(e.target.value)} placeholder="Ex: reforço de troco" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogSuprimento(false)} className="flex-1">Cancelar</Button>
              <Button
                onClick={() => handleRegistrarMovimentacao('suprimento')}
                disabled={registrandoMovimentacao || !Number(valorMovimentacao) || !motivoMovimentacao.trim()}
                className="flex-1"
              >
                Confirmar Suprimento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fechamento de caixa */}
      <Dialog open={dialogFechamento} onOpenChange={(open) => { if (!open && !relatorio) setDialogFechamento(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Fechamento de Caixa</DialogTitle></DialogHeader>

          {!relatorio ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm flex justify-between">
                <span className="text-gray-500">Saldo esperado</span>
                <span className="font-bold text-gray-900">{formatCurrency(saldoEsperadoPreview)}</span>
              </div>
              <div>
                <Label>Valor Contado (R$)</Label>
                <Input type="number" step="0.01" min="0" value={valorContado} onChange={(e) => setValorContado(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogFechamento(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleFecharCaixa} disabled={fechando || valorContado === ''} className="flex-1">Fechar Caixa</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-500">Esperado</p>
                  <p className="font-bold text-gray-900">{formatCurrency(relatorio.saldoEsperado)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-500">Contado</p>
                  <p className="font-bold text-gray-900">{formatCurrency(relatorio.sessao.saldo_contado ?? 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-500">Diferença</p>
                  <p className={
                    'font-bold ' +
                    (diferencaRelatorio > 0 ? 'text-green-600' : diferencaRelatorio < 0 ? 'text-red-600' : 'text-gray-600')
                  }>
                    {formatCurrency(diferencaRelatorio)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Vendas por forma de pagamento</p>
                {relatorio.vendasPorFormaPagamento.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma venda concluída nesta sessão</p>
                ) : (
                  <div className="space-y-1">
                    {relatorio.vendasPorFormaPagamento.map((v) => (
                      <div key={v.forma_pagamento_nome} className="flex justify-between text-sm">
                        <span className="text-gray-600">{v.forma_pagamento_nome} ({v.quantidade})</span>
                        <span className="font-medium text-gray-900">{formatCurrency(v.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total sangrias</span>
                <span className="font-medium text-red-600">{formatCurrency(relatorio.totalSangrias)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total suprimentos</span>
                <span className="font-medium text-green-600">{formatCurrency(relatorio.totalSuprimentos)}</span>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" asChild className="flex-1">
                  <Link href={`/caixa/${relatorio.sessao.id}/fechamento`} target="_blank">
                    <Printer className="h-4 w-4 mr-1.5" />Imprimir Relatório
                  </Link>
                </Button>
                <Button onClick={handleFecharRelatorio} className="flex-1">Fechar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
