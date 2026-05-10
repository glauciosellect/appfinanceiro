import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-32',
  md: 'h-40',
  lg: 'h-56',
}

export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <div className={cn('flex items-center', className)}>
      <Image
        src="/logo-transparente.png"
        alt="SyncroMoney"
        width={600}
        height={200}
        className={cn('w-auto object-contain logo-img', sizeClasses[size])}
        priority
      />
    </div>
  )
}
