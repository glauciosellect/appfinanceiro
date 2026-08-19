'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, X, Check, Loader2, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parseVoiceTransactions, type ParsedTransaction } from '@/lib/voice/parse-transaction'
import { registrarPagamento } from '@/lib/supabase/contas-pagar'
import { getCategoriesByType } from '@/lib/categories'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type VoiceState = 'idle' | 'listening' | 'processing' | 'confirming' | 'saving'

interface ParcelaAberta {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  fornecedor_nome: string
  status: 'aberto' | 'atrasado'
}

async function buscarParcelasAbertas(userId: string): Promise<ParcelaAberta[]> {
  const supabase = createClient()
  const { data: contas } = await supabase
    .from('contas_pagar')
    .select('id, fornecedores(nome)')
    .eq('user_id', userId)
  const contaIds = (contas ?? []).map((c: any) => c.id)
  if (!contaIds.length) return []
  const { data: parcelas } = await supabase
    .from('parcelas_pagar')
    .select('id, descricao, valor, data_vencimento, status, conta_pagar_id')
    .in('conta_pagar_id', contaIds)
    .in('status', ['aberto', 'atrasado'])
    .order('data_vencimento', { ascending: true })
  const contaMap = Object.fromEntries((contas ?? []).map((c: any) => [c.id, c]))
  return (parcelas ?? []).map((p: any) => ({
    id: p.id,
    descricao: p.descricao ?? '',
    valor: p.valor,
    data_vencimento: p.data_vencimento,
    fornecedor_nome: (contaMap[p.conta_pagar_id]?.fornecedores as any)?.nome ?? '',
    status: p.status,
  }))
}

function normalizar(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '')
}

function matchParcelas(tx: ParsedTransaction, parcelas: ParcelaAberta[]): ParcelaAberta[] {
  if (tx.type !== 'expense') return []
  const palavras = normalizar(tx.description).split(/\s+/).filter(w => w.length > 2)
  return parcelas.filter(p => {
    const alvo = normalizar(p.fornecedor_nome + ' ' + p.descricao)
    const porPalavra = palavras.some(w => alvo.includes(w))
    const porValor = Math.abs(p.valor - tx.amount) / Math.max(p.valor, tx.amount) < 0.15
    return porPalavra || porValor
  }).slice(0, 3)
}

