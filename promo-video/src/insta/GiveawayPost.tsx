import type { ReactNode } from 'react'
import { rand } from '../anim'
import { C, FONT, FONT_DISPLAY, Logo } from '../components'
import { TgIcon } from '../scenes/Features'
import { OQUV, Product } from './Panorama'

/**
 * Konkurs e'loni — bot foydalanuvchilariga ommaviy xabar rasmi (1080×1350).
 * Render: node scripts/insta.mjs --comp gwpost → out/insta/konkurs-post.jpg
 */

export const POST_W = 1080
export const POST_H = 1350

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 12px 20px', borderRadius: 28, background: 'rgba(255,255,255,0.96)', boxShadow: '0 16px 30px -14px rgba(0,0,0,0.5)', textAlign: 'center' }}>
      <div style={{ width: 58, height: 58, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: FONT_DISPLAY, fontSize: 32, color: '#3a2a00', background: 'radial-gradient(circle at 35% 30%, #fff6c9, #ffd43b 50%, #f2b400)' }}>{n}</div>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 27, lineHeight: 1.15, color: C.ink }}>{children}</div>
    </div>
  )
}

export function GiveawayPost() {
  return (
    <div style={{ position: 'relative', width: POST_W, height: POST_H, overflow: 'hidden', fontFamily: FONT }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(700px 620px at 540px 640px, rgba(60,210,120,0.6), transparent 72%), linear-gradient(180deg, #075f30 0%, #0a7a3d 45%, #04502a 100%)' }} />
      <div style={{ position: 'absolute', left: 540 - 1200, top: 640 - 1200, width: 2400, height: 2400, background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.07) 0deg 6deg, transparent 6deg 18deg)', maskImage: 'radial-gradient(circle, #000 0%, transparent 50%)', WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 50%)' }} />
      <svg width={POST_W} height={POST_H} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 70 }, (_, i) => {
          const x = rand(i * 7 + 3) * POST_W
          const y = rand(i * 11 + 1) * POST_H
          const s = 2 + rand(i * 5) * 5
          return i % 8 === 0
            ? <text key={i} x={x} y={y} fontSize={24 + s * 4} fill="#fff" opacity={0.2}>❄</text>
            : <circle key={i} cx={x} cy={y} r={s / 2} fill="#fff" opacity={0.2 + rand(i) * 0.4} />
        })}
      </svg>

      {/* Sarlavha */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', width: 294, height: 105, flexShrink: 0 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transform: 'scale(0.42)', transformOrigin: '0 0' }}><Logo /></div>
        </div>
        <div style={{ padding: '12px 30px', borderRadius: 999, background: 'linear-gradient(180deg, #ff5a4a, #d42a1e)', border: '4px solid #fff', color: '#fff', fontFamily: FONT_DISPLAY, fontSize: 44, letterSpacing: 3, boxShadow: '0 12px 26px -10px rgba(120,0,0,0.7)', transform: 'rotate(-3deg)' }}>🎁 KONKURS</div>
      </div>
      <div style={{ position: 'absolute', top: 190, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 64, color: '#fff', letterSpacing: 1 }}>5 kishiga</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 132, lineHeight: 1, color: C.yellow, textShadow: '0 12px 34px rgba(0,30,15,0.55)' }}>SET SOVG‘A!</div>
        <div style={{ marginTop: 14, display: 'inline-block', padding: '10px 26px', borderRadius: 18, background: 'rgba(0,35,18,0.6)', fontFamily: FONT, fontWeight: 800, fontSize: 32, color: '#fff' }}>
          «Sog‘lom O‘quv Mavsumi» seti · 9 ta mahsulot
        </div>
      </div>

      {/* Set kollaji */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1440, transform: 'translateY(-14px) scale(0.78)', transformOrigin: '540px 820px' }}>
        <div style={{ position: 'absolute', left: 120, right: 120, top: 640, height: 480, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%)' }} />
        {OQUV.map((item) => <Product key={item.id} item={item} />)}
      </div>

      {/* Qanday qatnashiladi */}
      <div style={{ position: 'absolute', left: 50, right: 50, top: 1000, display: 'flex', gap: 16 }}>
        <Step n={1}>Botda <span style={{ color: C.green }}>START</span> bosing</Step>
        <Step n={2}>Do‘stlarni taklif qiling — imkoniyat oshadi</Step>
        <Step n={3}>9-noyabr — g‘oliblar aniqlanadi</Step>
      </div>

      {/* Sana va bot */}
      <div style={{ position: 'absolute', left: 50, right: 50, top: 1222, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ padding: '18px 24px', borderRadius: 24, background: C.yellow, color: '#3a2a00', fontFamily: FONT, fontWeight: 900, fontSize: 30, boxShadow: '0 12px 24px -12px rgba(0,0,0,0.5)' }}>26.10 — 09.11</div>
        <div style={{ flex: 1, height: 76, borderRadius: 40, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, boxShadow: '0 12px 24px -12px rgba(0,0,0,0.5)' }}>
          <TgIcon size={52} />
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 40, color: C.ink }}>@musauz_bot</span>
        </div>
      </div>
    </div>
  )
}
