'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SubscriptionGuard } from '@/components/subscription/subscription-guard'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SubscriptionGuard>
      <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
        <div className="print:hidden">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="print:hidden">
            <Header onMenuClick={() => setSidebarOpen(true)} />
          </div>
          <main className="flex-1 overflow-y-auto p-4 lg:p-6 print:overflow-visible print:p-0">
            {children}
          </main>
        </div>
      </div>
    </SubscriptionGuard>
  )
}
