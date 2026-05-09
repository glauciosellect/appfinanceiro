import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// sm → sidebar, login/register mobile
// md → login/register desktop, assinar
// lg → landing hero, telas de boas-vindas
export function Logo({ size = 'md', className }: LogoProps) {
  const cls = {
    sm: 'h-10 sm:h-12',
    md: 'h-14 sm:h-16 md:h-20',
    lg: 'h-16 sm:h-20 md:h-24',
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
