import QRCode from 'qrcode'
import { beatPulse, ease, interp, spring } from '../anim'
import { useFrame } from '../frame'
import { Burst, C, FONT, FONT_DISPLAY, Logo, Rays, Snow, Words } from '../components'
import { TgIcon } from './Features'

/**
 * 6-sahna (34–40 s): «Hozir buyurtma bering!» — @musauz_bot tugmasi zarbga
 * mos «uradi», QR kod skanerlanadi. 38-soniyada yakuniy akkord bilan
 * logotipdan uchqun.
 */

const BOT_URL = 'https://t.me/musauz_bot'
const QR = QRCode.create(BOT_URL, { errorCorrectionLevel: 'H' })
const QR_SIZE = QR.modules.size

function QrCode({ px }: { px: number }) {
  const cell = px / QR_SIZE
  const rects = []
  for (let r = 0; r < QR_SIZE; r++) {
    for (let c = 0; c < QR_SIZE; c++) {
      if (QR.modules.get(r, c)) rects.push(<rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell + 0.4} height={cell + 0.4} />)
    }
  }
  return (
    <svg width={px} height={px} style={{ display: 'block' }}>
      <g fill={C.ink}>{rects}</g>
    </svg>
  )
}

/** Oxirgi kadrgacha global kadr (zarbga moslash uchun). */
const GLOBAL_START = 1020

export function Cta() {
  const f = useFrame()
  const g = f + GLOBAL_START

  const logo = spring(f - 4, { stiffness: 160, damping: 13 })
  const shine = interp(f, [120, 140], [0, 1], ease.inOut)
  const btn = spring(f - 36, { stiffness: 200, damping: 13 })
  const beat = f >= 48 ? beatPulse(g, 0, 5) : 0
  const qr = spring(f - 50, { stiffness: 170, damping: 14 })
  const scan = f >= 62 ? ((f - 62) % 40) / 40 : -1
  // Oxirida juda yengil yaqinlashish (kichraysa chetlar ochilib qolardi)
  const settle = interp(f, [120, 180], [1, 1.02], ease.inOut)

  return (
    <div style={{ position: 'absolute', inset: 0, transform: `scale(${settle})` }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(90% 60% at 50% 38%, ${C.greenBright} 0%, ${C.green} 45%, ${C.greenDeep} 100%)` }} />
      <Rays opacity={0.13} y={700} speed={0.2} />
      <Snow count={50} opacity={0.6} speed={0.7} seed={33} />

      <div style={{ position: 'absolute', left: 540 - 350, top: 130, transform: `scale(${Math.max(0, logo) * 0.62})`, transformOrigin: '350px 125px' }}>
        <Logo shine={shine} />
      </div>
      <Burst at={120} x={540} y={255} count={24} radius={420} />

      <div style={{ position: 'absolute', left: 40, right: 40, top: 390, textAlign: 'center' }}>
        <Words
          text="Hozir buyurtma bering!"
          start={14}
          stagger={5}
          style={{ fontFamily: FONT_DISPLAY, fontSize: 118, color: '#fff', lineHeight: 1.04 }}
          wordStyle={{ textShadow: '0 10px 30px rgba(0,0,0,0.25)' }}
          highlight={{ buyurtma: { color: C.yellow } }}
        />
      </div>

      {/* Telegram tugmasi */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 830, display: 'flex', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 26, padding: '26px 56px 26px 30px', borderRadius: 999, background: '#fff',
            boxShadow: `0 24px 50px rgba(0,0,0,0.3), 0 0 0 ${10 + beat * 16}px rgba(255,212,59,${0.25 * beat + 0.12})`,
            transform: `scale(${Math.max(0, btn) * (1 + beat * 0.045)})`,
          }}
        >
          <TgIcon size={104} />
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 74, color: C.ink, letterSpacing: -1 }}>@musauz_bot</span>
        </div>
      </div>

      {/* QR */}
      <div style={{ position: 'absolute', left: 540 - 230, top: 1070, transform: `scale(${Math.max(0, qr)}) rotate(${(1 - Math.min(1, qr)) * 12}deg)` }}>
        <div style={{ width: 460, height: 460, borderRadius: 48, background: '#fff', padding: 40, boxShadow: '0 30px 60px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}>
          <QrCode px={380} />
          <div style={{ position: 'absolute', left: 230 - 62, top: 230 - 62, width: 124, height: 124, borderRadius: 30, background: '#fff', display: 'grid', placeItems: 'center' }}>
            <img src="/musa-mark.webp" style={{ width: 104, height: 104, borderRadius: 24 }} />
          </div>
          {scan >= 0 && (
            <div
              style={{
                position: 'absolute', left: 20, right: 20, top: 30 + ease.inOut(scan < 0.5 ? scan * 2 : 2 - scan * 2) * 400, height: 6, borderRadius: 3,
                background: C.greenBright, boxShadow: `0 0 24px 8px rgba(20,163,82,0.45)`,
              }}
            />
          )}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1566, textAlign: 'center', opacity: interp(f, [62, 74], [0, 1]), fontFamily: FONT, fontWeight: 800, fontSize: 44, color: '#fff' }}>
        📷 Skanerlang yoki Telegram’da qidiring
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1640, textAlign: 'center', opacity: interp(f, [80, 94], [0, 0.8]), fontFamily: FONT, fontWeight: 700, fontSize: 36, color: '#e6ffe9' }}>
        Muzlatilgan mahsulotlar — uyingizgacha ❄️
      </div>
    </div>
  )
}
