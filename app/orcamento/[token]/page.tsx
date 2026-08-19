'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, Package, Wrench, FileQuestion } from 'lucide-react'
import { getOrcamentoPublico, aceitarOrcamentoPublico } from '@/lib/supabase/pedidos'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { FiscalConfig, Pedido, PedidoItem } from '@/types'

export default function OrcamentoPublicoPage() {
  const params = useParams()
  const token = params.token as string

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | Record<string, never> | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [aceitando, setAceitando] = useState(false)

  const fetchTudo = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const resultado = await getOrcamentoPublico(token)
      if (!resultado) {
        setNotFound(true)
      } else {
        setPedido(resultado.pedido)
        setItens(resultado.itens)
        setFiscalConfig(resultado.fiscalConfig)
      }
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  async function handleAceitar() {
    if (!token) return
    setAceitando(true)
    try {
      await aceitarOrcamentoPublico(token)
      await fetchTudo()
    } catch {
      setAceitando(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    )
  }

  if (notFound || !pedido) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-3">
          <FileQuestion className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="text-lg font-bold text-gray-900">Orçamento não encontrado ou expirado.</p>
          <p className="text-sm text-gray-500">Verifique o link recebido ou entre em contato com a empresa.</p>
        </div>
      </div>
    )
  }

  const fc = fiscalConfig ?? {}
  const nomeEmpresa      = (fc as FiscalConfig).razao_social || 'Empresa'
  const mostrarLogo      = (fc as FiscalConfig).mostrar_logo ?? true
  const mostrarCnpj      = (fc as FiscalConfig).mostrar_cnpj ?? true
  const mostrarEndereco  = (fc as FiscalConfig).mostrar_endereco ?? true
  const mostrarTelefone  = (fc as FiscalConfig).mostrar_telefone ?? true
  const mostrarEmail     = (fc as FiscalConfig).mostrar_email ?? true
  const enderecoCompleto = [(fc as FiscalConfig).logradouro, (fc as FiscalConfig).numero, (fc as FiscalConfig).bairro, (fc as FiscalConfig).municipio, (fc as FiscalConfig).uf]
    .filter(Boolean)
    .join(', ')

  const descontoAplicado = pedido.desconto_tipo === 'percentual'
    ? pedido.subtotal * (pedido.desconto_valor / 100)
    : pedido.desconto_valor

  const itensServico = itens.filter(i => i.tipo === 'servico')
  const itensProduto = itens.filter(i => i.tipo === 'produto')
  const subtotalServicos = itensServico.reduce((s, i) => s + i.subtotal, 0)
  const subtotalProdutos = itensProduto.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {/* Cabeçalho da empresa */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            {mostrarLogo && (fc as FiscalConfig).logo_url && (
              <div className="w-14 h-14 shrink-0 border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={(fc as FiscalConfig).logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
              </div>
            )}
            <div>
              <p className="font-bold text-lg text-gray-900">{nomeEmpresa}</p>
              <div className="text-xs text-gray-500 space-y-0.5">
                {mostrarCnpj && (fc as FiscalConfig).cnpj && <p>CNPJ: {(fc as FiscalConfig).cnpj}</p>}
                {mostrarEndereco && enderecoCompleto && <p>{enderecoCompleto}</p>}
                <div className="flex gap-3">
                  {mostrarTelefone && (fc as FiscalConfig).telefone && <p>{(fc as FiscalConfig).telefone}</p>}
                  {mostrarEmail && (fc as FiscalConfig).email && <p>{(fc as FiscalConfig).email}</p>}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-900">Orçamento Nº {pedido.numero_sequencial}</h1>
            <p className="text-sm text-gray-500">Emitido em {formatDate(pedido.data_pedido)}</p>
          </div>

          {/* Cliente */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-0.5">
            <p className="font-medium text-gray-900">Cliente: {pedido.clientes?.nome ?? '—'}</p>
            {pedido.clientes?.telefone && <p className="text-gray-500">Telefone: {pedido.clientes.telefone}</p>}
            {pedido.referencia && <p className="text-gray-500">Referência: {pedido.referencia}</p>}
          </div>

          {/* Serviços */}
          {itensServico.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Serviços</p>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2 w-16">Qtd</th>
                      <th className="text-right py-2">Preço Unit.</th>
                      <th className="text-right py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {itensServico.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Wrench className="h-3.5 w-3.5 text-purple-500" />
                            {item.nome_item}
                          </span>
                        </td>
                        <td className="text-center py-2">{item.quantidade}</td>
                        <td className="text-right py-2">{formatCurrency(item.preco_unitario)}</td>
                        <td className="text-right py-2 font-medium">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100">
                      <td colSpan={3} className="text-right py-2 text-gray-500 font-medium">Subtotal Serviços</td>
                      <td className="text-right py-2 font-semibold text-gray-900">{formatCurrency(subtotalServicos)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sm:hidden space-y-2">
                {itensServico.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Wrench className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                      <span className="font-medium text-gray-900 break-words">{item.nome_item}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                      <div><p className="uppercase tracking-wide">Qtd</p><p className="text-sm text-gray-900">{item.quantidade}</p></div>
                      <div><p className="uppercase tracking-wide">Preço Unit.</p><p className="text-sm text-gray-900">{formatCurrency(item.preco_unitario)}</p></div>
                      <div><p className="uppercase tracking-wide">Subtotal</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p></div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-1 pt-1 text-sm">
                  <span className="font-medium text-gray-500">Subtotal Serviços</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(subtotalServicos)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Produtos */}
          {itensProduto.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Produtos</p>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2 w-16">Qtd</th>
                      <th className="text-right py-2">Preço Unit.</th>
                      <th className="text-right py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {itensProduto.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-blue-500" />
                            {item.nome_item}
                          </span>
                        </td>
                        <td className="text-center py-2">{item.quantidade}</td>
                        <td className="text-right py-2">{formatCurrency(item.preco_unitario)}</td>
                        <td className="text-right py-2 font-medium">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100">
                      <td colSpan={3} className="text-right py-2 text-gray-500 font-medium">Subtotal Produtos</td>
                      <td className="text-right py-2 font-semibold text-gray-900">{formatCurrency(subtotalProdutos)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sm:hidden space-y-2">
                {itensProduto.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Package className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <span className="font-medium text-gray-900 break-words">{item.nome_item}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                      <div><p className="uppercase tracking-wide">Qtd</p><p className="text-sm text-gray-900">{item.quantidade}</p></div>
                      <div><p className="uppercase tracking-wide">Preço Unit.</p><p className="text-sm text-gray-900">{formatCurrency(item.preco_unitario)}</p></div>
                      <div><p className="uppercase tracking-wide">Subtotal</p><p className="text-sm font-semibold text-gray-900">{formatCurrency(item.subtotal)}</p></div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between px-1 pt-1 text-sm">
                  <span className="font-medium text-gray-500">Subtotal Produtos</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(subtotalProdutos)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Totais */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium text-gray-900">{formatCurrency(pedido.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Desconto</span><span className="font-medium text-red-600">- {formatCurrency(descontoAplicado)}</span></div>
            <div className="flex justify-between text-base pt-2 border-t border-gray-200"><span className="font-semibold text-gray-900">Total</span><span className="font-bold text-blue-600">{formatCurrency(pedido.total)}</span></div>
          </div>

          {/* Título, Condições, Garantia e Informações */}
          {(pedido.condicoes_pagamento || pedido.garantia || pedido.informacoes_adicionais) && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              {pedido.condicoes_pagamento && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Condições de Pagamento</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{pedido.condicoes_pagamento}</p>
                </div>
              )}
              {pedido.garantia && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Garantia</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{pedido.garantia}</p>
                </div>
              )}
              {pedido.informacoes_adicionais && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Informações Adicionais</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{pedido.informacoes_adicionais}</p>
                </div>
              )}
            </div>
          )}

          {/* Aceite */}
          {pedido.aceito_em ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">
                ✓ Orçamento aceito em {formatDate(pedido.aceito_em)}
              </p>
            </div>
          ) : (
            <button
              onClick={handleAceitar}
              disabled={aceitando}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {aceitando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Aceitar Orçamento
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
