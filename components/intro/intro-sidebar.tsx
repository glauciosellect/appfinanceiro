'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, X, Users, Building2, Package, PackagePlus, Boxes,
  ShoppingCart, Wallet, TrendingDown, TrendingUp, BarChart3, Settings, FileCheck2,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  emBreve?: boolean
}

// Itens "Em breve" ainda não têm tela (próximas fases do spec do Intro).
const items: NavItem[] = [
  { href: '/intro',                label: 'Dashboard',             icon: LayoutDashboard },
  { href: '/intro/pdv',            label: 'PDV',                   icon: ShoppingCart },
  { href: '/intro/caixa',          label: 'Caixa do dia',          icon: Wallet },
  { href: '/intro/entrada',        label: 'Entrada de mercadoria', icon: PackagePlus },
  { href: '/intro/estoque',        label: 'Estoque',               icon: Boxes },
  { href: '/intro/produtos',       label: 'Produtos',              icon: Package },
  { href: '/intro/clientes',       label: 'Clientes',              icon: Users },
  { href: '/intro/fornecedores',   label: 'Fornecedores',          icon: Building2 },
  { href: '/intro/contas-pagar',   label: 'Contas a pagar',        icon: TrendingDown },
  { href: '/intro/contas-receber', label: 'Contas a receber',      icon: TrendingUp },
  { href: '/intro/acertos',         label: 'Acerto com fornecedor', icon: FileCheck2 },
  { href: '/intro/relatorios',     label: 'Relatórios',            icon: BarChart3,    emBreve: true },
  { href: '/intro/configuracoes',  label: 'Configurações',         icon: Settings },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function IntroSidebar({ open, onClose }: Props) {
  const pathname = usePathname()

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-[10px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Intro</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {items.map((item) => {
            const active = item.href === '/intro'
              ? pathname === '/intro'
              : pathname === item.href || pathname.startsWith(item.href + '/')
            const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all'

            if (item.emBreve) {
              return (
                <div key={item.href} className={cn(base, 'text-gray-400 dark:text-gray-600 cursor-not-allowed')}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                  <span className="shrink-0 text-[9px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                    Em breve
                  </span>
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  base,
                  active
                    ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500')} />
                <span className="truncate flex-1">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">SyncroMoney Intro</p>
        </div>
      </aside>
    </>
  )
}
