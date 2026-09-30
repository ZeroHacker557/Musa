import { ease, interp, spring } from '../anim'
import { useFrame } from '../frame'
import { C, FONT, Logo, Rays, Snow, Words } from '../components'

/**
 * 2-sahna (4–8 s): MUSA logotipi, «Muzlatilgan mahsulotlar — uyingizgacha»,
 * pastdan uchayotgan mahsulotlar (hero rasm) ko'tariladi.
 */
export function Brand() {
  const f = useFrame()

  const logoIn = spring(f - 6, { stiffness: 150, damping: 12 })
  const logoRot = interp(logoIn, [0, 1], [-14, 0])
  const logoY = interp(f, [6, 60], [470, 420], ease.out)
  const shine = interp(f, [34, 58], [0, 1], ease.inOut)

  const pill = spring(f - 58, { stiffness: 200, damping: 14 })
  const underline = interp(f, [66, 84], [0, 1], ease.out)

  const heroY = interp(f, [62, 108], [1300, 930], ease.outExpo)
  const bob = Math.sin(f / 14) * 10
  const exitZoom = interp(f, [108, 120], [1, 1.12], ease.in)

  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${exitZoom})` }}>
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(90% 60% at 50% 32%, ${C.greenBright} 0%, ${C.green} 45%, ${C.greenDeep} 100%)`,
        }}
      />
      <Rays opacity={0.16} y={560} speed={0.25} />
      <Snow count={55} opacity={0.7} speed={0.8} seed={9} />

      {/* Logotip */}
      <div
        style={{
          position: 'absolute', left: 190, top: logoY - 125,
          transform: `scale(${Math.max(0, logoIn)}) rotate(${logoRot}deg)`,
          transformOrigin: '350px 125px',
        }}
      >
        <Logo shine={shine} />
      </div>

      {/* Shior */}
      <div style={{ position: 'absolute', left: 40, right: 40, top: 640, textAlign: 'center' }}>
        <Words
          text="Muzlatilgan mahsulotlar"
          start={36}
          stagger={4}
          style={{ fontFamily: FONT, fontWeight: 800, fontSize: 70, color: '#fff', letterSpacing: -0.5 }}
          wordStyle={{ textShadow: '0 6px 20px rgba(0,0,0,0.25)' }}
        />
        <div style={{ marginTop: 26, display: 'inline-block', transform: `scale(${Math.max(0, pill)})` }}>
          <div
            style={{
              position: 'relative', padding: '14px 44px', borderRadius: 999, background: C.yellow,
              fontFamily: FONT, fontWeight: 900, fontSize: 64, color: C.greenDeep,
              boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
            }}
          >
            uyingizgacha yetkaziladi
            <div
              style={{
                position: 'absolute', left: 44, right: 44, bottom: 12, height: 6, borderRadius: 3,
                background: C.greenDeep, transformOrigin: 'left', transform: `scaleX(${underline})`, opacity: 0.35,
              }}
            />
          </div>
        </div>
      </div>

      {/* Uchayotgan mahsulotlar */}
      <img
        src="/hero-products.webp"
        style={{
          position: 'absolute', left: 540 - 380, top: heroY + bob, width: 760,
          filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.35))',
        }}
      />
    </div>
  )
}
