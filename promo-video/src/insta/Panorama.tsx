import type { CSSProperties, ReactNode } from 'react'
import { rand } from '../anim'
import { C, FONT, FONT_DISPLAY, Logo } from '../components'
import { TgIcon } from '../scenes/Features'

/**
 * Instagram profili uchun 3 ta ulanib ketadigan post (panorama 3240×1440,
 * har biri 1080×1440 — profil to'ri 3:4). Chapda va o'ngda setlar,
 * o'rtada brend va @musauz_bot. Uchalasini lenta, muz to'lqini va qor
 * bog'lab turadi; har post alohida ochilganda ham to'liq tushunarli.
 *
 * Render: node scripts/insta.mjs → out/insta/*.jpg
 */

export const PANO_W = 3240
export const PANO_H = 1440
const TILE = 1080

const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ')

/** Mahsulot (fonsiz PNG): markaz x,y, balandlik h, burilish r. */
type Item = { id: string; x: number; y: number; h: number; r?: number; z?: number; ratio: number }

const RATIO: Record<string, number> = {
  13756: 1.09, 199270: 1.3, 251840: 1.29, 271876: 1.46, 367803: 0.99, 487486: 1.08, 503162: 1.08, 513048: 1.49,
  640530: 1.03, 641125: 0.77, 676088: 1.07, 724060: 0.91, 899019: 1.54, 913164: 1.01,
}
const it = (id: string, x: number, y: number, h: number, r = 0, z = 1): Item => ({ id, x, y, h, r, z, ratio: RATIO[id] })

export const OQUV: Item[] = [
  it('899019', 235, 575, 225, -8), it('487486', 525, 548, 320, 3), it('503162', 825, 572, 300, 8),
  it('724060', 175, 772, 290, -7, 2), it('641125', 405, 790, 330, -3, 2), it('271876', 670, 785, 235, 5, 2), it('640530', 905, 778, 260, 9, 2),
  it('367803', 330, 968, 280, -5, 3), it('513048', 700, 978, 220, 4, 3),
]
const DASTURXON: Item[] = [
  it('676088', 225, 560, 300, -7), it('487486', 520, 540, 290, 3), it('913164', 830, 565, 285, 8),
  it('724060', 140, 755, 275, -8, 2), it('641125', 350, 775, 310, -3, 2), it('271876', 610, 770, 220, 4, 2), it('640530', 875, 765, 245, 7, 2),
  it('367803', 165, 950, 245, -6, 3), it('513048', 425, 965, 195, -2, 3), it('251840', 685, 958, 215, 5, 3), it('199270', 935, 950, 205, 8, 3),
  it('13756', 545, 1068, 165, -4, 4),
]

export function Product({ item, dx = 0 }: { item: Item; dx?: number }) {
  const w = item.h * item.ratio
  return (
    <img
      src={`/insta/cut/${item.id}.png`}
      style={{
        position: 'absolute', left: dx + item.x - w / 2, top: item.y - item.h / 2, width: w, height: item.h,
        transform: `rotate(${item.r ?? 0}deg)`, zIndex: 10 + (item.z ?? 1),
        filter: 'drop-shadow(0 18px 22px rgba(0,25,12,0.45)) drop-shadow(0 3px 4px rgba(0,25,12,0.3))',
      }}
    />
  )
}

function Abs({ children, style }: { children?: ReactNode; style: CSSProperties }) {
  return <div style={{ position: 'absolute', ...style }}>{children}</div>
}

