import type { CSSProperties, ReactNode } from 'react'
import { clamp01, ease, interp, spring } from '../anim'
import { useFrame } from '../frame'
import { FONT } from '../components'

/** Telefon ekrani (Phone ichi): 560 × 1190. */
export const SW = 560
export const SH = 1190

export const TG = {
  blue: '#3390ec',
  chatBg: 'linear-gradient(160deg, #d5e8c4 0%, #b9d7a8 50%, #cfe4bd 100%)',
  out: '#e3fcc8',
  in: '#ffffff',
  sub: '#707579',
  line: '#ececec',
}

export const APP = {
  green: '#0a7a3d',
  greenDeep: '#05542a',
  soft: '#e6f4ea',
  ink: '#0f1a14',
  muted: '#5d6b63',
  faint: '#8a968f',
  bg: '#f4f8f5',
  line: '#e1eae4',
  yellow: '#ffd76a',
  red: '#e8453c',
}

/** Prujina bilan paydo bo'lish (0 → 1). */
export const pop = (f: number, at: number, stiffness = 230, damping = 16) => clamp01(spring(f - at, { stiffness, damping }))
/** Silliq o'tish (0 → 1). */
export const ramp = (f: number, a: number, b: number, e = ease.out) => interp(f, [a, b], [0, 1], e)
/** Matn terilishi — `cpf` belgi/kadr. */
export const typed = (text: string, f: number, at: number, cpf = 0.55) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((f - at) * cpf))))

export function Caret({ f, color = APP.green }: { f: number; color?: string }) {
  return <span style={{ display: 'inline-block', width: 3, height: '1.05em', marginLeft: 2, verticalAlign: 'text-bottom', background: color, opacity: Math.floor(f / 8) % 2 ? 0 : 1 }} />
}

/** Telefonning yuqori qatori (soat, aloqa, batareya). */
export function StatusBar({ dark = false, bg = 'transparent' }: { dark?: boolean; bg?: string }) {
  const c = dark ? '#fff' : '#000'
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 64, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 44px 0 52px', fontFamily: FONT, fontWeight: 700, fontSize: 22, color: c, zIndex: 25 }}>
      <span>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="26" height="16" viewBox="0 0 26 16">{[0, 1, 2, 3].map((i) => <rect key={i} x={i * 7} y={12 - i * 4} width="5" height={4 + i * 4} rx="1" fill={c} />)}</svg>
        <svg width="24" height="17" viewBox="0 0 24 17"><path d="M12 15.5l3-3.4a4.3 4.3 0 0 0-6 0zM5.6 9.2a9 9 0 0 1 12.8 0l-2 2.2a6.2 6.2 0 0 0-8.8 0zM1.5 4.8a14.8 14.8 0 0 1 21 0l-2 2.2a12 12 0 0 0-17 0z" fill={c} /></svg>
        <svg width="34" height="17" viewBox="0 0 34 17"><rect x="1" y="1" width="28" height="15" rx="4" fill="none" stroke={c} strokeWidth="2" opacity="0.5" /><rect x="3.5" y="3.5" width="21" height="10" rx="2" fill={c} /><rect x="30.5" y="5.5" width="2.5" height="6" rx="1" fill={c} opacity="0.5" /></svg>
      </span>
    </div>
  )
}

/** Ekran ichidagi absolut qatlam. */
export function Box({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', inset: 0, fontFamily: FONT, color: '#111', ...style }}>{children}</div>
}

/**
 * Barmoq: bosishlar ro'yxati bo'ylab harakatlanadi. Bosish paytida
 * kichrayadi va halqa tarqaladi. Koordinatalar — ekran (560×1190) ichida.
 */
export type TapPoint = { f: number; x: number; y: number; drag?: { x: number; y: number; to: number } }

export function Finger({ taps }: { taps: TapPoint[] }) {
  const f = useFrame()
  // Faol oraliq: birinchi bosishdan 14 kadr oldin — oxirgisidan 16 kadr keyin
  const first = taps[0]
  const last = taps[taps.length - 1]
  const lastEnd = last.drag ? last.drag.to : last.f
  if (f < first.f - 16 || f > lastEnd + 18) return null
  let x = first.x
  let y = first.y
  for (let i = 0; i < taps.length; i++) {
    const t = taps[i]
    const prev = taps[i - 1]
    if (prev) {
      const start = (prev.drag ? prev.drag.to : prev.f) + 4
      const k = interp(f, [start, Math.max(start + 1, t.f - 2)], [0, 1], ease.inOut)
      const px = prev.drag ? prev.drag.x : prev.x
      const py = prev.drag ? prev.drag.y : prev.y
      if (f >= start) {
        x = px + (t.x - px) * k
        y = py + (t.y - py) * k
      }
    }
    if (t.drag && f >= t.f) {
      const k = interp(f, [t.f + 4, t.drag.to], [0, 1], ease.inOut)
      x = t.x + (t.drag.x - t.x) * k
      y = t.y + (t.drag.y - t.y) * k
    }
  }
  const press = taps.reduce((m, t) => {
    const end = t.drag ? t.drag.to : t.f
    const d = f < t.f ? t.f - f : f > end ? f - end : 0
    return Math.max(m, clamp01(1 - d / 5))
  }, 0)
  const vis = interp(f, [first.f - 16, first.f - 8, lastEnd + 8, lastEnd + 18], [0, 1, 1, 0])
  return (
    <>
      {taps.map((t, i) => <Ripple key={i} at={t.f} x={t.x} y={t.y} />)}
      <div style={{ position: 'absolute', left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: '50%', zIndex: 60, opacity: vis, transform: `scale(${1 - press * 0.22})`, background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.95), rgba(235,240,237,0.85))', border: '3px solid rgba(255,255,255,0.95)', boxShadow: `0 ${10 - press * 6}px ${26 - press * 14}px rgba(0,30,15,0.35), inset 0 -4px 8px rgba(0,0,0,0.08)` }} />
    </>
  )
}

function Ripple({ at, x, y }: { at: number; x: number; y: number }) {
  const f = useFrame()
  const l = f - at
  if (l < 0 || l > 20) return null
  const p = ease.out(l / 20)
  return <div style={{ position: 'absolute', left: x - 70, top: y - 70, width: 140, height: 140, borderRadius: '50%', border: '5px solid rgba(20,163,82,0.75)', background: 'rgba(20,163,82,0.12)', opacity: 1 - p, transform: `scale(${0.3 + p})`, zIndex: 59 }} />
}

/** Pastdan surilib chiqadigan oyna (sheet) uchun siljish, px. */
export const sheetY = (f: number, at: number, out = -1, h = SH) => {
  const inP = spring(f - at, { stiffness: 190, damping: 22 })
  const outP = out >= 0 ? interp(f, [out, out + 12], [0, 1], ease.in) : 0
  return (1 - inP) * h + outP * h
}

/** Ekranlar almashishi: chapga surilish (yangisi o'ngdan). */
export const pushX = (f: number, at: number) => (1 - spring(f - at, { stiffness: 200, damping: 24 })) * SW

export const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')
