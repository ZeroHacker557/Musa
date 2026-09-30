import { ease, interp, rand, spring } from '../anim'
import { FrameProvider } from '../frame'
import { C, FONT, FONT_DISPLAY, Logo, PriceTag, Words, formatSum } from '../components'
import { TgIcon } from '../scenes/Features'
import SETS from '../sets-data.json'

/**
 * Uzluksiz (loop) setlar videosi — ANIQ 15 s (450 kadr), har set 5 s.
 *
 * Setlar 3 yuzli prizmaning yuzlarida: har 5 soniya oxirida prizma 120°
 * buriladi, 3 burilishda to'liq aylanib boshiga qaytadi. Oxirgi kadr
 * birinchisiga aynan ulanadi: fondagi qor, nurlar va pulslar ham aynan
 * 450 kadrda to'liq davr qiladi. Musiqa 96 BPM — bir set = 2 takt.
 *
 * Har set (mahalliy kadr, 0–150):
 *   0–12    vaziyat yorlig'i va nomi
 *   8–30    tarkibdagi mahsulotlar setdan otilib chiqib, halqada aylanadi
 *   14–28   «N xil mahsulot» sanaladi
 *   34–72   «alohida» narx chiziladi → set narxi sanalib tushadi
 *   78      «tejaysiz» muhri
 *   110–124 mahsulotlar setga qaytadi, matnlar ketadi
 *   124–148 prizma buriladi → keyingi set
 * Ovoz vaqtlari: scripts/audio-sets.mjs (segmentCues).
 */

export const LOOP = 450
export const SEGMENT = 150
const TURN = [124, 148] as const
/** 96 BPM zarbi kadrlarda (30 fps): 450 kadrda aynan 24 zarb. */
const BEAT_FRAMES = 18.75

type SetInfo = { key: string; title: string; chip: string; price: number; separate: number; items: string[] }
const DATA = SETS as SetInfo[]

const THEMES = [
  { inner: '#ff8a4c', mid: '#d62c1f', outer: '#6e0c0c', accent: '#ffd43b' }, // To'kin dasturxon
  { inner: '#5ab4ff', mid: '#1a5fd1', outer: '#0a2366', accent: '#ffd43b' }, // O'quv mavsumi
  { inner: '#2fd06b', mid: '#0a7a3d', outer: '#043d1f', accent: '#ffd43b' }, // Mazali xarid
]

/** #rrggbb → [h, s, l] (h: 0..360). */
function hsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, sat * 100, l * 100]
}

/** Ikki set orasidagi rang: tus (hue) eng qisqa yo'l bilan aylanadi. */
function themeColor(phase: number, stop: 'inner' | 'mid' | 'outer'): string {
  const i = Math.floor(phase) % 3
  const t = ease.inOut(phase - Math.floor(phase))
  const [h1, s1, l1] = hsl(THEMES[i][stop])
  const [h2, s2, l2] = hsl(THEMES[(i + 1) % 3][stop])
  let dh = h2 - h1
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  const h = (h1 + dh * t + 360) % 360
  return `hsl(${h.toFixed(1)} ${(s1 + (s2 - s1) * t).toFixed(1)}% ${(l1 + (l2 - l1) * t).toFixed(1)}%)`
}

// Karta (prizma yuzi) o'lchamlari
const CARD_W = 820
const CARD_H = 700
const RADIUS = CARD_W / (2 * Math.tan(Math.PI / 3)) // uchburchak prizma apofemasi
const CX = 540
const CY = 930

/** Prizma burchagi (gradus) — 0..360, 450 kadrda to'liq aylana. */
function prismAngle(f: number): number {
  const seg = Math.floor(f / SEGMENT)
  const local = f % SEGMENT
  return seg * 120 + interp(local, [TURN[0], TURN[1]], [0, 120], ease.inOut)
}

