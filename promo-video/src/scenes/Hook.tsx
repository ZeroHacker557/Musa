import { ease, interp, rand, spring } from '../anim'
import { useFrame } from '../frame'
import { C, FONT_DISPLAY, Snow, Words } from '../components'

/**
 * 1-sahna (0–4 s): «Kechki ovqatga hech narsa yo‘qmi?»
 * Muzlagan ekran chetdan qirov bilan qoplanadi, keyin muz yoriladi va
 * oq chaqnash bilan brend sahnasi ochiladi.
 */

/** Yoriq chiziqlari: markazdan tarqaladigan singan chiziqlar. */
function crackPaths(): { d: string; len: number; delay: number }[] {
  const out: { d: string; len: number; delay: number }[] = []
  const cx = 560
  const cy = 1010
  for (let i = 0; i < 11; i++) {
    const base = (i / 11) * Math.PI * 2 + rand(90 + i) * 0.5
    let x = cx
    let y = cy
    let d = `M${x} ${y}`
    let len = 0
    const segs = 5 + Math.floor(rand(40 + i) * 4)
    for (let s = 0; s < segs; s++) {
      const a = base + (rand(i * 31 + s) - 0.5) * 0.9
      const step = 60 + rand(i * 57 + s) * 120
      x += Math.cos(a) * step
      y += Math.sin(a) * step
      len += step
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    out.push({ d, len, delay: rand(200 + i) * 6 })
  }
  return out
}
const CRACKS = crackPaths()

export function Hook() {
  const f = useFrame()

  // Kamera sekin yaqinlashadi
  const zoom = interp(f, [0, 110], [1.0, 1.08], ease.inOut)
  // Yorilish paytida silkinish
  const shake = f >= 80 && f < 112 ? interp(f, [80, 96, 112], [10, 16, 0]) : 0
  const sx = shake ? (rand(f * 7) - 0.5) * shake * 2 : 0
  const sy = shake ? (rand(f * 13) - 0.5) * shake * 2 : 0

  const frost = interp(f, [0, 70], [0.35, 0.95], ease.out)
  const emoji = spring(f - 50, { stiffness: 160, damping: 11 })
  const wobble = Math.sin(f / 3.2) * interp(f, [55, 75], [0, 7])

  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${sx}px, ${sy}px)` }}>
      {/* Muzli ko'k fon */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(120% 80% at 50% 45%, #1f5a8f 0%, #0d2d52 55%, #06182e 100%)',
          transform: `scale(${zoom})`,
        }}
      />
      <Snow count={70} opacity={0.55} speed={0.6} seed={3} />

      {/* Qirov: chetlardan oq muz naqshi */}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: frost }}>
        <defs>
          <filter id="frost" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="4" seed="4" />
            <feColorMatrix values="0 0 0 0 0.9  0 0 0 0 0.96  0 0 0 0 1  0 0 0 1.8 -0.55" />
          </filter>
          <radialGradient id="frostMask" cx="50%" cy="50%" r="72%">
            <stop offset={`${interp(f, [0, 90], [70, 42])}%`} stopColor="#000" />
            <stop offset="100%" stopColor="#fff" />
          </radialGradient>
          <mask id="fm">
            <rect width="1080" height="1920" fill="url(#frostMask)" />
          </mask>
        </defs>
        <rect width="1080" height="1920" filter="url(#frost)" mask="url(#fm)" />
      </svg>

      {/* Matn */}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 640, textAlign: 'center' }}>
        <Words
          text="Kechki ovqatga"
          start={4}
          stagger={5}
          style={{ fontFamily: FONT_DISPLAY, fontSize: 104, color: '#e8f4ff', lineHeight: 1.08 }}
        />
        <Words
          text="hech narsa"
          start={22}
          stagger={5}
          style={{ fontFamily: FONT_DISPLAY, fontSize: 104, color: '#e8f4ff', lineHeight: 1.08, marginTop: 6 }}
        />
        <Words
          text="yo‘qmi?"
          start={38}
          style={{ fontFamily: FONT_DISPLAY, fontSize: 168, color: C.yellow, lineHeight: 1.05, marginTop: 10 }}
          wordStyle={{ textShadow: '0 10px 30px rgba(0,0,0,0.35)' }}
        />
      </div>
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: 1210, textAlign: 'center', fontSize: 190,
          transform: `scale(${emoji}) rotate(${wobble}deg)`, opacity: Math.min(1, Math.max(0, emoji)),
        }}
      >
        🥶
      </div>

      {/* Yoriqlar */}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {CRACKS.map((c, i) => {
          const p = interp(f, [82 + c.delay, 100 + c.delay], [0, 1], ease.outExpo)
          if (p <= 0) return null
          return (
            <g key={i}>
              <path d={c.d} fill="none" stroke="rgba(190,230,255,0.55)" strokeWidth={10} strokeDasharray={c.len} strokeDashoffset={c.len * (1 - p)} style={{ filter: 'blur(6px)' }} />
              <path d={c.d} fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinejoin="bevel" strokeDasharray={c.len} strokeDashoffset={c.len * (1 - p)} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
