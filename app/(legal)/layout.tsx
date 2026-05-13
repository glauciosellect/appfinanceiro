import Link from 'next/link'
import { MarketingLogo } from '@/components/shared/MarketingLogo'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex h-20 max-w-3xl items-center justify-between px-5">
          <MarketingLogo />
          <Link href="/" className="text-sm text-[#6B7280] hover:text-[#111827] transition-colors">
            ← Voltar ao início
          </Link>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-[#E5E7EB] bg-[#F9FAFB]">
        <div className="mx-auto max-w-3xl px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[#6B7280]">© {new Date().getFullYear()} SyncroMoney. Todos os direitos reservados.</p>
          <div className="flex gap-4 text-xs text-[#6B7280]">
            <Link href="/privacidade" className="hover:text-[#111827] transition-colors">Privacidade</Link>
            <Link href="/termos" className="hover:text-[#111827] transition-colors">Termos</Link>
            <Link href="/cookies" className="hover:text-[#111827] transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
