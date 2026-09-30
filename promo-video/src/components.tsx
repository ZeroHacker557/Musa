import type { CSSProperties, ReactNode } from 'react'
import { ease, interp, rand, spring } from './anim'
import { useFrame } from './frame'

export const C = {
  green: '#0a7a3d',
  greenDeep: '#05522a',
  greenBright: '#14a352',
  yellow: '#ffd43b',
  gold: '#f5b800',
  blue: '#1f3f9e',
  cream: '#fff8e7',
  ink: '#10231a',
  white: '#ffffff',
  red: '#e8453c',
}

export const FONT_DISPLAY = '"Archivo Black", "Montserrat", sans-serif'
export const FONT = '"Montserrat", sans-serif'

// ─── Fon qatlamlari ───────────────────────────────────────────

/** Qor zarralari — sekin tushadi, chayqaladi. `frame` global bo'lishi shart emas. */
export function Snow({ count = 60, color = '#fff', opacity = 0.8, speed = 1, seed = 1 }: {
  count?: number; color?: string; opacity?: number; speed?: number; seed?: number
}) {
  const f = useFrame()
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: count }, (_, i) => {
        const r = rand(seed * 1000 + i)
        const size = 3 + rand(seed * 2000 + i) * 9
        const vy = (1.2 + rand(seed * 3000 + i) * 2.6) * speed * (size / 8)
        const x0 = r * 1080
        const y = ((rand(seed * 4000 + i) * 2100 + f * vy * 2) % 2100) - 90
        const x = x0 + Math.sin((f + i * 17) / (22 + i % 9)) * 26
        const blur = size > 9 ? 2 : 0
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={size / 2}
            fill={color}
            opacity={opacity * (0.35 + rand(seed * 5000 + i) * 0.65)}
            style={blur ? { filter: `blur(${blur}px)` } : undefined}
          />
        )
      })}
    </svg>
  )
}

/** Sekin aylanadigan yorug'lik nurlari. */
export function Rays({ opacity = 0.14, color = '#fff', speed = 0.15, y = 760 }: {
  opacity?: number; color?: string; speed?: number; y?: number
}) {
  const f = useFrame()
  return (
    <div
      style={{
        position: 'absolute',
        left: 540 - 1400,
        top: y - 1400,
        width: 2800,
        height: 2800,
        opacity,
        transform: `rotate(${f * speed}deg)`,
        background: `repeating-conic-gradient(from 0deg, ${color} 0deg 7deg, transparent 7deg 22deg)`,
        maskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.5) 30%, transparent 62%)',
        WebkitMaskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.5) 30%, transparent 62%)',
      }}
    />
  )
}

/** Oq chaqnash (sahna almashuvi). */
export function Flash({ from, peak, to, color = '#fff' }: { from: number; peak: number; to: number; color?: string }) {
  const f = useFrame()
  const o = interp(f, [from, peak, to], [0, 1, 0], ease.inOut)
  if (o <= 0) return null
  return <div style={{ position: 'absolute', inset: 0, background: color, opacity: o, zIndex: 50 }} />
}

// ─── Logotip ──────────────────────────────────────────────────

/** MUSA logotipi — CSS bilan chizilgan (har qanday o'lchamda tiniq). */
export function Logo({ scale = 1, shine = -1 }: { scale?: number; shine?: number }) {
  const w = 700
  const h = 250
  return (
    <div style={{ width: w, height: h, transform: `scale(${scale})`, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 64,
          background: 'linear-gradient(180deg, #fff3a6 0%, #ffd43b 38%, #f2b400 100%)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.35), inset 0 -10px 0 rgba(160,105,0,0.45), inset 0 8px 0 rgba(255,255,255,0.7)',
          border: '6px solid #c98f00',
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 176,
            letterSpacing: 4,
            color: C.blue,
            lineHeight: 1,
            marginTop: 8,
            textShadow: '0 4px 0 #132a70, 0 10px 18px rgba(0,0,40,0.25)',
          }}
        >
          MUSA
        </span>
        {shine >= 0 && shine <= 1 && (
          <div
            style={{
              position: 'absolute',
              top: -60,
              bottom: -60,
              width: 140,
              left: -200 + shine * (w + 400),
              transform: 'skewX(-22deg)',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85), transparent)',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Matn ─────────────────────────────────────────────────────

/**
 * So'zma-so'z chiqadigan sarlavha: har so'z pastdan, xiralikdan tiniqlashib,
 * prujina bilan joyiga keladi.
 */
export function Words({
  text, start, stagger = 4, style, wordStyle, highlight = {}, align = 'center', rise = 70,
}: {
  text: string
  start: number
  stagger?: number
  style?: CSSProperties
  wordStyle?: CSSProperties
  /** so'z → alohida stil (masalan sariq rang) */
  highlight?: Record<string, CSSProperties>
  align?: 'center' | 'left'
  rise?: number
}) {
  const f = useFrame()
  const words = text.split(' ')
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: '0.28em',
        ...style,
      }}
    >
      {words.map((w, i) => {
        const local = f - start - i * stagger
        const p = spring(local, { stiffness: 190, damping: 17 })
        const o = interp(local, [0, 7], [0, 1])
        const blur = interp(local, [0, 9], [14, 0])
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: o,
              transform: `translateY(${(1 - p) * rise}px) scale(${0.9 + 0.1 * p})`,
              filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
              ...wordStyle,
              ...highlight[w],
            }}
          >
            {w}
          </span>
        )
      })}
    </div>
  )
}

