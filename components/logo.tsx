import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className }: LogoProps) {
  const heights = { sm: 32, md: 44, lg: 56 }
  const h = heights[size]

  return (
    <div className={cn('flex items-center', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Icone_SyncroMoney_sem fundo.png"
        alt="SyncroMoney"
        height={h}
        style={{ height: h, width: 'auto', objectFit: 'contain' }}
      />
    </div>
  )
}
