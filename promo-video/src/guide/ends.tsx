import QRCode from 'qrcode'
import { beatPulse, ease, interp, rand, spring } from '../anim'
import { useFrame } from '../frame'
import { Burst, C, FONT, FONT_DISPLAY, Logo, Rays, Snow } from '../components'
import { TgIcon } from '../scenes/Features'
import { SCENES, sec } from './timeline'

/** Kirish: bo'sh muzlatkich → MUSA → «bir necha bosishda!» */
export function Hook() {
  const f = useFrame()
  if (f > SCENES.hook[1] + 6) return null
  const door = interp(f, [6, 26], [0, 1], ease.outBack)
  const w1 = spring(f - 4, { stiffness: 220, damping: 14 })
  const w2 = spring(f - 20, { stiffness: 220, damping: 12 })
  const swap = interp(f, [sec(1.85), sec(2.1)], [0, 1], ease.inOut)
  const logo = spring(f - sec(2.0), { stiffness: 190, damping: 12 })
  const sub = spring(f - sec(2.4), { stiffness: 200, damping: 14 })
  const taps = spring(f - sec(3.4), { stiffness: 200, damping: 12 })
  const out = interp(f, [sec(4.3), sec(4.85)], [0, 1], ease.in)
  const mist = (i: number) => ((f * (0.6 + rand(i) * 0.6) + rand(i + 3) * 100) % 100) / 100
  const items = ['/chuchvara.webp', '/kotlet.webp', '/somsa.webp', '/dubai.webp']
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, opacity: 1 - out, transform: `scale(${1 + out * 0.15})`, fontFamily: FONT }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 60% at 50% 35%, #12693a 0%, ${C.greenDeep} 55%, #022012 100%)` }} />
      <Snow count={50} opacity={0.5} seed={3} />

      {/* 1-qism: muzlatkich */}
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - swap, transform: `translateY(${-swap * 120}px) scale(${1 - swap * 0.1})` }}>
        <div style={{ position: 'absolute', left: 290, top: 250, width: 500, height: 760, perspective: 1800 }}>
          {/* Ichki qism */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 44, background: 'linear-gradient(180deg, #f2fbff, #cfe6f2)', boxShadow: 'inset 0 0 60px rgba(120,180,220,0.6), 0 40px 80px rgba(0,0,0,0.45)', border: '10px solid #e9eef2' }}>
            <div style={{ position: 'absolute', left: 190, top: 20, width: 120, height: 34, borderRadius: 20, background: '#fff8c4', boxShadow: `0 0 ${40 + door * 60}px rgba(255,240,170,${0.4 + door * 0.5})` }} />
            {[230, 420, 600].map((y) => <div key={y} style={{ position: 'absolute', left: 30, right: 30, top: y, height: 10, borderRadius: 5, background: 'rgba(160,200,225,0.9)' }} />)}
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', left: 60 + rand(i) * 300, top: 640 - mist(i) * 520, width: 90, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', filter: 'blur(14px)', opacity: Math.sin(mist(i) * Math.PI) * door }} />
            ))}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center', fontSize: 92, opacity: door, transform: `rotate(${Math.sin(f / 6) * 6}deg)` }}>🥲</div>
          </div>
          {/* Eshik */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: 44, background: 'linear-gradient(135deg, #ffffff, #dfe7ec)', border: '10px solid #e9eef2', transformOrigin: 'left center', transform: `rotateY(${-door * 105}deg)`, boxShadow: '0 30px 60px rgba(0,0,0,0.35)', backfaceVisibility: 'hidden' }}>
            <div style={{ position: 'absolute', right: 40, top: 300, width: 18, height: 160, borderRadius: 9, background: '#b9c4cc' }} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1110, textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 92, color: '#fff', transform: `scale(${w1})`, textShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>Muzlatkichingiz</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 104, color: C.yellow, marginTop: 6, transform: `scale(${w2}) rotate(${(1 - w2) * -6}deg)`, textShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>bo‘shab qoldimi?</div>
        </div>
      </div>

      {/* 2-qism: MUSA va «bir necha bosishda» */}
      {f >= sec(1.9) && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Rays opacity={0.12 * swap} />
          <div style={{ position: 'absolute', left: 190, top: 380, transform: `scale(${Math.max(0, logo)}) rotate(${(1 - logo) * -8}deg)` }}><Logo scale={1} shine={interp(f, [sec(2.6), sec(3.2)], [0, 1])} /></div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 690, textAlign: 'center', fontFamily: FONT_DISPLAY, fontSize: 80, color: '#fff', opacity: Math.max(0, sub), transform: `translateY(${(1 - sub) * 60}px)` }}>buyurtma berish</div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 1240, textAlign: 'center', fontFamily: FONT_DISPLAY, fontSize: 96, color: C.yellow, transform: `scale(${Math.max(0, taps)})`, textShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>bir necha<br />bosishda!</div>
          {items.map((src, i) => {
            const p = spring(f - sec(2.5) - i * 3, { stiffness: 170, damping: 12 })
            const a = (i / items.length) * Math.PI * 2 + f / 40
            return <img key={src} src={src} style={{ position: 'absolute', left: 540 + Math.cos(a) * 400 - 110, top: 1010 + Math.sin(a) * 120 - 110, width: 220, height: 220, objectFit: 'contain', transform: `scale(${Math.max(0, p)})`, filter: 'drop-shadow(0 16px 24px rgba(0,0,0,0.35))' }} />
          })}
          {[[300, 1200], [780, 1260], [540, 1480]].map(([x, y], i) => {
            const l = f - sec(3.45) - i * 5
            if (l < 0 || l > 22) return null
            const k = ease.out(l / 22)
            return <div key={i} style={{ position: 'absolute', left: x - 90, top: y - 90, width: 180, height: 180, borderRadius: '50%', border: '8px solid rgba(255,215,106,0.9)', opacity: 1 - k, transform: `scale(${0.3 + k})` }} />
          })}
          <Burst at={sec(3.45)} x={540} y={1340} color={C.yellow} radius={380} />
        </div>
      )}
    </div>
  )
}

