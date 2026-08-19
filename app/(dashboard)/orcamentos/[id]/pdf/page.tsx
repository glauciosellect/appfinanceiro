'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Copy, Loader2, Package, Wrench, Share2, Download } from 'lucide-react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { getPedidoComItens } from '@/lib/supabase/pedidos'
import { getFiscalConfig } from '@/lib/supabase/fiscal'
import { gerarPixCopiaECola } from '@/lib/pix/br-code'
import { gerarPdfDeElemento } from '@/lib/pdf/gerar-pdf-elemento'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { FiscalConfig, Pedido, PedidoItem } from '@/types'

export default function OrcamentoPdfPage() {
  const params = useParams()
  const pedidoId = params.id as string
  const { toast } = useToast()

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [chavePix, setChavePix] = useState('')
  const [pixQrDataUrl, setPixQrDataUrl] = useState('')
  const [pixPayload, setPixPayload] = useState('')
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [baixandoPdf, setBaixandoPdf] = useState(false)

  const fetchTudo = useCallback(async () => {
    if (!pedidoId) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [resultado, fiscal, contaComChave] = await Promise.all([
        getPedidoComItens(user.id, pedidoId),
        getFiscalConfig(user.id),
        (async () => {
          const { data } = await supabase
            .from('contas_correntes')
            .select('chave_pix')
            .eq('user_id', user.id)
            .not('chave_pix', 'is', null)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()
          return data as { chave_pix: string } | null
        })(),
      ])
      if (resultado) {
        setPedido(resultado.pedido)
        setItens(resultado.itens)

        if (fiscal?.razao_social && contaComChave?.chave_pix) {
          try {
            const payload = gerarPixCopiaECola({
              chavePix: contaComChave.chave_pix,
              nomeRecebedor: fiscal.razao_social,
              cidade: fiscal.municipio || 'SAO PAULO',
              valor: resultado.pedido.total,
            })
            setPixPayload(payload)
            setChavePix(contaComChave.chave_pix)
            const dataUrl = await QRCode.toDataURL(payload)
            setPixQrDataUrl(dataUrl)
          } catch {
            // QR Code Pix é opcional na página — falha silenciosa, seção de Pagamento simplesmente não exibe o QR.
          }
        }
      }
      setFiscalConfig(fiscal)
    } catch {
      toast('Erro ao carregar orçamento', 'error')
    } finally {
      setLoading(false)
    }
  }, [pedidoId, toast])

  useEffect(() => { fetchTudo() }, [fetchTudo])

  const linkPublico = pedido && typeof window !== 'undefined'
    ? `${window.location.origin}/orcamento/${pedido.token_publico}`
    : ''

  async function handleCopiarLink() {
    if (!linkPublico) return
    try {
      await navigator.clipboard.writeText(linkPublico)
      toast('Link copiado!', 'success')
    } catch {
      toast('Erro ao copiar link', 'error')
    }
  }

  const podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.share

  async function compartilharApenasLink() {
    if (!pedido || !linkPublico) return
    // Não passar `text` junto com `url`: no WhatsApp Android, quando os dois
    // campos vêm preenchidos, o app costuma concatenar tudo num único bloco
    // de texto solto (o link deixa de virar card/clicável automaticamente).
    // Passando só `url`, o próprio app de destino trata como link de verdade.
    await navigator.share({
      title: `Orçamento Nº ${pedido.numero_sequencial}`,
      url: linkPublico,
    })
  }

  async function handleCompartilhar() {
    if (!pedido || !linkPublico) return
    setGerandoPdf(true)
    try {
      let arquivoPdf: File | null = null
      try {
        arquivoPdf = await gerarPdfDeElemento('orcamento-doc', `orcamento-${pedido.numero_sequencial}.pdf`)
      } catch {
        // Falha na geração do PDF (html2canvas/jsPDF) — segue para o fallback de link.
        arquivoPdf = null
      }

      const podeCompartilharArquivo = arquivoPdf
        && typeof navigator.canShare === 'function'
        && navigator.canShare({ files: [arquivoPdf] })

      if (arquivoPdf && podeCompartilharArquivo) {
        try {
          await navigator.share({
            title: `Orçamento Nº ${pedido.numero_sequencial}`,
            files: [arquivoPdf],
          })
          return
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return
          // Falha ao compartilhar o arquivo — tenta o fallback de link antes de desistir.
        }
      }

      // Fallback: navegador/dispositivo sem suporte a compartilhar arquivos, ou
      // falha na geração/compartilhamento do PDF — mantém o comportamento
      // original de compartilhar apenas o link, para nunca deixar o botão morto.
      await compartilharApenasLink()
    } catch (err) {
      // AbortError: usuário cancelou o compartilhamento nativo — não é um erro real, não mostra toast.
      if (err instanceof Error && err.name === 'AbortError') return
      toast('Erro ao compartilhar', 'error')
    } finally {
      setGerandoPdf(false)
    }
  }

  async function handleBaixarPdf() {
    if (!pedido) return
    setBaixandoPdf(true)
    try {
      const arquivoPdf = await gerarPdfDeElemento('orcamento-doc', `orcamento-${pedido.numero_sequencial}.pdf`)
      const url = URL.createObjectURL(arquivoPdf)
      const link = document.createElement('a')
      link.href = url
      link.download = arquivoPdf.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      toast('Erro ao gerar PDF', 'error')
    } finally {
      setBaixandoPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Carregando...
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-xl font-bold text-gray-900">Orçamento não encontrado</p>
        <p className="text-sm text-gray-500">Não há orçamento com este identificador ou ele foi removido.</p>
        <Button asChild variant="outline">
          <Link href="/orcamentos"><ArrowLeft className="h-4 w-4 mr-2" />Voltar aos Orçamentos</Link>
        </Button>
      </div>
    )
  }

  const itensServico = itens.filter(i => i.tipo === 'servico')
  const itensProduto = itens.filter(i => i.tipo === 'produto')
  const subtotalServicos = itensServico.reduce((s, i) => s + i.subtotal, 0)
  const subtotalProdutos = itensProduto.reduce((s, i) => s + i.subtotal, 0)

  const nomeEmpresa = fiscalConfig?.razao_social || 'Empresa'
  const mostrarLogo      = fiscalConfig?.mostrar_logo ?? true
  const mostrarCnpj      = fiscalConfig?.mostrar_cnpj ?? true
  const mostrarEndereco  = fiscalConfig?.mostrar_endereco ?? true
  const mostrarTelefone  = fiscalConfig?.mostrar_telefone ?? true
  const mostrarEmail     = fiscalConfig?.mostrar_email ?? true
  const enderecoCompleto = [fiscalConfig?.logradouro, fiscalConfig?.numero, fiscalConfig?.bairro, fiscalConfig?.municipio, fiscalConfig?.uf]
    .filter(Boolean)
    .join(', ')

  const descontoAplicado = pedido.desconto_tipo === 'percentual'
    ? pedido.subtotal * (pedido.desconto_valor / 100)
    : pedido.desconto_valor

  return (
    <div className="max-w-3xl mx-auto space-y-3 print:max-w-none print:space-y-0">

      {/* Barra de ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild className="self-start">
          <Link href={`/orcamentos/${pedido.id}`}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopiarLink} className="flex-1 sm:flex-none min-w-[calc(50%-0.25rem)] sm:min-w-0">
            <Copy className="h-4 w-4 mr-1" />Copiar link
          </Button>
          {podeCompartilhar && (
            <Button variant="outline" size="sm" onClick={handleCompartilhar} disabled={gerandoPdf} className="flex-1 sm:flex-none min-w-[calc(50%-0.25rem)] sm:min-w-0">
              {gerandoPdf
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Share2 className="h-4 w-4 mr-1" />}
              Compartilhar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleBaixarPdf} disabled={baixandoPdf} className="flex-1 sm:flex-none min-w-[calc(50%-0.25rem)] sm:min-w-0">
            {baixandoPdf
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Download className="h-4 w-4 mr-1" />}
            Baixar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="flex-1 sm:flex-none min-w-[calc(50%-0.25rem)] sm:min-w-0">
            <Printer className="h-4 w-4 mr-1" />Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Documento Orçamento */}
      <div className="bg-white text-black border-2 border-gray-700 text-[11px]" id="orcamento-doc">

        {/* Cabeçalho da empresa */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] border-b-2 border-gray-700">
          <div className="p-3 sm:border-r border-b sm:border-b-0 border-gray-700 flex items-center gap-3">
            {mostrarLogo && fiscalConfig?.logo_url && (
              <div className="w-14 h-14 shrink-0 border border-gray-300 rounded overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fiscalConfig.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
              </div>
            )}
            <div className="space-y-0.5">
              <p className="font-bold text-base text-gray-900 leading-tight">{nomeEmpresa}</p>
              {mostrarCnpj && fiscalConfig?.cnpj && <p>CNPJ: <strong>{fiscalConfig.cnpj}</strong></p>}
              {mostrarEndereco && enderecoCompleto && <p>Endereço: <strong>{enderecoCompleto}</strong></p>}
              <div className="flex gap-4">
                {mostrarTelefone && fiscalConfig?.telefone && <p>Telefone: <strong>{fiscalConfig.telefone}</strong></p>}
                {mostrarEmail && fiscalConfig?.email && <p>E-mail: <strong>{fiscalConfig.email}</strong></p>}
              </div>
            </div>
          </div>
          <div className="flex sm:block divide-x sm:divide-x-0 sm:divide-y divide-gray-700">
            <div className="flex-1 px-3 py-2 text-center">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Orçamento Nº</p>
              <p className="font-bold text-gray-900 text-sm">{pedido.numero_sequencial}</p>
            </div>
            <div className="flex-1 px-3 py-2 text-center">
              <p className="text-[8px] text-gray-500 uppercase font-bold leading-none mb-0.5">Data</p>
              <p className="font-bold text-gray-900 text-sm">{formatDate(pedido.data_pedido)}</p>
            </div>
          </div>
        </div>

        {/* Título */}
        <div className="border-b-2 border-gray-700 bg-gray-50 py-2 text-center">
          <p className="font-bold text-base text-gray-900 tracking-wide">ORÇAMENTO Nº {pedido.numero_sequencial}</p>
          {pedido.titulo && <p className="text-[11px] text-gray-600 mt-0.5">{pedido.titulo}</p>}
        </div>

        {/* Cliente */}
        <div className="border-b border-gray-700">
          <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Cliente</p>
          </div>
          <div className="p-3 space-y-0.5 text-[11px]">
            <p>Nome: <strong>{pedido.clientes?.nome ?? '—'}</strong></p>
            {pedido.clientes?.telefone && <p>Telefone: <strong>{pedido.clientes.telefone}</strong></p>}
            {pedido.referencia && <p>Referência: <strong>{pedido.referencia}</strong></p>}
          </div>
        </div>

        {/* Serviços */}
        {itensServico.length > 0 && (
          <div className="border-b border-gray-700">
            <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Serviços</p>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[9px] uppercase text-gray-600">
                  <th className="text-left px-3 py-1.5 border-b border-gray-400">Descrição</th>
                  <th className="text-right px-3 py-1.5 border-b border-gray-400 w-24">Preço Unit.</th>
                  <th className="text-center px-3 py-1.5 border-b border-gray-400 w-16">Qtd.</th>
                  <th className="text-right px-3 py-1.5 border-b border-gray-400 w-24">Preço</th>
                </tr>
              </thead>
              <tbody>
                {itensServico.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1">
                        <Wrench className="h-3 w-3 text-purple-500" />
                        {item.nome_item}
                      </span>
                    </td>
                    <td className="text-right px-3 py-1.5">{formatCurrency(item.preco_unitario)}</td>
                    <td className="text-center px-3 py-1.5">{item.quantidade}</td>
                    <td className="text-right px-3 py-1.5 font-medium">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-400">
                  <td colSpan={3} className="text-right px-3 py-1.5 font-medium text-gray-600">Subtotal Serviços</td>
                  <td className="text-right px-3 py-1.5 font-bold text-gray-900">{formatCurrency(subtotalServicos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Produtos */}
        {itensProduto.length > 0 && (
          <div className="border-b border-gray-700">
            <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Produtos</p>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[9px] uppercase text-gray-600">
                  <th className="text-left px-3 py-1.5 border-b border-gray-400">Descrição</th>
                  <th className="text-right px-3 py-1.5 border-b border-gray-400 w-24">Preço Unit.</th>
                  <th className="text-center px-3 py-1.5 border-b border-gray-400 w-16">Qtd.</th>
                  <th className="text-right px-3 py-1.5 border-b border-gray-400 w-24">Preço</th>
                </tr>
              </thead>
              <tbody>
                {itensProduto.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="px-3 py-1.5">
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3 text-blue-500" />
                        {item.nome_item}
                      </span>
                    </td>
                    <td className="text-right px-3 py-1.5">{formatCurrency(item.preco_unitario)}</td>
                    <td className="text-center px-3 py-1.5">{item.quantidade}</td>
                    <td className="text-right px-3 py-1.5 font-medium">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-400">
                  <td colSpan={3} className="text-right px-3 py-1.5 font-medium text-gray-600">Subtotal Produtos</td>
                  <td className="text-right px-3 py-1.5 font-bold text-gray-900">{formatCurrency(subtotalProdutos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {itens.length === 0 && (
          <div className="border-b border-gray-700 text-center px-3 py-6 text-gray-400">Nenhum item</div>
        )}

        {/* Totais */}
        <div className="border-b-2 border-gray-700 bg-gray-50 p-3">
          <div className="ml-auto max-w-xs space-y-1 text-[11px]">
            {itensServico.length > 0 && (
              <div className="flex justify-between"><span className="text-gray-600">Serviços</span><span className="font-medium text-gray-900">{formatCurrency(subtotalServicos)}</span></div>
            )}
            {itensProduto.length > 0 && (
              <div className="flex justify-between"><span className="text-gray-600">Produtos</span><span className="font-medium text-gray-900">{formatCurrency(subtotalProdutos)}</span></div>
            )}
            <div className="flex justify-between pt-1 border-t border-gray-300"><span className="text-gray-600">Subtotal</span><span className="font-medium text-gray-900">{formatCurrency(pedido.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Desconto</span><span className="font-medium text-red-600">- {formatCurrency(descontoAplicado)}</span></div>
            <div className="flex justify-between text-sm pt-1 border-t border-gray-300"><span className="font-bold text-gray-900">Total</span><span className="font-bold text-blue-700">{formatCurrency(pedido.total)}</span></div>
          </div>
        </div>

        {/* Pagamento */}
        {(pedido.condicoes_pagamento || chavePix) && (
          <div className="border-b border-gray-700">
            <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Pagamento</p>
            </div>
            <div className="p-3 grid grid-cols-[1fr_auto] gap-4 items-start">
              <div className="space-y-2 text-[11px]">
                {chavePix && (
                  <div>
                    <p className="text-[9px] uppercase font-bold text-gray-500 mb-0.5">Meios de pagamento</p>
                    <p><strong>PIX</strong>: {chavePix}</p>
                  </div>
                )}
                {pedido.condicoes_pagamento && (
                  <div>
                    <p className="text-[9px] uppercase font-bold text-gray-500 mb-0.5">Condições de Pagamento</p>
                    <p className="whitespace-pre-wrap">{pedido.condicoes_pagamento}</p>
                  </div>
                )}
              </div>
              {pixQrDataUrl && (
                <div className="shrink-0 flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pixQrDataUrl} alt="QR Code PIX" className="w-24 h-24 border border-gray-300 rounded" />
                  <p className="text-[8px] text-gray-400">Escaneie para pagar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Garantia */}
        {pedido.garantia && (
          <div className="border-b border-gray-700">
            <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Garantia</p>
            </div>
            <div className="p-3 text-[11px] whitespace-pre-wrap">{pedido.garantia}</div>
          </div>
        )}

        {/* Informações Adicionais */}
        {pedido.informacoes_adicionais && (
          <div className="border-b border-gray-700">
            <div className="bg-gray-100 px-4 py-1 border-b border-gray-400">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 text-center">Informações Adicionais</p>
            </div>
            <div className="p-3 text-[11px] whitespace-pre-wrap">{pedido.informacoes_adicionais}</div>
          </div>
        )}

        {/* Rodapé — link público */}
        <div className="p-4 space-y-1 text-center">
          <p className="text-[10px] text-gray-500">Envie este link ao cliente para aceite online.</p>
          <p className="text-[11px] font-mono text-blue-700 break-all">{linkPublico}</p>
          <a href={linkPublico} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 underline print:hidden">
            {linkPublico}
          </a>
          <p className="text-[9px] text-gray-400 italic pt-2">Orçamento gerado no Syncromoney — syncromoney.com.br</p>
        </div>

      </div>
    </div>
  )
}
