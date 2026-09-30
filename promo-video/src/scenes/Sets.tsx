import { ease, interp, rand, spring } from '../anim'
import { useFrame } from '../frame'
import { Burst, C, Card, FONT, FONT_DISPLAY, PriceTag, Rays, Snow, Words, formatSum } from '../components'

/**
 * 4-sahna (16–24 s): SETLAR. Mahsulotlar markazga uchib kelib bitta setga
 * yig'iladi, «alohida» narx chizib tashlanadi, set narxi sanalib tushadi va
 * «tejaysiz» muhri uriladi.
 *
 * Narxlar ilovadagi haqiqiy «Musa To‘kin Dasturxon» setidan:
 * tarkibi alohida 283 510 so'm, set 252 000 so'm.
 */

const SEPARATE = 283510
const SET_PRICE = 252000

const FLY = [
  { src: '/kotlet.webp', x: -140, y: 520 },
  { src: '/chuchvara.webp', x: 1220, y: 640 },
  { src: '/somsa.webp', x: -160, y: 1380 },
  { src: '/sirok.webp', x: 1240, y: 1300 },
  { src: '/gelato.webp', x: 260, y: 2080 },
  { src: '/dubai.webp', x: 860, y: 2080 },
]
const CX = 540
const CY = 1000
const SET_AT = 92

