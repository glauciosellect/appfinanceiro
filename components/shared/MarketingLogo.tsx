'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-10',
  md: 'h-16',
  lg: 'h-24',
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/Syncromoney_sem fundo_branco.png"
        alt="SyncroMoney"
        width={300}
        height={100}
        className={cn('w-auto object-contain', sizeClasses[size])}
        priority
      />
    </div>
  )
}