/** Narx yorlig'i: eski narx (ustidan chizilgan), yangi narx va tejash doirasi. */
function PriceTag({ price, old, side }: { price: number; old: number; side: 'left' | 'right' }) {
  const save = old - price
  const left = side === 'left'
  return (
    <Abs style={{ top: 1118, [left ? 'left' : 'right']: 64, zIndex: 30 } as CSSProperties}>
      <div style={{ position: 'relative', transform: `rotate(${left ? -4 : 4}deg)`, textAlign: left ? 'left' : 'right' }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 38, color: '#fff', [left ? 'marginLeft' : 'marginRight']: 22, position: 'relative', display: 'inline-block', padding: '4px 18px', borderRadius: 14, background: 'rgba(0,35,18,0.72)' }}>
          {fmt(old)} so‘m
          <span style={{ position: 'absolute', left: 8, right: 8, top: '50%', height: 5, borderRadius: 3, background: '#ff5a4a', transform: 'rotate(-6deg)' }} />
        </div>
        <div style={{ marginTop: 6, padding: '14px 36px 18px', borderRadius: 34, background: 'linear-gradient(180deg, #ff5a4a, #d42a1e)', boxShadow: '0 22px 40px -14px rgba(120,0,0,0.7), inset 0 -8px 0 rgba(0,0,0,0.18), inset 0 6px 0 rgba(255,255,255,0.25)', border: '5px solid #fff', display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 112, color: '#fff', lineHeight: 1, letterSpacing: -1 }}>{fmt(price)}</span>
          <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 42, color: '#fff' }}>so‘m</span>
        </div>
        <div style={{ position: 'absolute', top: -96, [left ? 'right' : 'left']: -110, width: 172, height: 172, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff6c9, #ffd43b 45%, #f2b400)', border: '5px solid #fff', boxShadow: '0 16px 30px -10px rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', textAlign: 'center', transform: `rotate(${left ? 10 : -10}deg)`, color: '#5a3b00' } as CSSProperties}>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 22, lineHeight: 1.1 }}>
            TEJANG<br />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 34 }}>{fmt(save)}</span><br />so‘m
          </div>
        </div>
      </div>
    </Abs>
  )
}

/** Set posti (chap yoki o'ng). */
function SetTile({ dx, chip, title1, title2, count, items, price, old, side }: {
  dx: number; chip: string; title1: string; title2: string; count: number; items: Item[]; price: number; old: number; side: 'left' | 'right'
}) {
  return (
    <div style={{ position: 'absolute', left: dx, top: 0, width: TILE, height: PANO_H }}>
      <Abs style={{ top: 92, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 30px', borderRadius: 999, background: 'rgba(255,255,255,0.96)', color: C.green, fontFamily: FONT, fontWeight: 900, fontSize: 34, letterSpacing: 2, boxShadow: '0 14px 30px -12px rgba(0,0,0,0.45)' }}>
          {chip}
        </div>
      </Abs>
      <Abs style={{ top: 190, left: 0, right: 0, textAlign: 'center', zIndex: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 118, lineHeight: 1, color: '#fff', textShadow: '0 10px 30px rgba(0,30,15,0.5)' }}>{title1}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 104, lineHeight: 1.08, color: C.yellow, textShadow: '0 10px 30px rgba(0,30,15,0.5)' }}>{title2}</div>
        <div style={{ marginTop: 10, fontFamily: FONT, fontWeight: 800, fontSize: 36, color: 'rgba(255,255,255,0.9)' }}>SET · {count} ta mahsulot</div>
      </Abs>
      {/* Mahsulotlar «orolchasi» — ostida yorug' dog' */}
      <Abs style={{ left: 90, right: 90, top: 640, height: 520, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,255,255,0.32), rgba(255,255,255,0) 70%)', zIndex: 5 }} />
      {/* Kollaj sarlavha va narx orasiga sig'sin */}
      <div style={{ position: 'absolute', inset: 0, transform: 'translateY(34px) scale(0.86)', transformOrigin: '540px 780px', zIndex: 12 }}>
        {items.map((item) => <Product key={item.id + item.x} item={item} />)}
      </div>
      <PriceTag price={price} old={old} side={side} />
    </div>
  )
}

