'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { IntroSidebar } from '@/components/intro/intro-sidebar'
import { IntroGuard } from '@/components/intro/intro-guard'
import { Header } from '@/components/layout/header'

export default function IntroLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [email, setEmail] = useState('')
  const pathname = usePathname()
  // O PDV ocupa a tela toda, sem menu nem cabeçalho (como o PDV de supermercado)
  const modoPdv = pathname === '/intro/pdv'

  return (
    <IntroGuard onUser={setEmail}>
      {modoPdv ? (
        <div className="h-screen overflow-y-auto bg-gray-50 dark:bg-slate-950 p-4 lg:p-6">
          {children}
        </div>
      ) : (
        <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
          <div className="print:hidden">
            <IntroSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          </div>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="print:hidden">
              <Header onMenuClick={() => setSidebarOpen(true)} userEmail={email} />
            </div>
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 print:overflow-visible print:p-0">
              {children}
            </main>
          </div>
        </div>
      )}
    </IntroGuard>
  )
}
