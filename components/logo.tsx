import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className }: LogoProps) {
  const heights = { sm: 52, md: 72, lg: 96 }
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