/** O'rtadagi brend posti. */
function CenterTile() {
  return (
    <div style={{ position: 'absolute', left: TILE, top: 0, width: TILE, height: PANO_H }}>
      <Abs style={{ top: 96, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <div style={{ transform: 'scale(0.86)' }}><Logo /></div>
      </Abs>
      <Abs style={{ top: 410, left: 0, right: 0, textAlign: 'center', zIndex: 20 }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 70, letterSpacing: 10, color: '#fff' }}>AKSIYADAGI</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 236, lineHeight: 0.95, color: C.yellow, textShadow: '0 14px 40px rgba(0,30,15,0.55), 0 0 60px rgba(255,212,59,0.35)' }}>SETLAR</div>
        <div style={{ marginTop: 26, fontFamily: FONT, fontWeight: 800, fontSize: 44, lineHeight: 1.3, color: 'rgba(255,255,255,0.95)' }}>
          Bitta narx — ko‘p mahsulot.<br />Tejab xarid qiling!
        </div>
      </Abs>
      {/* Ikki tomonga ishora — qo'shni postlar */}
      <Abs style={{ top: 905, left: 60, right: 60, display: 'flex', justifyContent: 'space-between', zIndex: 20 }}>
        {[['◀', 'Maktab mavsumi'], ['Mehmon kutish', '▶']].map(([a, b], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderRadius: 999, border: '3px solid rgba(255,255,255,0.55)', color: '#fff', fontFamily: FONT, fontWeight: 800, fontSize: 32, background: 'rgba(0,40,20,0.25)' }}>
            {i === 0 ? <><span style={{ color: C.yellow }}>{a}</span>{b}</> : <>{a}<span style={{ color: C.yellow }}>{b}</span></>}
          </div>
        ))}
      </Abs>
      <Abs style={{ top: 1090, left: 110, right: 110, height: 150, borderRadius: 80, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, boxShadow: '0 26px 50px -16px rgba(0,0,0,0.55), 0 0 0 10px rgba(255,212,59,0.35)', zIndex: 30 }}>
        <TgIcon size={92} />
        <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 66, color: C.ink }}>@musauz_bot</span>
      </Abs>
      <Abs style={{ top: 1366, left: 0, right: 0, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 32, letterSpacing: 1, color: C.green, zIndex: 30 }}>
        🚚 Uyingizgacha muzdek yetkazamiz ❄️
      </Abs>
    </div>
  )
}

/** Qor uchqunlari (butun panorama bo'ylab). */
function Sparkles() {
  return (
    <svg width={PANO_W} height={PANO_H} style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
      {Array.from({ length: 150 }, (_, i) => {
        const x = rand(i * 7 + 1) * PANO_W
        const y = rand(i * 13 + 5) * PANO_H
        const s = 2 + rand(i * 3 + 9) * 6
        return i % 9 === 0
          ? <text key={i} x={x} y={y} fontSize={22 + s * 4} fill="#fff" opacity={0.18 + rand(i) * 0.2}>❄</text>
          : <circle key={i} cx={x} cy={y} r={s / 2} fill="#fff" opacity={0.15 + rand(i * 5) * 0.45} />
      })}
    </svg>
  )
}

