'use client'

import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  const heights: Record<string, number> = { sm: 36, md: 44, lg: 56 }
  const h = heights[size]
  // A logo ocupa ~30% da largura e ~25% da altura da imagem original (1456x816)
  // Centralizada em torno de 50% horizontal e 51% vertical
  const imgW = 1456
  const imgH = 816
  const logoW = imgW * 0.30   // largura real da logo na imagem
  const logoH = imgH * 0.14   // altura real da logo na imagem
  const scale = h / logoH
  const renderW = logoW * scale

  return (
    <div
      className={cn('flex items-center overflow-hidden', className)}
      style={{ width: renderW, height: h }}
    >
      <img
        src="/Logo_SyncroMoney.png"
        alt="SyncroMoney"
        style={{
          width: imgW * scale,
          height: imgH * scale,
          marginLeft: -(imgW * scale * 0.355),
          marginTop: -(imgH * scale * 0.445),
          mixBlendMode: 'multiply',
          imageRendering: 'auto',
        }}
        fetchPriority="high"
      />
    </div>
  )
}
