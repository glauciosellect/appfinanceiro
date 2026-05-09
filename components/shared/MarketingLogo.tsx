'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  const heights = { sm: 48, md: 80, lg: 100 }
  const h = heights[size]

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/Syncromoney_sem fundo_branco.png"
        alt="SyncroMoney"
        width={600}
        height={200}
        style={{ height: h, width: 'auto', objectFit: 'contain' }}
        priority
      />
    </div>
  )
}
