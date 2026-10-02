import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  // Telas de fundo escuro fixo: a logo escura some (o efeito de mistura é feito para fundo claro).
  // Aqui ela vai sobre uma etiqueta branca, com as cores da marca intactas.
  sobreEscuro?: boolean
}

const sizeClasses = {
  sm: 'h-32',
  md: 'h-40',
  lg: 'h-56',
}

const sizeClassesSobreEscuro = {
  sm: 'h-14',
  md: 'h-20',
  lg: 'h-24',
}

export function Logo({ size = 'md', className, sobreEscuro = false }: LogoProps) {
  if (sobreEscuro) {
    return (
      <div className={cn('flex items-center', className)}>
        <div className="rounded-2xl px-6 py-2 shadow-lg shadow-black/30" style={{ backgroundColor: '#ffffff' }}>
          <Image
            src="/logo-transparente.png"
            alt="SyncroMoney"
            width={600}
            height={200}
            className={cn('w-auto object-contain', sizeClassesSobreEscuro[size])}
            style={{ mixBlendMode: 'normal', filter: 'none' }}
            priority
          />
        </div>
      </div>
    )
  }

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
