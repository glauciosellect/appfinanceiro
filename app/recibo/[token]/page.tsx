'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { FileQuestion, Loader2, Printer } from 'lucide-react'
import { ReciboDocumento } from '@/components/intro/recibo-documento'
import { getReciboPublico, type ReciboDados } from '@/lib/intro/acertos'

// Página pública (sem login) aberta pelo fornecedor a partir do link recebido.
export default function ReciboPublicoPage() {
  const { token } = useParams<{ token: string }>()
  const [dados, setDados] = useState<ReciboDados | null>(null)
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [aceito, setAceito] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getReciboPublico(token).then((d) => { setDados(d); setLoading(false) }).catch(() => setLoading(false))
  }, [token])

  async function confirmar() {
    setErro('')
    setEnviando(true)
    try {
      const res = await fetch('/api/recibo/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome, documento }),
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error ?? 'Não foi possível confirmar.'); setEnviando(false); return }
      setDados(json as ReciboDados)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    }
    setEnviando(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }

  if (!dados) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
        <FileQuestion className="h-12 w-12 text-gray-300" />
        <p className="text-lg font-semibold text-gray-800">Documento não encontrado</p>
        <p className="text-sm text-gray-500">Confira o link com a loja que enviou.</p>
      </div>
    )
  }

  const pendente = dados.status === 'enviado'

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-3 print:bg-white print:p-0">
      <div className="max-w-2xl mx-auto space-y-4 print:max-w-none">
        <div className="flex justify-end print:hidden">
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
            <Printer className="h-4 w-4" />Salvar PDF / imprimir
          </button>
        </div>

        <ReciboDocumento dados={dados} />

        {pendente && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 print:hidden">
            <p className="font-semibold text-gray-900">Confirmar recebimento</p>
            <p className="text-sm text-gray-600">Confira os valores acima. Ao confirmar, você declara que recebeu o valor e/ou as mercadorias descritas.</p>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome completo"
              className="w-full h-11 rounded-md border border-gray-300 px-3 text-sm" autoComplete="name" />
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Seu CPF ou CNPJ" inputMode="numeric"
              className="w-full h-11 rounded-md border border-gray-300 px-3 text-sm" />
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-1" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
              Li o documento e confirmo que recebi o valor e/ou as mercadorias nele descritos.
            </label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button onClick={confirmar} disabled={enviando || !aceito || nome.trim().length < 3 || documento.replace(/\D/g, '').length < 11}
              className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-base">
              {enviando ? 'Confirmando...' : 'RECEBIDO'}
            </button>
            <p className="text-xs text-gray-400">Registramos data, hora, IP e aparelho desta confirmação como comprovante.</p>
          </div>
        )}
      </div>
    </div>
  )
}
