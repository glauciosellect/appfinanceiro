'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, X, Check, Loader2, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { parseVoiceTransactions, type ParsedTransaction } from '@/lib/voice/parse-transaction'
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

export function VoiceButton() {
  const router = useRouter()
  const { toast } = useToast()
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [parsed, setParsed] = useState<ParsedTransaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [liveText, setLiveText] = useState('')
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const unsupportedMessage =
    typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? 'No iPhone/iPad use o Safari para reconhecimento de voz.'
      : 'Use Chrome ou Edge para reconhecimento de voz.'

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
        setVoiceState('confirming')
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
    } else {
      const msg =
        parsed.length === 1
          ? 'Transação registrada por voz!'
          : `${parsed.length} transações registradas por voz!`
      toast(msg, 'success')
      setParsed([])
      setVoiceState('idle')
      router.refresh()
    }
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
      {/* Floating mic button */}
      <button
        onClick={voiceState === 'listening' ? stopListening : startListening}
        disabled={voiceState === 'processing'}
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        className={cn(
          'fixed right-6 z-50 h-16 w-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
          voiceState === 'listening'
            ? 'bg-red-500 active:bg-red-600 shadow-red-200 shadow-xl scale-110'
            : voiceState === 'processing'
            ? 'bg-blue-400 cursor-not-allowed'
            : 'bg-blue-600 active:bg-blue-700 active:scale-95'
        )}
        title={voiceState === 'listening' ? 'Parar gravação' : 'Registrar por voz'}
      >
        {voiceState === 'processing' ? (
          <Loader2 className="h-7 w-7 text-white animate-spin" />
        ) : voiceState === 'listening' ? (
          <MicOff className="h-7 w-7 text-white" />
        ) : (
          <Mic className="h-7 w-7 text-white" />
        )}
      </button>

      {/* Listening bubble */}
      {voiceState === 'listening' && (
        <div
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
          className="fixed right-6 z-50 bg-white rounded-2xl shadow-xl p-4 w-72 border border-gray-100"
        >
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
        <div
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
          className="fixed right-6 z-50 bg-red-50 border border-red-200 rounded-xl p-3 w-72 text-sm text-red-700 flex items-start gap-2"
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={voiceState === 'confirming' || voiceState === 'saving'}
        onOpenChange={() => {
          if (voiceState !== 'saving') {
            setVoiceState('idle')
            setParsed([])
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
              <TransactionCard
                key={i}
                transaction={tx}
                index={i}
                onChange={updateParsed}
                onRemove={() =>
                  setParsed((prev) => prev.filter((_, idx) => idx !== i))
                }
              />
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
