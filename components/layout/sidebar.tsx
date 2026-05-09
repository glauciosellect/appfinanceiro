'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  List,
  X,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Landmark,
  CreditCard,
  Users,
  Building2,
  BarChart3,
  Settings,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  color?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'PRINCIPAL',
    items: [
      { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
      { href: '/fluxo-caixa',  label: 'Fluxo de Caixa', icon: ArrowLeftRight },
      { href: '/transactions', label: 'Transações',   icon: List },
    ],
  },
  {
    title: 'FINANCEIRO',
    items: [
      { href: '/contas-receber', label: 'Contas a Receber', icon: TrendingUp,   color: 'green' },
      { href: '/contas-pagar',   label: 'Contas a Pagar',   icon: TrendingDown, color: 'red'   },
    ],
  },
  {
    title: 'CADASTROS',
    items: [
      { href: '/contas-correntes', label: 'Contas Correntes', icon: Landmark  },
      { href: '/cartoes',          label: 'Cartões',          icon: CreditCard },
      { href: '/clientes',         label: 'Clientes',         icon: Users      },
      { href: '/fornecedores',     label: 'Fornecedores',     icon: Building2  },
    ],
  },
  {
    title: 'ANÁLISES',
    items: [
      { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
]

const iconColorMap: Record<string, string> = {
  green: 'text-green-500',
  red:   'text-red-500',
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center">
            <Logo size="sm" />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-gray-400 dark:text-gray-600 uppercase">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + '/')
                  const iconColor = item.color
                    ? (active ? iconColorMap[item.color] : iconColorMap[item.color] + '/70')
                    : active
                      ? 'text-blue-500'
                      : 'text-gray-400 dark:text-gray-500'

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                        active
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 shrink-0', iconColor)} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">SyncroMoney © 2025</p>
        </div>
      </aside>
    </>
  )
}
