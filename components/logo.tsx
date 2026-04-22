import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const sizes = {
    sm: { icon: 28, text: 'text-sm', gap: 'gap-2' },
    md: { icon: 36, text: 'text-xl', gap: 'gap-2.5' },
    lg: { icon: 48, text: 'text-2xl', gap: 'gap-3' },
  }
  const s = sizes[size]

  return (
    <div className={cn('flex items-center', s.gap, className)}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle */}
        <circle cx="24" cy="24" r="24" fill="url(#logo-grad)" />

        {/* Coin stack */}
        <ellipse cx="24" cy="30" rx="10" ry="4" fill="white" fillOpacity="0.25" />
        <ellipse cx="24" cy="27" rx="10" ry="4" fill="white" fillOpacity="0.35" />
        <ellipse cx="24" cy="24" rx="10" ry="4" fill="white" fillOpacity="0.9" />

        {/* Rising arrow */}
        <path
          d="M16 22L21 17L24 20L29 15"
          stroke="#1d4ed8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M26 15H29V18"
          stroke="#1d4ed8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <span className={cn('font-bold tracking-tight text-gray-900', s.text)}>
          Minhas <span className="text-blue-600">Finanças</span>
        </span>
      )}
    </div>
  )
}
