'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Copy, Printer, Share2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReciboDocumento } from '@/components/intro/recibo-documento'
import { createClient } from '@/lib/supabase/client'
import { cancelarAcerto, getAcerto, linkRecibo, mensagemAcerto, type ReciboDados } from '@/lib/intro/acertos'
import { compartilharTexto } from '@/lib/intro/vendas'

export default function AcertoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [acerto, setAcerto] = useState<(ReciboDados & { token_publico: string; id: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data: { user } } = await createClient().auth.getUser()
    if (!user) return
    setAcerto(await getAcerto(user.id, id))
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function compartilhar() {
    if (!acerto) return
    setMsg('')
    const r = await compartilharTexto(`Acerto nº ${acerto.numero}`, mensagemAcerto(acerto.snapshot, linkRecibo(acerto.token_publico)))
    if (r === 'copiado') setMsg('Mensagem copiada. Cole no WhatsApp.')
    if (r === 'falhou') setErro('Não foi possível compartilhar. Use "Copiar link".')
  }

  async function copiarLink() {
    if (!acerto) return
    try {
      await navigator.clipboard.writeText(linkRecibo(acerto.token_publico))
      setMsg('Link copiado.')
    } catch {
      setErro('Não foi possível copiar. Selecione o link manualmente: ' + linkRecibo(acerto.token_publico))
    }
  }

  async function cancelar() {
    if (!confirm('Cancelar este acerto? As vendas voltam a ficar pendentes e a conta a pagar é cancelada.')) return
    setErro('')
    const e = await cancelarAcerto(id)
    if (e) { setErro(e); return }
    carregar()
  }

  if (loading) return <p className="text-sm text-gray-500">Carregando...</p>
  if (!acerto) return <p className="text-sm text-gray-500">Acerto não encontrado.</p>

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/intro/acertos" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">Acerto nº {acerto.numero}</h1>
        {acerto.status !== 'cancelado' && (
          <>
            <Button size="sm" onClick={compartilhar}><Share2 className="h-4 w-4 mr-1" />Enviar ao fornecedor</Button>
            <Button size="sm" variant="outline" onClick={copiarLink}><Copy className="h-4 w-4 mr-1" />Copiar link</Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimir / PDF</Button>
        {acerto.status === 'enviado' && (
          <Button size="sm" variant="outline" className="text-red-600" onClick={cancelar}><XCircle className="h-4 w-4 mr-1" />Cancelar acerto</Button>
        )}
      </div>

      {msg && <p className="text-sm text-green-700 print:hidden">{msg}</p>}
      {erro && <p className="text-sm text-red-600 print:hidden">{erro}</p>}
      {acerto.status === 'enviado' && (
        <p className="text-xs text-gray-500 print:hidden">O fornecedor abre o link, confere e clica em RECEBIDO. Quando ele confirmar, a conta a pagar deste acerto é baixada automaticamente.</p>
      )}

      <ReciboDocumento dados={acerto} />
    </div>
  )
}
