import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const sizes = {
    sm: { icon: 28, text: 'text-sm', gap: 'gap-2' },
    md: { icon: 36, text: 'text-xl', gap: 'gap-2.5' },
    lg: { icon: 48, text: 'text-2xl', gap: 'gap-3' },
  }
  const s = sizes[size]

  return (
    <div className={cn('flex items-center', s.gap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-96x96.png"
        alt="SyncroMoney"
        width={s.icon}
        height={s.icon}
        style={{ borderRadius: '22%' }}
      />

      {showText && (
        <span className={cn('font-bold tracking-tight text-gray-900 dark:text-white', s.text)}>
          Syncro<span className="text-green-500">Money</span>
        </span>
      )}
    </div>
  )
}
