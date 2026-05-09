import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// sm → footer
// md → navbar (sticky)
// lg → hero landing page
export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  const cls = {
    sm: 'h-10 sm:h-12',
    md: 'h-10 sm:h-12 md:h-14',
    lg: 'h-14 sm:h-18 md:h-24',
  }[size]

  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/Syncromoney_sem fundo_branco.png"
        alt="SyncroMoney"
        width={600}
        height={200}
        className={cn('w-auto object-contain', cls)}
        priority
      />
    </div>
  )
}
