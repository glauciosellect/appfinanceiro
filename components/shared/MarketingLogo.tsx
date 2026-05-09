import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  const heights: Record<string, number> = { sm: 36, md: 44, lg: 56 }
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
