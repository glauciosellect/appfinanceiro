'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
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
