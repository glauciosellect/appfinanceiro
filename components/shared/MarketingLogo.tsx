'use client'

import { cn } from '@/lib/utils'

interface MarketingLogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm:  { height: 36,  iconSize: 28, fontSize: 18, tagSize: 5.5, gap: 7 },
  md:  { height: 48,  iconSize: 38, fontSize: 24, tagSize: 7,   gap: 9 },
  lg:  { height: 64,  iconSize: 50, fontSize: 32, tagSize: 9,   gap: 12 },
}

export function MarketingLogo({ size = 'md', className }: MarketingLogoProps) {
  const s = sizeMap[size]
  const iw = s.iconSize        // icon width = height (square)
  const totalW = iw + s.gap + s.fontSize * 7.2  // rough text width estimate

  return (
    <div className={cn('flex items-center', className)}>
      <svg
        width={totalW}
        height={s.height}
        viewBox={`0 0 ${totalW} ${s.height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SyncroMoney"
      >
        <defs>
          {/* Blue gradient for arrow top */}
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#008CFF" />
            <stop offset="100%" stopColor="#001F5C" />
          </linearGradient>
          {/* Green gradient for arrow bottom */}
          <linearGradient id="greenGrad" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#00A651" />
            <stop offset="100%" stopColor="#4DFF5A" />
          </linearGradient>
          {/* Dark blue gradient for "Syncro" text */}
          <linearGradient id="textBlue" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#008CFF" />
            <stop offset="100%" stopColor="#001F5C" />
          </linearGradient>
          {/* Green gradient for "Money" text */}
          <linearGradient id="textGreen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4DFF5A" />
            <stop offset="100%" stopColor="#00A651" />
          </linearGradient>
          {/* Bar chart gradient */}
          <linearGradient id="barGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#001F5C" />
            <stop offset="100%" stopColor="#008CFF" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* ── ICON ── S-shape with two arrows */}
        {(() => {
          const cx = iw / 2
          const cy = s.height / 2
          const r = iw * 0.42        // outer radius of S curve
          const sw = iw * 0.13       // stroke width
          const arrowSize = iw * 0.12

          // Top arc: curves from left-bottom to right-top (blue, arrow pointing right)
          const topArcPath = `
            M ${cx - r * 0.55} ${cy + r * 0.1}
            C ${cx - r * 0.55} ${cy - r * 0.65},
              ${cx + r * 0.55} ${cy - r * 0.65},
              ${cx + r * 0.55} ${cy - r * 0.1}
          `
          // Bottom arc: mirror (green, arrow pointing left)
          const botArcPath = `
            M ${cx + r * 0.55} ${cy - r * 0.1}
            C ${cx + r * 0.55} ${cy + r * 0.65},
              ${cx - r * 0.55} ${cy + r * 0.65},
              ${cx - r * 0.55} ${cy + r * 0.1}
          `

          // Bar chart positions (3 bars inside the icon)
          const barW = iw * 0.065
          const barGap = iw * 0.045
          const barBaseY = cy + iw * 0.12
          const bars = [
            { h: iw * 0.22, x: cx - barW * 1.5 - barGap },
            { h: iw * 0.33, x: cx - barW / 2 },
            { h: iw * 0.18, x: cx + barW / 2 + barGap },
          ]

          return (
            <g>
              {/* Top arc (blue) */}
              <path
                d={topArcPath}
                stroke="url(#blueGrad)"
                strokeWidth={sw}
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head top-right */}
              <polygon
                points={`
                  ${cx + r * 0.55 + arrowSize},${cy - r * 0.1}
                  ${cx + r * 0.55 - arrowSize * 0.4},${cy - r * 0.1 - arrowSize}
                  ${cx + r * 0.55 - arrowSize * 0.4},${cy - r * 0.1 + arrowSize}
                `}
                fill="url(#blueGrad)"
              />

              {/* Bottom arc (green) */}
              <path
                d={botArcPath}
                stroke="url(#greenGrad)"
                strokeWidth={sw}
                strokeLinecap="round"
                fill="none"
              />
              {/* Arrow head bottom-left */}
              <polygon
                points={`
                  ${cx - r * 0.55 - arrowSize},${cy + r * 0.1}
                  ${cx - r * 0.55 + arrowSize * 0.4},${cy + r * 0.1 - arrowSize}
                  ${cx - r * 0.55 + arrowSize * 0.4},${cy + r * 0.1 + arrowSize}
                `}
                fill="url(#greenGrad)"
              />

              {/* Bar chart */}
              {bars.map((bar, i) => (
                <rect
                  key={i}
                  x={bar.x}
                  y={barBaseY - bar.h}
                  width={barW}
                  height={bar.h}
                  rx={barW * 0.3}
                  fill="url(#barGrad)"
                  opacity={0.85}
                />
              ))}
            </g>
          )
        })()}

        {/* ── TEXT ── SyncroMoney */}
        <g transform={`translate(${iw + s.gap}, 0)`}>
          {/* "Syncro" */}
          <text
            x={0}
            y={s.height * 0.54}
            fontFamily="'Segoe UI', system-ui, sans-serif"
            fontWeight="600"
            fontSize={s.fontSize}
            fill="url(#textBlue)"
            letterSpacing="-0.3"
          >
            Syncro
          </text>
          {/* "Money" — positioned right after "Syncro" */}
          <text
            x={s.fontSize * 3.65}
            y={s.height * 0.54}
            fontFamily="'Segoe UI', system-ui, sans-serif"
            fontWeight="600"
            fontSize={s.fontSize}
            fill="url(#textGreen)"
            letterSpacing="-0.3"
          >
            Money
          </text>

          {/* Tagline with decorative lines */}
          <g transform={`translate(0, ${s.height * 0.54 + s.tagSize * 2.2})`}>
            <line x1={0} y1={0} x2={s.fontSize * 0.9} y2={0} stroke="#001F5C" strokeWidth={0.8} opacity={0.5} />
            <text
              x={s.fontSize * 1.05}
              y={s.tagSize * 0.85}
              fontFamily="'Segoe UI', system-ui, sans-serif"
              fontWeight="400"
              fontSize={s.tagSize}
              fill="#001F5C"
              letterSpacing={s.tagSize * 0.35}
              opacity={0.7}
            >
              CONTROLE FINANCEIRO INTELIGENTE
            </text>
            <line
              x1={s.fontSize * 1.05 + s.tagSize * 18.5}
              y1={0}
              x2={s.fontSize * 7.2}
              y2={0}
              stroke="#001F5C"
              strokeWidth={0.8}
              opacity={0.5}
            />
          </g>
        </g>
      </svg>
    </div>
  )
}
