'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-10',
  md: 'h-14',
  lg: 'h-20',
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/logo-transparente.png"
        alt="SyncroMoney"
        width={600}
        height={200}
        className={cn('w-auto object-contain', sizeClasses[size])}
        style={{ mixBlendMode: 'multiply' }}
        priority
      />
    </div>
  )
}