export function Panorama() {
  return (
    <div style={{ position: 'relative', width: PANO_W, height: PANO_H, overflow: 'hidden', fontFamily: FONT }}>
      {/* Yagona fon: chetlari to'q, har post markazida yorug'lik */}
      <div style={{ position: 'absolute', inset: 0, background: `
        radial-gradient(560px 620px at 540px 760px, rgba(40,190,105,0.55), transparent 70%),
        radial-gradient(640px 700px at 1620px 640px, rgba(60,210,120,0.6), transparent 72%),
        radial-gradient(560px 620px at 2700px 760px, rgba(40,190,105,0.55), transparent 70%),
        linear-gradient(90deg, #033d1f 0%, #075f30 22%, #0a7a3d 50%, #075f30 78%, #033d1f 100%)` }} />
      {/* Nozik naqsh */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 2px)', backgroundSize: '34px 34px' }} />
      {/* Nurlar o'rtadan */}
      <div style={{ position: 'absolute', left: 1620 - 1400, top: 700 - 1400, width: 2800, height: 2800, background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.06) 0deg 6deg, transparent 6deg 18deg)', maskImage: 'radial-gradient(circle, #000 0%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 55%)' }} />
      <Sparkles />

      {/* Uchala postni bog'laydigan oltin lenta */}
      <svg width={PANO_W} height={PANO_H} style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
        <defs>
          <linearGradient id="gold" x1="0" x2="1">
            <stop offset="0" stopColor="#f2b400" />
            <stop offset="0.5" stopColor="#ffe27a" />
            <stop offset="1" stopColor="#f2b400" />
          </linearGradient>
        </defs>
        <path d="M-40 1190 C 420 1080, 760 1330, 1080 1230 S 1700 1040, 2160 1230 S 2860 1340, 3290 1170" fill="none" stroke="url(#gold)" strokeWidth="34" strokeLinecap="round" opacity="0.95" />
        <path d="M-40 1190 C 420 1080, 760 1330, 1080 1230 S 1700 1040, 2160 1230 S 2860 1340, 3290 1170" fill="none" stroke="#fff8d6" strokeWidth="6" strokeLinecap="round" opacity="0.7" transform="translate(0 -9)" />
        <path d="M-40 260 C 500 330, 800 150, 1080 230 S 1700 330, 2160 230 S 2800 140, 3290 250" fill="none" stroke="url(#gold)" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      </svg>

      {/* Pastdagi muz to'lqini */}
      <svg width={PANO_W} height={PANO_H} style={{ position: 'absolute', inset: 0, zIndex: 6 }}>
        <defs>
          <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8f8ff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#bfe6fb" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path d={`M0 1360 C 300 1310, 620 1400, 1080 1350 S 1760 1300, 2160 1350 S 2900 1400, ${PANO_W} 1330 L ${PANO_W} ${PANO_H} L 0 ${PANO_H} Z`} fill="url(#ice)" />
        <path d={`M0 1360 C 300 1310, 620 1400, 1080 1350 S 1760 1300, 2160 1350 S 2900 1400, ${PANO_W} 1330`} fill="none" stroke="#fff" strokeWidth="5" opacity="0.9" />
      </svg>

      {/* Chegaradagi katta qor parchalari — postlarni «tikib» turadi */}
      {[[1080, 330], [2160, 330]].map(([x, y]) => (
        <div key={x} style={{ position: 'absolute', left: x - 70, top: y - 70, width: 140, height: 140, zIndex: 7, display: 'grid', placeItems: 'center', fontSize: 120, color: 'rgba(255,255,255,0.75)', textShadow: '0 0 30px rgba(255,255,255,0.6)' }}>❄</div>
      ))}

      <SetTile dx={0} chip="🎒 MAKTAB MAVSUMI UCHUN" title1="Sog‘lom" title2="O‘quv Mavsumi" count={9} items={OQUV} price={199000} old={217970} side="left" />
      <CenterTile />
      <SetTile dx={TILE * 2} chip="🎉 MEHMON KUTISH UCHUN" title1="To‘kin" title2="Dasturxon" count={12} items={DASTURXON} price={252000} old={283510} side="right" />

      {/* Pastki imzo (har postda) */}
      {[0, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', left: i * TILE, width: TILE, top: 1372, textAlign: 'center', zIndex: 8, fontFamily: FONT, fontWeight: 900, fontSize: 30, letterSpacing: 3, color: C.green }}>
          TELEGRAM: @MUSAUZ_BOT
        </div>
      ))}
    </div>
  )
}

/** Tayyorlik uchun yuklanadigan rasmlar. */
export const PANO_IMAGES = [...new Set([...OQUV, ...DASTURXON].map((i) => `/insta/cut/${i.id}.png`))]
