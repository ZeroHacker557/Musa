import { ease, interp, spring } from '../anim'
import { useFrame } from '../frame'
import { C, Card, Chip, FONT, FONT_DISPLAY, PriceTag, Words, formatSum } from '../components'

/**
 * 3-sahna (8–16 s): mahsulotlar karuseli — har biri bir takt ichida (3 zarb)
 * o'ngdan kirib, oldingisi chapga-orqaga suriladi. Keyin 3×3 to'r va
 * «150+ mahsulot» hisoblagichi.
 */

const ITEMS = [
  { src: '/kotlet.webp', name: 'Mol go‘shtli kotlet', chip: '🥩  Yarim tayyor', price: 32670 },
  { src: '/chuchvara.webp', name: 'Musa chuchvara', chip: '🥟  Yarim tayyor', price: 27200 },
  { src: '/somsa.webp', name: 'Qatlama somsa', chip: '🥐  Yarim tayyor', price: 30300 },
  { src: '/dubai.webp', name: 'BissGo Dubai', chip: '🍦  Muzqaymoq', price: 20000 },
]
const STARTS = [15, 60, 105, 150]
const GRID_AT = 192

const GRID = ['kotlet', 'chuchvara', 'somsa', 'dubai', 'gelato', 'bissgo', 'sirok', 'set-oquv', 'set-oila']

export function Products() {
  const f = useFrame()

  // Sariq chiziq yetaklagan panel pastdan ko'tariladi
  const wipe = interp(f, [0, 14], [1920, 0], ease.outExpo)
  const carouselOut = interp(f, [GRID_AT - 4, GRID_AT + 10], [0, 1], ease.in)

  return (
    <div style={{ position: 'absolute', inset: 0, clipPath: `inset(${wipe}px 0 0 0)` }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${C.cream} 0%, #fdefc8 100%)` }} />
      {/* Fon naqshi */}
      <div
        style={{
          position: 'absolute', inset: -200, opacity: 0.35,
          background: 'radial-gradient(circle, rgba(10,122,61,0.18) 3px, transparent 4px) 0 0 / 46px 46px',
          transform: `translateY(${-f * 0.6}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute', left: -120, top: 1180, fontFamily: FONT_DISPLAY, fontSize: 420, color: 'rgba(10,122,61,0.06)',
          transform: `rotate(-12deg) translateX(${-f * 1.2}px)`, whiteSpace: 'nowrap',
        }}
      >
        MUSA MUSA MUSA
      </div>
      {/* Yetakchi sariq chiziq — panel qirrasida (kesilgan hudud ichida qolsin) */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: wipe, height: 18, background: C.yellow, opacity: interp(f, [10, 18], [1, 0]) }} />

      {/* Sarlavha */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center' }}>
        <div style={{ transform: `scale(${Math.max(0, spring(f - 8, { stiffness: 200, damping: 15 }))})`, display: 'inline-block' }}>
          <Chip bg={C.green}>🛒  Katalog</Chip>
        </div>
        <Words
          text="Sevimli mahsulotlar"
          start={12}
          stagger={5}
          style={{ fontFamily: FONT_DISPLAY, fontSize: 96, color: C.green, marginTop: 26, lineHeight: 1.05 }}
        />
      </div>

      {/* Karusel */}
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - carouselOut, transform: `scale(${1 - carouselOut * 0.25})` }}>
        {ITEMS.map((item, i) => {
          const enter = spring(f - STARTS[i], { stiffness: 150, damping: 16 })
          const back = spring(f - (STARTS[i + 1] ?? GRID_AT), { stiffness: 140, damping: 18 })
          const gone = spring(f - (STARTS[i + 2] ?? GRID_AT + 40), { stiffness: 140, damping: 20 })
          if (f < STARTS[i] - 1) return null
          const x = (1 - enter) * 1050 - back * 430 - gone * 700
          const rot = (1 - enter) * 16 - back * 9
          const sc = 1 - back * 0.3
          const op = 1 - back * 0.45 - gone * 0.55
          const tag = spring(f - STARTS[i] - 9, { stiffness: 220, damping: 12 })
          const chipIn = interp(f - STARTS[i], [4, 12], [0, 1]) * (1 - interp(f - (STARTS[i + 1] ?? 999), [0, 6], [0, 1]))
          return (
            <div key={i}>
              {/* Kategoriya yorlig'i */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 630, textAlign: 'center', opacity: chipIn, transform: `translateY(${(1 - chipIn) * 20}px)` }}>
                <Chip bg="#fff" color={C.green} style={{ boxShadow: '0 10px 24px rgba(10,122,61,0.15)' }}>{item.chip}</Chip>
              </div>
              <div
                style={{
                  position: 'absolute', left: 540 - 340, top: 740,
                  transform: `translateX(${x}px) rotate(${rot}deg) scale(${sc})`,
                  opacity: op, zIndex: 10 - (back > 0.5 ? 5 : 0),
                }}
              >
                <Card src={item.src} width={680} height={800} pad={40} imgStyle={{ height: 560 }}>
                  <div
                    style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, padding: '26px 40px',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #fff 30%)',
                      fontFamily: FONT, fontWeight: 800, fontSize: 52, color: C.ink,
                    }}
                  >
                    {item.name}
                  </div>
                </Card>
                <div style={{ position: 'absolute', right: -40, bottom: -46 }}>
                  <PriceTag value={formatSum(item.price)} scale={Math.max(0, tag)} rotate={-7} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 3×3 to'r */}
      {f >= GRID_AT && (
        <div style={{ position: 'absolute', left: 540 - 420, top: 640, width: 840, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
          {GRID.map((name, i) => {
            const p = spring(f - GRID_AT - 2 - i * 2, { stiffness: 230, damping: 15 })
            return (
              <div key={name} style={{ transform: `scale(${Math.max(0, p)}) rotate(${(1 - p) * (i % 2 ? 10 : -10)}deg)` }}>
                <Card src={`/${name}.webp`} width={260} height={260} radius={32} pad={16} style={{ boxShadow: '0 16px 30px rgba(8,40,20,0.18)' }} />
              </div>
            )
          })}
        </div>
      )}
      {f >= GRID_AT + 6 && (() => {
        const p = spring(f - GRID_AT - 6, { stiffness: 180, damping: 14 })
        const n = Math.round(interp(f, [GRID_AT + 6, GRID_AT + 34], [0, 150], ease.out))
        return (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, top: 1560, display: 'flex', justifyContent: 'center',
              transform: `translateY(${(1 - p) * 60}px)`, opacity: Math.min(1, p),
            }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'baseline', gap: 18, padding: '18px 44px', borderRadius: 999,
                background: C.green, color: '#fff', boxShadow: '0 20px 40px rgba(10,122,61,0.35)',
              }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 92, color: C.yellow }}>{n}+</span>
              <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 48 }}>xil mahsulot</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
