'use client'

import Link from 'next/link'
import { Share } from 'lucide-react'
import { Logo } from '@/components/logo'

export default function InstalarPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="flex items-center gap-3">
            <Logo size="lg" />
            <span className="text-3xl font-bold tracking-tight">
              <span className="text-gray-900">Syncro</span>
              <span className="text-blue-600">Money</span>
            </span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-center">
            <p className="text-white font-semibold text-lg">Instale no seu iPhone</p>
            <p className="text-white/70 text-sm mt-1">3 passos simples no Safari</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 bg-blue-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold">1</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">Toque em Compartilhar</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  O botão <Share className="inline h-3 w-3" /> na barra do Safari
                </p>
              </div>
              <span className="text-3xl">📤</span>
            </div>

            <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold">2</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">Role para baixo</p>
                <p className="text-xs text-gray-500">Procure "Adicionar à Tela de Início"</p>
              </div>
              <span className="text-3xl">👇</span>
            </div>

            <div className="flex items-center gap-4 bg-green-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold">3</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">Toque em "Adicionar"</p>
                <p className="text-xs text-gray-500">Pronto! O ícone fica na tela inicial</p>
              </div>
              <span className="text-3xl">✅</span>
            </div>

            <Link
              href="/login"
              className="block text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
            >
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