export function Sets() {
  const f = useFrame()

  const reveal = interp(f, [0, 16], [0, 1500], ease.outExpo)
  const exit = interp(f, [232, 246], [0, -1920], ease.in)

  const title = spring(f - 5, { stiffness: 170, damping: 11 })
  const glow = interp(f, [50, SET_AT, SET_AT + 20], [0, 1, 0.55])
  const card = spring(f - SET_AT, { stiffness: 150, damping: 12 })

  const strike = interp(f, [148, 160], [0, 1], ease.out)
  const countT = interp(f, [162, 186], [0, 1], ease.out)
  const price = SEPARATE - (SEPARATE - SET_PRICE) * countT
  const tag = spring(f - 160, { stiffness: 200, damping: 13 })
  const tagPulse = f >= 186 ? 1 + 0.06 * Math.exp(-(f - 186) / 5) : 1

  const stampL = f - 196
  const stamp = stampL < 0 ? 0 : interp(stampL, [0, 6], [2.4, 1], ease.in)
  const stampShake = stampL >= 6 && stampL < 14 ? (rand(f) - 0.5) * 12 : 0

  return (
    <div style={{ position: 'absolute', inset: 0, clipPath: `circle(${reveal}px at 540px 960px)`, transform: `translateY(${exit}px)` }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(100% 70% at 50% 45%, #0f8f47 0%, ${C.greenDeep} 70%, #032815 100%)` }} />
      <Rays opacity={0.12} color="#ffe27a" y={CY} speed={-0.3} />
      <Snow count={40} opacity={0.5} speed={0.5} seed={21} color="#fff3b0" />

      {/* Sarlavha */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 200, textAlign: 'center', transform: `scale(${Math.max(0, title)})` }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY, fontSize: 210, lineHeight: 1, letterSpacing: 4,
            background: 'linear-gradient(180deg, #fff6b8 0%, #ffd43b 45%, #f2a900 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            filter: 'drop-shadow(0 12px 0 #033a1c) drop-shadow(0 24px 40px rgba(0,0,0,0.35))',
          }}
        >
          SETLAR
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 450 }}>
        <Words
          text="Hammasi — bitta qutida"
          start={20}
          stagger={4}
          style={{ fontFamily: FONT, fontWeight: 800, fontSize: 62, color: '#fff' }}
        />
      </div>

      {/* Markazdagi yorug'lik */}
      <div
        style={{
          position: 'absolute', left: CX - 520, top: CY - 520, width: 1040, height: 1040, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,226,120,0.75) 0%, rgba(255,212,59,0.25) 35%, transparent 65%)',
          opacity: glow, transform: `scale(${0.6 + glow * 0.5})`,
        }}
      />

      {/* Uchib keluvchi mahsulotlar */}
      {FLY.map((it, i) => {
        const s = 36 + i * 5
        const t = interp(f, [s, s + 26], [0, 1], ease.inOut)
        if (f < s || t >= 1) return null
        const ctrlX = (it.x + CX) / 2 + (rand(i + 3) - 0.5) * 500
        const ctrlY = (it.y + CY) / 2 - 300
        const x = (1 - t) * (1 - t) * it.x + 2 * (1 - t) * t * ctrlX + t * t * CX
        const y = (1 - t) * (1 - t) * it.y + 2 * (1 - t) * t * ctrlY + t * t * CY
        const size = interp(t, [0, 1], [230, 70])
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size,
              transform: `rotate(${t * 360 * (i % 2 ? 1 : -1)}deg)`, opacity: interp(t, [0, 0.1, 0.85, 1], [0, 1, 1, 0]),
            }}
          >
            <Card src={it.src} width={size} height={size} radius={size / 2} pad={size * 0.12} />
          </div>
        )
      })}

      {/* Set kartochkasi */}
      {f >= SET_AT && (
        <div
          style={{
            position: 'absolute', left: CX - 480, top: 740,
            transform: `scale(${Math.max(0, card)}) rotate(${(1 - card) * -10}deg)`,
          }}
        >
          <Card src="/set-dasturxon.webp" width={960} height={540} radius={44} pad={0} imgStyle={{ objectFit: 'cover' }} style={{ border: '8px solid #fff' }} />
        </div>
      )}
      <Burst at={SET_AT} x={CX} y={1010} count={26} radius={560} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 1320 }}>
        <Words
          text="«To‘kin dasturxon» seti"
          start={SET_AT + 16}
          stagger={4}
          style={{ fontFamily: FONT, fontWeight: 800, fontSize: 60, color: '#fff' }}
        />
      </div>

      {/* Narx: alohida → set */}
      {f >= 128 && (
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 1420, textAlign: 'center',
            opacity: interp(f, [128, 138], [0, 1]), transform: `translateY(${interp(f, [128, 140], [30, 0], ease.out)}px)`,
          }}
        >
          <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 44, color: 'rgba(255,255,255,0.75)' }}>Alohida olsangiz: </span>
          <span style={{ position: 'relative', fontFamily: FONT, fontWeight: 900, fontSize: 56, color: 'rgba(255,255,255,0.85)' }}>
            {formatSum(SEPARATE)} so‘m
            <span
              style={{
                position: 'absolute', left: -8, right: -8, top: '52%', height: 8, borderRadius: 4, background: '#ff5a4f',
                transformOrigin: 'left', transform: `rotate(-5deg) scaleX(${strike})`, boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }}
            />
          </span>
        </div>
      )}
      {f >= 158 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1515, display: 'flex', justifyContent: 'center' }}>
          <PriceTag value={formatSum(price)} big scale={Math.max(0, tag) * tagPulse} rotate={-4} />
        </div>
      )}

      {/* Tejash muhri */}
      {stampL >= 0 && (
        <div
          style={{
            position: 'absolute', left: 700, top: 590, width: 330, height: 330, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #ff7a5c, #e8453c 60%, #b8261f)',
            border: '8px dashed rgba(255,255,255,0.9)',
            boxShadow: '0 24px 50px rgba(120,0,0,0.45)',
            display: 'grid', placeItems: 'center', textAlign: 'center', color: '#fff',
            transform: `translate(${stampShake}px, ${stampShake * 0.6}px) scale(${stamp}) rotate(-14deg)`,
            opacity: interp(stampL, [0, 3], [0, 1]), zIndex: 30,
          }}
        >
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 60 }}>{formatSum(SEPARATE - SET_PRICE)}</div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 34 }}>so‘m</div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 38, marginTop: 4, color: '#fff3b0' }}>TEJAYSIZ!</div>
          </div>
        </div>
      )}
    </div>
  )
}
