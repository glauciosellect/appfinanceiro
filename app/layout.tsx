import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { InstallPrompt } from '@/components/pwa/install-prompt'

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
  title: {
    default: 'SyncroMoney — Sistema de Gestão Financeira e Emissor de Nota Fiscal',
    template: '%s | SyncroMoney',
  },
  description: 'Sistema SaaS completo de gestão financeira com emissão de nota fiscal eletrônica (NF-e e NFS-e). Controle contas, fluxo de caixa, clientes, fornecedores e emita notas fiscais em segundos.',
  keywords: ['software gestão financeira', 'emissor nota fiscal eletrônica', 'sistema financeiro empresa', 'emitir NF-e online', 'emitir NFS-e', 'controle financeiro SaaS', 'fluxo de caixa online', 'contas a pagar e receber', 'sistema financeiro pequena empresa', 'nota fiscal eletrônica', 'gestão financeira online', 'software financeiro'],
  authors: [{ name: 'SyncroMoney' }],
  creator: 'SyncroMoney',
  metadataBase: new URL('https://syncromoney.com.br'),
  verification: {
    google: '2LSNMbWoGbza9SLoOnD8dkiHk5ctw66hWyPT87TQIQQ',
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://syncromoney.com.br',
    siteName: 'SyncroMoney',
    title: 'SyncroMoney — Sistema de Gestão Financeira e Emissor de Nota Fiscal',
    description: 'Controle financeiro completo com emissão de NF-e e NFS-e. Fluxo de caixa, contas a pagar/receber e muito mais.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SyncroMoney — Gestão Financeira e Nota Fiscal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SyncroMoney — Sistema de Gestão Financeira e Emissor de Nota Fiscal',
    description: 'Controle financeiro completo com emissão de NF-e e NFS-e.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SyncroMoney',
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
          <InstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  )
}
