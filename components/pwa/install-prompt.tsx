'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'

type Plataforma = 'android' | 'ios' | 'outro'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [visivel, setVisivel] = useState(false)
  const [plataforma, setPlataforma] = useState<Plataforma>('outro')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [instalando, setInstalando] = useState(false)

  useEffect(() => {
    // Não mostrar se já instalado como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Não mostrar se já dispensou antes
    if (localStorage.getItem('pwa-install-dismissed')) return

    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)

    if (isIOS) setPlataforma('ios')
    else if (isAndroid) setPlataforma('android')
    else setPlataforma('outro')

    // Capturar evento nativo do Android/Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Mostrar após 2 segundos
    const timer = setTimeout(() => setVisivel(true), 2000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      clearTimeout(timer)
    }
  }, [])

  function dispensar() {
    localStorage.setItem('pwa-install-dismissed', '1')
    setVisivel(false)
  }

  async function instalarAndroid() {
    if (!deferredPrompt) return
    setInstalando(true)
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-install-dismissed', '1')
      setVisivel(false)
    }
    setInstalando(false)
    setDeferredPrompt(null)
  }

  if (!visivel) return null

  // ── Android com prompt nativo disponível ──────────────────────────
  if (plataforma === 'android' && deferredPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Icone_SyncroMoney_sem fundo.png" alt="SyncroMoney" className="h-20 mx-auto mb-3" />
            <p className="text-white/80 text-sm">Controle financeiro no seu bolso</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Instalar SyncroMoney</h2>
              <p className="text-sm text-gray-500">
                Adicione à tela inicial e acesse com um toque, sem abrir o navegador.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-green-50 rounded-2xl p-3">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <Download className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Funciona sem internet</p>
                <p className="text-xs text-green-600">Dados salvos no seu aparelho</p>
              </div>
            </div>
            <button
              onClick={instalarAndroid}
              disabled={instalando}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-4 rounded-2xl text-base transition-colors disabled:opacity-60"
            >
              {instalando ? 'Instalando...' : '📲 Instalar agora — é grátis'}
            </button>
            <button onClick={dispensar} className="w-full text-gray-400 text-sm py-1 hover:text-gray-600 transition-colors">
              Agora não
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── iOS — instrução visual simples ────────────────────────────────
  if (plataforma === 'ios') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/60 backdrop-blur-sm">
        {/* Cartão de instrução */}
        <div className="w-full max-w-sm mx-4 mb-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Icone_SyncroMoney_sem fundo.png" alt="SyncroMoney" className="h-14" />
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Instalar SyncroMoney</h2>
              <p className="text-white/70 text-xs">3 passos simples no Safari</p>
            </div>
            <button onClick={dispensar} className="ml-auto p-1 text-white/60 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {/* Passo 1 */}
            <div className="flex items-center gap-4 bg-blue-50 rounded-2xl p-3">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">1</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Toque em Compartilhar</p>
                <p className="text-xs text-gray-500">O botão <Share className="inline h-3 w-3" /> na barra inferior do Safari</p>
              </div>
              <div className="text-3xl">📤</div>
            </div>

            {/* Passo 2 */}
            <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-3">
              <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">2</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Role para baixo</p>
                <p className="text-xs text-gray-500">Procure "Adicionar à Tela de Início"</p>
              </div>
              <div className="text-3xl">👇</div>
            </div>

            {/* Passo 3 */}
            <div className="flex items-center gap-4 bg-green-50 rounded-2xl p-3">
              <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">3</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">Toque em "Adicionar"</p>
                <p className="text-xs text-gray-500">O ícone aparece na tela inicial</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>

            <button onClick={dispensar} className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors text-center">
              Já instalei / Agora não
            </button>
          </div>
        </div>

        {/* Seta apontando para o botão de compartilhar (iOS) */}
        <div className="flex flex-col items-center mb-6 animate-bounce">
          <p className="text-white font-bold text-sm bg-blue-600 px-4 py-2 rounded-full shadow-lg mb-2">
            👆 Toque aqui em Compartilhar
          </p>
          <svg className="h-8 w-8 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 22l8-10H4l8 10z" />
          </svg>
        </div>
      </div>
    )
  }

  // Desktop ou outro — não mostra nada
  return null
}