export const formatSum = (n: number) => `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')}`

// ─── Kartochka va narx ────────────────────────────────────────

/** Ilovadagidek oq mahsulot kartochkasi. */
export function Card({ src, width, height, radius = 40, pad = 18, children, style, imgStyle }: {
  src: string
  width: number
  height: number
  radius?: number
  pad?: number
  children?: ReactNode
  style?: CSSProperties
  imgStyle?: CSSProperties
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: '#fff',
        boxShadow: '0 40px 80px rgba(8,40,20,0.28), 0 8px 18px rgba(8,40,20,0.12)',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <img
        src={src}
        style={{ position: 'absolute', inset: pad, width: width - pad * 2, height: height - pad * 2, objectFit: 'contain', ...imgStyle }}
      />
      {children}
    </div>
  )
}

/** Sariq narx yorlig'i (teshikchali «tag» shakli). */
export function PriceTag({ value, suffix = 'so‘m', scale = 1, rotate = -6, big = false, style }: {
  value: string
  suffix?: string
  scale?: number
  rotate?: number
  big?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 12,
        padding: big ? '22px 44px 22px 76px' : '14px 30px 14px 56px',
        borderRadius: big ? 26 : 18,
        background: 'linear-gradient(180deg, #ffe066 0%, #ffcf1a 100%)',
        color: C.ink,
        fontFamily: FONT_DISPLAY,
        fontSize: big ? 92 : 54,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        position: 'relative',
        transform: `rotate(${rotate}deg) scale(${scale})`,
        boxShadow: '0 18px 36px rgba(120,80,0,0.35), inset 0 -6px 0 rgba(170,110,0,0.35)',
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: big ? 26 : 20,
          top: '50%',
          width: big ? 26 : 18,
          height: big ? 26 : 18,
          marginTop: big ? -13 : -9,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.18)',
          boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.3)',
        }}
      />
      {value}
      <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: big ? 44 : 28 }}>{suffix}</span>
    </div>
  )
}

/** Oddiy yorliq (chip). */
export function Chip({ children, bg = C.green, color = '#fff', style }: {
  children: ReactNode; bg?: string; color?: string; style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 30px',
        borderRadius: 999,
        background: bg,
        color,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 38,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Telefon ──────────────────────────────────────────────────

export const PHONE_W = 600
export const PHONE_H = 1230

/** Telefon ramkasi — ichida ekran (560×1190). */
export function Phone({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: 86,
        background: 'linear-gradient(145deg, #2a2f36, #0d1014)',
        padding: 20,
        boxShadow: '0 60px 120px rgba(6,40,20,0.45), 0 0 0 3px #3a4048, inset 0 0 0 2px #50565e',
        position: 'relative',
        ...style,
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 66, overflow: 'hidden', background: '#fff' }}>
        {children}
        {/* Kamera o'yig'i */}
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            width: 170,
            height: 46,
            marginLeft: -85,
            borderRadius: 30,
            background: '#07090b',
            zIndex: 30,
          }}
        />
      </div>
    </div>
  )
}

/** Barmoq bosishi — halqa kengayadi. */
export function Tap({ at, x, y }: { at: number; x: number; y: number }) {
  const f = useFrame()
  const l = f - at
  if (l < -8 || l > 22) return null
  const dot = interp(l, [-8, 0, 6, 12], [0, 1, 1, 0])
  const ring = interp(l, [0, 20], [0, 1], ease.out)
  return (
    <>
      <div
        style={{
          position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(20,40,30,0.28)', border: '4px solid rgba(255,255,255,0.9)', opacity: dot,
          transform: `scale(${interp(l, [-8, 0, 4], [1.4, 0.9, 1])})`, zIndex: 40,
        }}
      />
      <div
        style={{
          position: 'absolute', left: x - 90, top: y - 90, width: 180, height: 180, borderRadius: '50%',
          border: '5px solid rgba(20,163,82,0.7)', opacity: 1 - ring, transform: `scale(${0.3 + ring})`, zIndex: 40,
        }}
      />
    </>
  )
}

/** Uchqunlar portlashi (markazdan). */
export function Burst({ at, x, y, count = 18, color = C.yellow, radius = 260, seed = 7 }: {
  at: number; x: number; y: number; count?: number; color?: string; radius?: number; seed?: number
}) {
  const f = useFrame()
  const l = f - at
  if (l < 0 || l > 34) return null
  const p = ease.outExpo(Math.min(1, l / 26))
  const o = interp(l, [0, 4, 22, 34], [0, 1, 1, 0])
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + rand(seed + i) * 0.4
        const d = radius * (0.55 + rand(seed * 3 + i) * 0.6) * p
        const s = 6 + rand(seed * 5 + i) * 10
        const cx = x + Math.cos(a) * d
        const cy = y + Math.sin(a) * d
        return i % 3 === 0
          ? <circle key={i} cx={cx} cy={cy} r={s * (1 - p * 0.5)} fill={color} opacity={o} />
          : <rect key={i} x={cx - s / 2} y={cy - s * 1.5} width={s * 0.6} height={s * 3} rx={s * 0.3} fill={i % 2 ? '#fff' : color} opacity={o} transform={`rotate(${(a * 180) / Math.PI + 90} ${cx} ${cy})`} />
      })}
    </svg>
  )
}
