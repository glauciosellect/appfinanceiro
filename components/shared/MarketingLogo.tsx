'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-8',
  md: 'h-14',
  lg: 'h-20',
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  return (
    <div className={cn('flex items-center overflow-hidden', className)}>
      <Image
        src="/Syncromoney_sem fundo_branco.png"
        alt="SyncroMoney"
        width={300}
        height={100}
        className={cn('w-auto object-contain scale-[2.2] origin-center', sizeClasses[size])}
        priority
      />
    </div>
  )
}