export function SetsLoop({ frame }: { frame: number }) {
  const f = ((frame % LOOP) + LOOP) % LOOP
  const seg = Math.floor(f / SEGMENT)
  const local = f % SEGMENT
  const angle = prismAngle(f)
  const phase = angle / 120 // 0..3 — qaysi set oldinda
  const turning = local >= TURN[0] && local < TURN[1]
  const squash = turning ? 1 - 0.07 * Math.sin(Math.PI * (local - TURN[0]) / (TURN[1] - TURN[0])) : 1

  return (
    <FrameProvider frame={f}>
      <div style={{ position: 'relative', width: 1080, height: 1920, overflow: 'hidden', background: '#000' }}>
        {/* Fon: rang doirasi bo'ylab o'tadi (yashil → sariq → qizil …) — loyqa aralashma chiqmaydi */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(95% 62% at 50% 46%, ${themeColor(phase, 'inner')} 0%, ${themeColor(phase, 'mid')} 48%, ${themeColor(phase, 'outer')} 100%)`,
          }}
        />
        <LoopRays f={f} />
        <LoopSnow f={f} />

        <Header phase={phase} />

        {/* Matnlar — faqat joriy set uchun */}
        <FrameProvider frame={local}>
          <SetTexts key={`t${seg}`} set={DATA[seg]} local={local} />
        </FrameProvider>

        {/* Halqa (orqa qism) — prizma ortida */}
        <Orbit set={DATA[seg]} local={local} layer="back" />

        {/* Prizma */}
        <div
          style={{
            position: 'absolute', left: CX - CARD_W / 2, top: CY - CARD_H / 2, width: CARD_W, height: CARD_H,
            perspective: 2600, zIndex: 5,
            transform: `scale(${squash}) translateY(${Math.sin((f / LOOP) * Math.PI * 6) * 10}px)`,
          }}
        >
          <div
            style={{
              position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
              transform: `translateZ(${-RADIUS}px) rotateX(-4deg) rotateY(${-angle}deg)`,
            }}
          >
            {DATA.map((s, i) => (
              <div
                key={s.key}
                style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                  transform: `rotateY(${i * 120}deg) translateZ(${RADIUS}px)`,
                }}
              >
                <SetCard set={s} active={i === seg && !turning} local={local} />
              </div>
            ))}
          </div>
        </div>

        <Orbit set={DATA[seg]} local={local} layer="front" />
        <SetBadges set={DATA[seg]} local={local} f={f} />
        <PriceBlock set={DATA[seg]} local={local} />
        <Cta f={f} />
      </div>
    </FrameProvider>
  )
}

// ─── Fon (davriy) ─────────────────────────────────────────────

/** Nurlar: loop davomida aynan 44° (naqshning 2 davri) buriladi — ulanish sezilmaydi. */
function LoopRays({ f }: { f: number }) {
  return (
    <div
      style={{
        position: 'absolute', left: 540 - 1400, top: CY - 1400, width: 2800, height: 2800, opacity: 0.13,
        transform: `rotate(${(f / LOOP) * 44}deg)`,
        background: 'repeating-conic-gradient(from 0deg, #fff 0deg 7deg, transparent 7deg 22deg)',
        maskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.5) 30%, transparent 62%)',
        WebkitMaskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,0.5) 30%, transparent 62%)',
      }}
    />
  )
}

/** Qor: har zarra loop davomida butun son marta ekran bo'ylab o'tadi. */
function LoopSnow({ f }: { f: number }) {
  const H = 2100
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: 56 }, (_, i) => {
        const laps = 1 + Math.floor(rand(700 + i) * 2) // 1..2 marta
        const size = 3 + laps * 2.4 + rand(800 + i) * 3
        const y = ((rand(900 + i) * H + (f / LOOP) * H * laps) % H) - 90
        const sway = Math.sin(((f / LOOP) * (2 + (i % 3)) + rand(1000 + i)) * Math.PI * 2) * 22
        const x = rand(1100 + i) * 1080 + sway
        return <circle key={i} cx={x} cy={y} r={size / 2} fill="#fff" opacity={0.25 + rand(1200 + i) * 0.45} />
      })}
    </svg>
  )
}

// ─── Sarlavha va jarayon nuqtalari ────────────────────────────

function Header({ phase }: { phase: number }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, zIndex: 20 }}>
      <div style={{ width: 700 * 0.3, height: 250 * 0.3 }}>
        <div style={{ transform: 'scale(0.3)', transformOrigin: 'top left' }}><Logo /></div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[0, 1, 2].map((i) => {
          const d = Math.min(Math.abs(phase - i), Math.abs(phase - i - 3), Math.abs(phase - i + 3))
          const on = Math.max(0, 1 - d)
          return <span key={i} style={{ width: 18 + on * 42, height: 18, borderRadius: 9, background: `rgba(255,255,255,${0.35 + on * 0.65})` }} />
        })}
      </div>
    </div>
  )
}

// ─── Set nomi ─────────────────────────────────────────────────

function SetTexts({ set, local }: { set: SetInfo; local: number }) {
  const out = interp(local, [114, 124], [0, 1], ease.in)
  const chip = spring(local - 1, { stiffness: 220, damping: 15 })
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 225, textAlign: 'center', zIndex: 20, opacity: 1 - out, transform: `translateY(${-out * 40}px)` }}>
      <div style={{ display: 'inline-block', transform: `scale(${Math.max(0, chip)})` }}>
        <span style={{ display: 'inline-block', padding: '12px 30px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', border: '2px solid rgba(255,255,255,0.45)', fontFamily: FONT, fontWeight: 800, fontSize: 36, color: '#fff' }}>
          {set.chip}
        </span>
      </div>
      <Words
        text={set.title}
        start={3}
        stagger={3}
        style={{ fontFamily: FONT_DISPLAY, fontSize: 90, color: '#fff', lineHeight: 1.04, marginTop: 18 }}
        wordStyle={{ textShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
      />
    </div>
  )
}

// ─── Set kartochkasi (prizma yuzi) ────────────────────────────

function SetCard({ set, active, local }: { set: SetInfo; active: boolean; local: number }) {
  const pulse = active ? 1 + 0.035 * Math.exp(-Math.max(0, local - 5) / 6) * (local >= 5 ? 1 : 0) : 1
  const shine = active ? interp(local, [92, 108], [0, 1], ease.inOut) : 0
  return (
    <div
      style={{
        width: CARD_W, height: CARD_H, borderRadius: 52, background: '#fff', overflow: 'hidden', position: 'relative',
        boxShadow: '0 50px 90px rgba(0,0,0,0.35), 0 0 0 10px rgba(255,255,255,0.35)', transform: `scale(${pulse})`,
      }}
    >
      <img
        src={`/set-${set.key}-crop.webp`}
        style={{
          position: 'absolute', inset: 26, width: CARD_W - 52, height: CARD_H - 52, objectFit: 'contain',
          maskImage: 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 7%, #000 93%, transparent 100%)',
        }}
      />
      {shine > 0 && shine < 1 && (
        <div
          style={{
            position: 'absolute', top: -100, bottom: -100, width: 180, left: -260 + shine * (CARD_W + 520),
            transform: 'skewX(-20deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)',
          }}
        />
      )}
    </div>
  )
}

// ─── Tarkib halqasi ───────────────────────────────────────────

const RING_Y = 1318
const RING_RX = 500
const RING_RY = 52

function Orbit({ set, local, layer }: { set: SetInfo; local: number; layer: 'front' | 'back' }) {
  const n = set.items.length
  const retract = interp(local, [110, 124], [0, 1], ease.in)
  return (
    <>
      {set.items.map((id, k) => {
        const burst = spring(local - 8 - k, { stiffness: 130, damping: 14 })
        const p = Math.max(0, Math.min(1.08, burst)) * (1 - retract)
        if (p <= 0.001) return null
        const theta = (k / n) * Math.PI * 2 + local * 0.022
        const depth = Math.sin(theta) // >0 — oldinda
        if ((layer === 'front') !== (depth >= 0)) return null
        const rx = CX + Math.cos(theta) * RING_RX
        const ry = RING_Y + depth * RING_RY
        const x = CX + (rx - CX) * p
        const y = CY + (ry - CY) * p
        const size = 138 * (0.72 + 0.28 * ((depth + 1) / 2)) * Math.min(1, p * 1.4)
        return (
          <div
            key={id}
            style={{
              position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%',
              background: '#fff', overflow: 'hidden', zIndex: layer === 'front' ? 8 : 3,
              boxShadow: '0 14px 30px rgba(0,0,0,0.3)', opacity: layer === 'back' ? 0.85 : 1,
              filter: layer === 'back' ? 'brightness(0.92)' : undefined,
            }}
          >
            <img src={`/items/${id}.webp`} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: size * 0.1, boxSizing: 'border-box' }} />
          </div>
        )
      })}
    </>
  )
}

// ─── «N xil mahsulot» va «tejaysiz» muhri ─────────────────────

function SetBadges({ set, local, f }: { set: SetInfo; local: number; f: number }) {
  const out = interp(local, [114, 124], [0, 1], ease.in)
  const count = spring(local - 14, { stiffness: 200, damping: 12 })
  const nShown = Math.round(interp(local, [14, 28], [0, set.items.length], ease.out))
  const stampL = local - 78
  const stamp = stampL < 0 ? 0 : interp(stampL, [0, 6], [2.3, 1], ease.in)
  const shake = stampL >= 6 && stampL < 13 ? (rand(f) - 0.5) * 10 : 0
  const save = set.separate - set.price
  return (
    <>
      {local >= 14 && (
        <div
          style={{
            position: 'absolute', left: 60, top: 520, zIndex: 12, transform: `scale(${Math.max(0, count) * (1 - out)}) rotate(-8deg)`,
            display: 'flex', alignItems: 'baseline', gap: 10, padding: '16px 30px', borderRadius: 28, background: '#fff',
            boxShadow: '0 18px 36px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 64, color: C.green, lineHeight: 1 }}>{nShown}</span>
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 30, color: C.ink, lineHeight: 1.05 }}>xil<br />mahsulot</span>
        </div>
      )}
      {stampL >= 0 && (
        <div
          style={{
            position: 'absolute', left: 740, top: 480, width: 290, height: 290, borderRadius: '50%', zIndex: 12,
            background: 'radial-gradient(circle at 35% 30%, #fff3a6, #ffd43b 55%, #f2a900)',
            border: '7px dashed rgba(120,60,0,0.55)', boxShadow: '0 24px 50px rgba(0,0,0,0.4)',
            display: 'grid', placeItems: 'center', textAlign: 'center', color: C.ink,
            transform: `translate(${shake}px, ${shake * 0.6}px) scale(${stamp * (1 - out)}) rotate(12deg)`,
            opacity: interp(stampL, [0, 3], [0, 1]),
          }}
        >
          <div style={{ lineHeight: 1.02 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56 }}>{formatSum(save)}</div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 30 }}>so‘m</div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 34, marginTop: 4, color: '#b3261e' }}>TEJAYSIZ!</div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Narx: alohida → set ──────────────────────────────────────

function PriceBlock({ set, local }: { set: SetInfo; local: number }) {
  const out = interp(local, [114, 124], [0, 1], ease.in)
  const rowIn = interp(local, [34, 42], [0, 1], ease.out)
  const strike = interp(local, [44, 52], [0, 1], ease.out)
  const tag = spring(local - 54, { stiffness: 200, damping: 13 })
  const countT = interp(local, [54, 72], [0, 1], ease.out)
  const value = set.separate - (set.separate - set.price) * countT
  const land = local >= 72 ? 1 + 0.06 * Math.exp(-(local - 72) / 5) : 1
  if (local < 34) return null
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1478, textAlign: 'center', zIndex: 14, opacity: 1 - out, transform: `translateY(${out * 40}px)` }}>
      <div style={{ opacity: rowIn, transform: `translateY(${(1 - rowIn) * 24}px)` }}>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40, color: 'rgba(255,255,255,0.8)' }}>Alohida olsangiz: </span>
        <span style={{ position: 'relative', fontFamily: FONT, fontWeight: 900, fontSize: 48, color: 'rgba(255,255,255,0.9)' }}>
          {formatSum(set.separate)} so‘m
          <span style={{ position: 'absolute', left: -8, right: -8, top: '52%', height: 7, borderRadius: 4, background: '#fff', transformOrigin: 'left', transform: `rotate(-5deg) scaleX(${strike})`, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
        </span>
      </div>
      {local >= 52 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <PriceTag value={formatSum(value)} big scale={Math.max(0, tag) * land} rotate={-3} />
        </div>
      )}
    </div>
  )
}

// ─── Doimiy chaqiriq ──────────────────────────────────────────

function Cta({ f }: { f: number }) {
  // 96 BPM zarbiga mos puls (zarb 18.75 kadr — butun son emas)
  const beat = Math.exp(-(f % BEAT_FRAMES) / 5)
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 1730, display: 'flex', justifyContent: 'center', zIndex: 16 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 18, padding: '16px 40px 16px 18px', borderRadius: 999, background: '#fff',
          boxShadow: `0 18px 40px rgba(0,0,0,0.3), 0 0 0 ${6 + beat * 10}px rgba(255,255,255,${0.12 + beat * 0.18})`,
          transform: `scale(${1 + beat * 0.03})`,
        }}
      >
        <TgIcon size={76} />
        <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: '#5b6b62' }}>Buyurtma:</span>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 50, color: C.ink }}>@musauz_bot</span>
      </div>
    </div>
  )
}
