'use client'

import * as React from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface ToastData {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  toasts: ToastData[]
  toast: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([])

  const toast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 rounded-xl p-4 shadow-lg border animate-in slide-in-from-right-full',
              t.type === 'success' && 'bg-green-50 border-green-200 text-green-800',
              t.type === 'error' && 'bg-red-50 border-red-200 text-red-800',
              t.type === 'info' && 'bg-blue-50 border-blue-200 text-blue-800'
            )}
          >
            {t.type === 'success' && <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />}
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="flex-shrink-0 hover:opacity-70 transition-opacity">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
