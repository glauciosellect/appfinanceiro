import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  const heights = { sm: 32, md: 40, lg: 52 }
  const h = heights[size]
  const textSizes = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/Icone_SyncroMoney_sem fundo.png"
        alt="SyncroMoney"
        width={h}
        height={h}
        style={{ width: 'auto', height: h }}
        priority
      />
      <span className={cn('font-extrabold tracking-tight', textSizes[size])}>
        <span className="text-[#111827]">Syncro</span>
        <span className="text-[#2563EB]">Money</span>
      </span>
    </div>
  )
}
