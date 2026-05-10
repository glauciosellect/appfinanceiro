'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-20',
  md: 'h-28',
  lg: 'h-36',
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