export function VoiceButton() {
  const router = useRouter()
  const { toast } = useToast()
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [parsed, setParsed] = useState<ParsedTransaction[]>([])
  const [parcelaMatches, setParcelaMatches] = useState<ParcelaAberta[][]>([])
  const [parcelaLinks, setParcelaLinks] = useState<(string | null)[]>([])
  const [error, setError] = useState<string | null>(null)
  const [liveText, setLiveText] = useState('')
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')

  const [isSupported, setIsSupported] = useState(false)
  const [unsupportedMessage, setUnsupportedMessage] = useState('Use Chrome ou Edge para reconhecimento de voz.')

  useEffect(() => {
    const supported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    setIsSupported(supported)
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setUnsupportedMessage('No iPhone/iPad use o Safari para reconhecimento de voz.')
    }
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setVoiceState('idle')
    setLiveText('')
    finalTextRef.current = ''
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError(unsupportedMessage)
      return
    }

    setError(null)
    setLiveText('')
    finalTextRef.current = ''

    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    setVoiceState('listening')

    recognition.onresult = (event: any) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTextRef.current += event.results[i][0].transcript + ' '
        } else {
          interim += event.results[i][0].transcript
        }
      }
      setLiveText((finalTextRef.current + interim).trim())
    }

    recognition.onend = () => {
      const fullText = finalTextRef.current.trim()
      finalTextRef.current = ''

      if (!fullText) {
        setVoiceState('idle')
        return
      }

      setVoiceState('processing')
      const transactions = parseVoiceTransactions(fullText)

      if (transactions.length > 0) {
        setParsed(transactions)
        setParcelaMatches(transactions.map(() => []))
        setParcelaLinks(transactions.map(() => null))
        setVoiceState('confirming')
        createClient().auth.getUser().then(({ data }) => {
          if (!data.user) return
          buscarParcelasAbertas(data.user.id).then((parcelas) => {
            const matches = transactions.map((tx) => matchParcelas(tx, parcelas))
            setParcelaMatches(matches)
            setParcelaLinks(matches.map((m) => (m.length === 1 ? m[0].id : null)))
          })
        })
      } else {
        setError(
          'Não identifiquei transações. Dica: diga "receita, recebi 3000 de honorário" ou "despesa, paguei 340 no mercado"'
        )
        setVoiceState('idle')
      }
    }

    recognition.onerror = (event: any) => {
      const msgs: Record<string, string> = {
        'no-speech': 'Nenhuma fala detectada. Tente novamente.',
        'not-allowed': 'Permissão negada. Habilite o microfone no navegador.',
        network: 'Erro de rede. Verifique sua conexão.',
      }
      setError(msgs[event.error] ?? 'Erro ao reconhecer voz.')
      setVoiceState('idle')
    }

    recognition.start()
  }, [isSupported])

  async function handleSave() {
    setVoiceState('saving')

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast('Sessão expirada. Faça login novamente.', 'error')
      setVoiceState('confirming')
      return
    }

    const rows = parsed.map((tx) => ({ ...tx, user_id: user.id }))
    const { error: dbError } = await supabase.from('transactions').insert(rows)

    if (dbError) {
      toast('Erro ao salvar. Tente novamente.', 'error')
      setVoiceState('confirming')
      return
    }

    const baixas = parcelaLinks.filter(Boolean)
    if (baixas.length > 0) {
      await Promise.allSettled(
        parcelaLinks.map((parcelaId, i) =>
          parcelaId
            ? registrarPagamento(user.id, parcelaId, {
                valor_pago: parsed[i].amount,
                juros: 0,
                multa: 0,
                desconto: 0,
                data_pagamento: parsed[i].date,
              })
            : Promise.resolve()
        )
      )
    }

    const msg =
      parsed.length === 1
        ? `Transação registrada!${baixas.length ? ' Parcela baixada em Contas a Pagar.' : ''}`
        : `${parsed.length} transações registradas!${baixas.length ? ` ${baixas.length} parcela(s) baixada(s).` : ''}`
    toast(msg, 'success')
    setParsed([])
    setParcelaMatches([])
    setParcelaLinks([])
    setVoiceState('idle')
    router.refresh()
  }

  function updateParsed(
    index: number,
    field: keyof ParsedTransaction,
    value: string | number
  ) {
    setParsed((prev) =>
      prev.map((tx, i) => (i === index ? { ...tx, [field]: value } : tx))
    )
  }

  if (!isSupported) return null

  return (
    <>
      {/* Mic button — embutido no rodapé da sidebar (não flutua sobre o conteúdo) */}
      <div className="relative">
        <button
          onClick={voiceState === 'listening' ? stopListening : startListening}
          disabled={voiceState === 'processing'}
          className={cn(
            'h-11 w-11 rounded-full shadow-md flex items-center justify-center transition-all duration-200',
            voiceState === 'listening'
              ? 'bg-red-500 active:bg-red-600 shadow-red-200 shadow-lg scale-110'
              : voiceState === 'processing'
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 active:bg-blue-700 active:scale-95'
          )}
          title={voiceState === 'listening' ? 'Parar gravação' : 'Registrar por voz'}
        >
          {voiceState === 'processing' ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : voiceState === 'listening' ? (
            <MicOff className="h-5 w-5 text-white" />
          ) : (
            <Mic className="h-5 w-5 text-white" />
          )}
        </button>

        {/* Listening bubble */}
        {voiceState === 'listening' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-white rounded-2xl shadow-xl p-4 w-72 border border-gray-100">
            <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Ouvindo...
            </div>
            <p className="text-xs text-gray-500 mb-2">
              Diga{' '}
              <span className="font-semibold text-gray-700">&quot;receita&quot;</span> ou{' '}
              <span className="font-semibold text-gray-700">&quot;despesa&quot;</span> e
              descreva a transação.
            </p>
            {liveText && (
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 italic">
                {liveText}
              </p>
            )}
          </div>
        )}

        {/* Error bubble */}
        {error && voiceState === 'idle' && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-red-50 border border-red-200 rounded-xl p-3 w-72 text-sm text-red-700 flex items-start gap-2">
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={voiceState === 'confirming' || voiceState === 'saving'}
        onOpenChange={() => {
          if (voiceState !== 'saving') {
            setVoiceState('idle')
            setParsed([])
            setParcelaMatches([])
            setParcelaLinks([])
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-blue-600" />
              Confirmar transações
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {parsed.map((tx, i) => (
              <div key={i}>
                <TransactionCard
                  transaction={tx}
                  index={i}
                  onChange={updateParsed}
                  onRemove={() => {
                    setParsed((prev) => prev.filter((_, idx) => idx !== i))
                    setParcelaMatches((prev) => prev.filter((_, idx) => idx !== i))
                    setParcelaLinks((prev) => prev.filter((_, idx) => idx !== i))
                  }}
                />
                {parcelaMatches[i]?.length > 0 && tx.type === 'expense' && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2">
                      💡 Parcela(s) em aberto encontrada(s) — dar baixa?
                    </p>
                    <div className="space-y-1.5">
                      {parcelaMatches[i].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setParcelaLinks((prev) => {
                              const next = [...prev]
                              next[i] = next[i] === p.id ? null : p.id
                              return next
                            })
                          }
                          className={cn(
                            'w-full text-left rounded-lg px-3 py-2 text-xs border transition-colors',
                            parcelaLinks[i] === p.id
                              ? 'bg-amber-200 border-amber-400 text-amber-900 font-semibold'
                              : 'bg-white border-amber-200 text-gray-700 hover:bg-amber-100'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span>{p.fornecedor_nome || p.descricao}</span>
                            <span className={cn(
                              'ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                              p.status === 'atrasado' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                            )}>
                              {p.status === 'atrasado' ? 'Atrasado' : 'Aberto'}
                            </span>
                          </div>
                          {p.fornecedor_nome && p.descricao && (
                            <p className="text-gray-500 mt-0.5 truncate">{p.descricao}</p>
                          )}
                          <p className="text-gray-500 mt-0.5">
                            Venc: {new Date(p.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                            {' · '}R$ {p.valor.toFixed(2).replace('.', ',')}
                            {parcelaLinks[i] === p.id && ' ✓'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {parsed.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Todas as transações foram removidas.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => {
                setVoiceState('idle')
                setParsed([])
                setParcelaMatches([])
                setParcelaLinks([])
              }}
              disabled={voiceState === 'saving'}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={voiceState === 'saving' || parsed.length === 0}
              className="flex-1"
            >
              {voiceState === 'saving' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirmar{parsed.length > 1 ? ` (${parsed.length})` : ''}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface TransactionCardProps {
  transaction: ParsedTransaction
  index: number
  onChange: (index: number, field: keyof ParsedTransaction, value: string | number) => void
  onRemove: () => void
}

function TransactionCard({ transaction, index, onChange, onRemove }: TransactionCardProps) {
  const categories = getCategoriesByType(transaction.type)
  const isIncome = transaction.type === 'income'

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2',
        isIncome ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            isIncome
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          )}
        >
          {isIncome ? '💰 Receita' : '💸 Despesa'}
        </span>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Valor (R$)</label>
          <Input
            type="number"
            step="0.01"
            value={transaction.amount}
            onChange={(e) => onChange(index, 'amount', parseFloat(e.target.value) || 0)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Data</label>
          <Input
            type="date"
            value={transaction.date}
            onChange={(e) => onChange(index, 'date', e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
        <Input
          value={transaction.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
        <Select
          value={transaction.category}
          onValueChange={(v) => onChange(index, 'category', v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