const BOT_URL = 'https://t.me/musauz_bot'
const QR = QRCode.create(BOT_URL, { errorCorrectionLevel: 'H' })

function QrCode({ px }: { px: number }) {
  const n = QR.modules.size
  const cell = px / n
  const rects = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (QR.modules.get(r, c)) rects.push(<rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.4} height={cell + 0.4} />)
  return <svg width={px} height={px} style={{ display: 'block' }}><g fill={C.ink}>{rects}</g></svg>
}

/** Yakun: MUSA, shior, @musauz_bot va QR. */
export function Cta() {
  const f = useFrame()
  const at = SCENES.cta[0]
  const l = f - at
  if (l < -4) return null
  const bg = interp(l, [-4, 8], [0, 1])
  const logo = spring(l - 4, { stiffness: 170, damping: 12 })
  const t1 = spring(l - 12, { stiffness: 190, damping: 14 })
  const t2 = spring(f - sec(68.45), { stiffness: 220, damping: 11 })
  const btn = spring(f - sec(69.6), { stiffness: 200, damping: 12 })
  const qr = spring(f - sec(70.0), { stiffness: 170, damping: 14 })
  const beat = f > sec(70.2) ? beatPulse(f, 0, 6) : 0
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, opacity: bg, fontFamily: FONT }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 60% at 50% 38%, ${C.greenBright} 0%, ${C.green} 45%, ${C.greenDeep} 100%)` }} />
      <Rays opacity={0.16} y={560} />
      <Snow count={60} opacity={0.6} seed={9} />
      <div style={{ position: 'absolute', left: 190, top: 280, transform: `scale(${Math.max(0, logo)})` }}><Logo shine={interp(l, [30, 54], [0, 1])} /></div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 600, textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 64, lineHeight: 1.15, opacity: Math.max(0, t1), transform: `translateY(${(1 - t1) * 50}px)` }}>Sifatli muzlatilgan mahsulotlar</div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 770, textAlign: 'center', fontFamily: FONT_DISPLAY, fontSize: 92, color: C.yellow, transform: `scale(${Math.max(0, t2)})`, textShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>uyingizgacha!</div>
      <div style={{ position: 'absolute', left: 140, right: 140, top: 1000, height: 150, borderRadius: 80, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, transform: `scale(${Math.max(0, btn) * (1 + beat * 0.04)})`, boxShadow: `0 24px 60px rgba(0,0,0,0.35), 0 0 0 ${beat * 18}px rgba(255,215,106,${beat * 0.5})` }}>
        <TgIcon size={92} />
        <span style={{ fontWeight: 900, fontSize: 64, color: C.ink }}>@musauz_bot</span>
      </div>
      <div style={{ position: 'absolute', left: 540 - 190, top: 1230, width: 380, padding: 26, borderRadius: 40, background: '#fff', transform: `scale(${Math.max(0, qr)}) rotate(${(1 - qr) * 8}deg)`, boxShadow: '0 24px 60px rgba(0,0,0,0.35)', textAlign: 'center' }}>
        <QrCode px={328} />
        <div style={{ fontWeight: 900, fontSize: 30, color: C.green, marginTop: 14 }}>Skanerlang</div>
      </div>
      <Burst at={sec(68.45)} x={540} y={830} color={C.yellow} radius={420} seed={11} />
    </div>
  )
}
