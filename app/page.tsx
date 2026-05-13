import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MarketingLogo } from '@/components/shared/MarketingLogo'
import { LandingPageContent } from '@/components/marketing/landing-page'

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-0 h-16 relative">
        {/* Logo absoluta — sai do fluxo, não afeta a altura h-16 do header */}
        <div className="absolute left-5 top-1/2 -translate-y-1/2 z-10">
          <MarketingLogo />
        </div>
        {/* Espaço fixo no lugar da logo */}
        <div className="w-56 shrink-0" />
        <nav className="hidden items-center gap-7 md:flex">
          <Link href="#features" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors">Funcionalidades</Link>
          <Link href="#fiscal" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors flex items-center gap-1">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
            Fiscal Premium
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors">Preços</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-[#6B7280] hover:text-[#111827]">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button size="sm" asChild className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm px-4">
            <Link href="/register">Teste grátis — 14 dias</Link>
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto border-t border-[#F3F4F6] bg-white px-5 py-2 md:hidden">
        {[{ href: '#features', label: 'Funcionalidades' }, { href: '#fiscal', label: '⚡ Fiscal' }, { href: '#pricing', label: 'Preços' }, { href: '/login', label: 'Entrar' }].map(({ href, label }) => (
          <Link key={href} href={href} className="shrink-0 rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-medium text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors">{label}</Link>
        ))}
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[#E5E7EB] bg-[#F9FAFB]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="flex flex-col gap-3">
            <MarketingLogo size="sm" />
            <p className="max-w-xs text-xs text-[#6B7280] leading-relaxed">
              Controle financeiro completo para pequenas e médias empresas.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[
              { title: 'Produto', items: [{ label: 'Funcionalidades', href: '#features' }, { label: 'Preços', href: '#pricing' }, { label: 'Entrar', href: '/login' }] },
              { title: 'Empresa', items: [{ label: 'Sobre', href: '#' }, { label: 'Contato', href: '#' }, { label: 'Blog', href: '#' }] },
              { title: 'Legal', items: [{ label: 'Privacidade', href: '/privacidade' }, { label: 'Termos', href: '/termos' }, { label: 'Cookies', href: '/cookies' }] },
            ].map(({ title, items }) => (
              <div key={title}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#111827]">{title}</p>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item.label}><Link href={item.href} className="text-xs text-[#6B7280] hover:text-[#111827] transition-colors">{item.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-[#E5E7EB] pt-6 sm:flex-row">
          <p className="text-xs text-[#6B7280]">© {new Date().getFullYear()} SyncroMoney. Todos os direitos reservados.</p>
          <p className="text-xs text-[#6B7280]">Feito no Brasil 🇧🇷</p>
        </div>
      </div>
    </footer>
  )
}

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <LandingPageContent />
      </main>
      <Footer />
    </div>
  )
}
