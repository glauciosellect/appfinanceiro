import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className }: LogoProps) {
  const heights: Record<string, number> = { sm: 36, md: 48, lg: 64 }
  const h = heights[size]

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/Syncromoney_sem fundo_branco.png"
        alt="SyncroMoney"
        width={h * 3}
        height={h}
        style={{ height: h, width: 'auto', objectFit: 'contain' }}
        priority
      />
    </div>
  )
}
