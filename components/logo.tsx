import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-16',
  md: 'h-20',
  lg: 'h-28',
}

export function Logo({ size = 'md', className }: LogoProps) {
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
