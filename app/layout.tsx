import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/theme/theme-provider'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
}

export const metadata: Metadata = {
  title: 'Minhas Finanças',
  description: 'Controle suas finanças pessoais de forma simples e visual.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Minhas Finanças',
  },
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full`}>
      <body className="h-full">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
