import type { ReactNode } from 'react'
import { ease, interp, spring } from '../anim'
import { useFrame } from '../frame'
import { Burst, C, FONT, FONT_DISPLAY, Phone, PHONE_W, Tap, Words, formatSum } from '../components'

/**
 * 5-sahna (24–34 s): qulayliklar telefon ichida — 4 qadam, har biri 2,5 s:
 *   1. Telegram ichida — bir bosishda (chat → mini ilova)
 *   2. Qulay to'lov — Payme, Click, Uzcard, Humo yoki naqd
 *   3. Kuryer yo'lda — xaritada jonli kuzatuv
 *   4. Tez yetkazamiz — «Yetkazildi!» va 5 yulduz
 */

const STEPS = [8, 83, 158, 233]
const END = 296
const SCREEN_W = 560
const SCREEN_H = 1190

const TITLES = [
  { no: '01', title: 'Telegram ichida', sub: 'bir bosishda buyurtma' },
  { no: '02', title: 'Qulay to‘lov', sub: 'Payme · Click · Uzcard · Humo · naqd' },
  { no: '03', title: 'Kuryer yo‘lda', sub: 'xaritada jonli kuzatasiz' },
  { no: '04', title: 'Tez yetkazamiz', sub: 'to‘g‘ri eshigingizgacha' },
]

export function Features() {
  const f = useFrame()

  const enter = interp(f, [0, 14], [1920, 0], ease.outExpo)
  const phoneIn = spring(f - 2, { stiffness: 120, damping: 16 })
  const sway = Math.sin(f / 38) * 5
  // Oxirida telefonga «sho'ng'iymiz» — keyingi sahnaga o'tish
  const dive = interp(f, [END - 6, END + 12], [1, 3.4], ease.in)
  const diveFade = interp(f, [END + 2, END + 12], [0, 1])

  const step = f >= STEPS[3] ? 3 : f >= STEPS[2] ? 2 : f >= STEPS[1] ? 1 : 0

  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateY(${enter}px)` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #f5fbf6 0%, #e2f1e6 100%)' }} />
      <Blobs />

      {/* Sarlavhalar */}
      {TITLES.map((t, i) => {
        const s = STEPS[i]
        const next = STEPS[i + 1] ?? 999
        if (f < s - 2 || f >= next + 2) return null
        const out = interp(f, [next - 6, next], [0, 1], ease.in)
        return (
          <div key={i} style={{ position: 'absolute', left: 60, right: 60, top: 190, textAlign: 'center', opacity: 1 - out, transform: `translateY(${-out * 50}px)` }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, transform: `scale(${Math.max(0, spring(f - s, { stiffness: 220, damping: 15 }))})` }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 40, color: '#fff', background: C.green, borderRadius: 999, padding: '8px 22px' }}>{t.no}</span>
              <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 34, color: C.green }}>/ 04</span>
            </div>
            <Words text={t.title} start={s + 2} stagger={4} style={{ fontFamily: FONT_DISPLAY, fontSize: 96, color: C.ink, marginTop: 16, lineHeight: 1.05 }} />
            <Words text={t.sub} start={s + 8} stagger={2} rise={30} style={{ fontFamily: FONT, fontWeight: 800, fontSize: 42, color: C.green, marginTop: 14 }} />
          </div>
        )
      })}

      {/* Telefon */}
      <div
        style={{
          position: 'absolute', left: 540 - PHONE_W / 2, top: 600,
          transform: `translateY(${(1 - phoneIn) * 1300}px) perspective(2600px) rotateY(${sway}deg) rotateX(3deg) scale(${dive})`,
          transformOrigin: '50% 40%',
        }}
      >
        <Phone>
          <ScreenStack f={f} step={step} />
        </Phone>
      </div>

      <SideBadge f={f} step={step} />
      <div style={{ position: 'absolute', inset: 0, background: C.green, opacity: diveFade }} />
    </div>
  )
}

/** Fonda sekin suzuvchi yumshoq dog'lar. */
function Blobs() {
  const f = useFrame()
  const blobs = [
    { x: 120, y: 520, r: 360, c: 'rgba(20,163,82,0.20)' },
    { x: 980, y: 900, r: 420, c: 'rgba(255,212,59,0.28)' },
    { x: 200, y: 1600, r: 400, c: 'rgba(255,212,59,0.20)' },
    { x: 900, y: 1750, r: 380, c: 'rgba(20,163,82,0.16)' },
  ]
  return (
    <>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: b.x - b.r + Math.sin((f + i * 40) / 45) * 40, top: b.y - b.r + Math.cos((f + i * 30) / 50) * 40,
            width: b.r * 2, height: b.r * 2, borderRadius: '50%', background: b.c, filter: 'blur(70px)',
          }}
        />
      ))}
    </>
  )
}

/** Ekranlar: yangisi o'ngdan suriladi. */
function ScreenStack({ f, step }: { f: number; step: number }) {
  const screens = [ChatScreen, PayScreen, MapScreen, DoneScreen]
  return (
    <>
      {screens.map((Screen, i) => {
        if (i > step || i < step - 1) return null
        const s = STEPS[i]
        const x = i === 0 ? 0 : interp(f, [s - 4, s + 8], [SCREEN_W, 0], ease.out)
        const leaving = i < step ? interp(f, [STEPS[i + 1] - 4, STEPS[i + 1] + 8], [0, -SCREEN_W * 0.3], ease.out) : 0
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, transform: `translateX(${x + leaving}px)`, zIndex: i }}>
            <Screen t={f - s} />
          </div>
        )
      })}
    </>
  )
}

function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 44px', fontFamily: FONT, fontWeight: 800, fontSize: 24, color: dark ? '#fff' : C.ink }}>
      <span>9:41</span>
      <span style={{ letterSpacing: 2 }}>●●● ▮</span>
    </div>
  )
}

// ─── 1. Telegram chat → mini ilova ────────────────────────────

function ChatScreen({ t }: { t: number }) {
  const typing = t >= 6 && t < 16
  const msg = spring(t - 16, { stiffness: 220, damping: 18 })
  const btn = spring(t - 26, { stiffness: 220, damping: 16 })
  const sheet = interp(t, [44, 58], [SCREEN_H, 0], ease.outExpo)
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #cfe6c3 0%, #a9d39c 100%)' }}>
      <div style={{ background: '#fff', paddingBottom: 18, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <StatusBar />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 30px' }}>
          <span style={{ fontSize: 34, color: '#3a8fd9' }}>‹</span>
          <img src="/musa-mark.webp" style={{ width: 72, height: 72, borderRadius: '50%' }} />
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 30, color: C.ink }}>MUSA Delivery</div>
            <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, color: '#8a9aa6' }}>bot</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 26, right: 60, top: 300 }}>
        {typing && (
          <div style={{ display: 'inline-flex', gap: 8, background: '#fff', borderRadius: 26, padding: '20px 26px' }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: '#9aa7b0', transform: `translateY(${Math.sin((t + i * 3) / 2) * 5}px)` }} />
            ))}
          </div>
        )}
        {t >= 16 && (
          <div style={{ transform: `scale(${msg})`, transformOrigin: 'left bottom' }}>
            <div style={{ background: '#fff', borderRadius: '28px 28px 28px 8px', padding: '22px 26px', fontFamily: FONT, fontWeight: 600, fontSize: 27, lineHeight: 1.35, color: C.ink, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
              Assalomu alaykum! 👋<br />Muzlatilgan mahsulotlarni bir bosishda buyurtma qiling.
              <div style={{ textAlign: 'right', fontSize: 18, color: '#9aa7b0', marginTop: 6 }}>9:41</div>
            </div>
            {t >= 26 && (
              <div style={{ marginTop: 10, transform: `scale(${btn})`, transformOrigin: 'top center' }}>
                <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 18, padding: '18px 0', textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 28, color: '#1f6f3b' }}>
                  🛒 Katalogni ochish
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <Tap at={40} x={260} y={560} />

      {/* Mini ilova */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${sheet}px)`, background: '#f6f8f6' }}>
        <AppHome t={t - 50} />
      </div>
    </div>
  )
}

function AppHome({ t }: { t: number }) {
  const items = [
    { src: '/kotlet.webp', price: 32670 },
    { src: '/chuchvara.webp', price: 27200 },
    { src: '/dubai.webp', price: 20000 },
    { src: '/sirok.webp', price: 3800 },
  ]
  return (
    <>
      <div style={{ background: C.green, paddingBottom: 26, borderRadius: '0 0 40px 40px' }}>
        <StatusBar dark />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 34px 0' }}>
          <div style={{ transform: 'scale(0.26)', transformOrigin: 'left center', width: 182, height: 65 }}>
            <LogoMini />
          </div>
          <span style={{ fontSize: 36 }}>🛒</span>
        </div>
        <div style={{ margin: '20px 30px 0', background: '#fff', borderRadius: 999, padding: '18px 26px', fontFamily: FONT, fontWeight: 600, fontSize: 24, color: '#98a39c' }}>
          🔍  Mahsulot qidirish…
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '26px 30px 10px', overflow: 'hidden' }}>
        {['Yarim tayyor', 'Muzqaymoq', 'Setlar'].map((c, i) => (
          <span key={c} style={{ flexShrink: 0, padding: '12px 22px', borderRadius: 999, background: i === 0 ? C.green : '#fff', color: i === 0 ? '#fff' : C.ink, fontFamily: FONT, fontWeight: 800, fontSize: 22, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>{c}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '10px 30px' }}>
        {items.map((it, i) => {
          const p = spring(t - 2 - i * 3, { stiffness: 230, damping: 16 })
          return (
            <div key={i} style={{ background: '#fff', borderRadius: 26, padding: 14, boxShadow: '0 6px 16px rgba(0,0,0,0.07)', transform: `scale(${Math.max(0, p)})` }}>
              <img src={it.src} style={{ width: '100%', height: 190, objectFit: 'contain' }} />
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: C.ink, marginTop: 8 }}>{formatSum(it.price)} <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 18 }}>so‘m</span></div>
              <div style={{ marginTop: 10, background: C.green, color: '#fff', borderRadius: 14, textAlign: 'center', padding: '8px 0', fontFamily: FONT, fontWeight: 800, fontSize: 22 }}>+ Savatga</div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/** Telefon ichidagi kichik logotip (Logo komponentining yengil nusxasi). */
function LogoMini() {
  return (
    <div style={{ width: 700, height: 250, borderRadius: 64, background: 'linear-gradient(180deg, #fff3a6, #ffd43b 40%, #f2b400)', border: '10px solid #c98f00', display: 'grid', placeItems: 'center' }}>
      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 176, color: C.blue, lineHeight: 1 }}>MUSA</span>
    </div>
  )
}

// ─── 2. To'lov ────────────────────────────────────────────────

function PayLogo({ id }: { id: string }) {
  const base = { fontFamily: FONT, fontWeight: 900, lineHeight: 1 } as const
  if (id === 'payme') {
    return <span style={{ ...base, fontSize: 44, color: '#1b2b52' }}>pay<span style={{ marginLeft: 2, borderRadius: 8, background: '#00c1c1', padding: '1px 7px 5px', color: '#fff' }}>me</span></span>
  }
  if (id === 'click') {
    return <span style={{ ...base, fontSize: 44, color: '#0096ff', display: 'inline-flex', alignItems: 'center', gap: 8 }}><span style={{ width: 30, height: 30, border: '7px solid #0096ff', borderRadius: '50%' }} />click</span>
  }
  if (id === 'uzcard') {
    return <span style={{ ...base, fontSize: 38, fontStyle: 'italic', color: '#173a8c' }}>UZ<span style={{ color: '#0aa0d8' }}>CARD</span></span>
  }
  return <span style={{ ...base, fontSize: 42, color: '#0e2a6b', letterSpacing: 4 }}>HUM<span style={{ color: '#f28c00' }}>O</span></span>
}

function PayScreen({ t }: { t: number }) {
  const tiles = ['payme', 'click', 'uzcard', 'humo']
  const chosen = t >= 36
  const toast = spring(t - 56, { stiffness: 200, damping: 16 })
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#f6f8f6' }}>
      <StatusBar />
      <div style={{ padding: '10px 34px', fontFamily: FONT, fontWeight: 900, fontSize: 38, color: C.ink }}>‹  Buyurtma berish</div>
      <div style={{ padding: '26px 34px 12px', fontFamily: FONT, fontWeight: 800, fontSize: 28, color: '#6b7a71' }}>To‘lov usuli</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, padding: '0 30px' }}>
        {tiles.map((id, i) => {
          const p = spring(t - 6 - i * 4, { stiffness: 240, damping: 15 })
          const on = chosen && id === 'payme'
          return (
            <div
              key={id}
              style={{
                height: 150, borderRadius: 26, background: '#fff', display: 'grid', placeItems: 'center', position: 'relative',
                border: `4px solid ${on ? C.green : '#e3e8e5'}`, transform: `scale(${Math.max(0, p) * (on ? 1.04 : 1)})`,
                boxShadow: on ? '0 10px 24px rgba(10,122,61,0.25)' : '0 4px 10px rgba(0,0,0,0.05)',
              }}
            >
              <PayLogo id={id} />
              {on && <span style={{ position: 'absolute', top: 10, right: 12, width: 38, height: 38, borderRadius: '50%', background: C.green, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 900 }}>✓</span>}
            </div>
          )
        })}
        <div
          style={{
            gridColumn: '1 / -1', height: 120, borderRadius: 26, background: '#fff', border: '4px solid #e3e8e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
            transform: `scale(${Math.max(0, spring(t - 22, { stiffness: 240, damping: 15 }))})`,
            fontFamily: FONT, fontWeight: 900, fontSize: 36, color: '#0a7a3d',
          }}
        >
          💵 Naqd pul
        </div>
      </div>
      <Tap at={32} x={150} y={400} />

      <div style={{ position: 'absolute', left: 30, right: 30, bottom: 60 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT, fontWeight: 800, fontSize: 30, color: C.ink, marginBottom: 18 }}>
          <span>Jami</span>
          <span>{formatSum(252000)} so‘m</span>
        </div>
        <div style={{ borderRadius: 24, background: C.green, color: '#fff', textAlign: 'center', padding: '28px 0', fontFamily: FONT, fontWeight: 900, fontSize: 34, transform: `scale(${t >= 46 && t < 52 ? 0.96 : 1})` }}>
          Buyurtma berish
        </div>
      </div>
      <Tap at={48} x={280} y={1080} />

      {t >= 56 && (
        <div
          style={{
            position: 'absolute', left: 40, right: 40, top: 110, borderRadius: 24, background: C.ink, color: '#fff',
            padding: '24px 28px', fontFamily: FONT, fontWeight: 800, fontSize: 28, display: 'flex', alignItems: 'center', gap: 14,
            transform: `translateY(${(1 - toast) * -140}px)`, boxShadow: '0 16px 30px rgba(0,0,0,0.25)',
          }}
        >
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: C.greenBright, display: 'grid', placeItems: 'center' }}>✓</span>
          To‘lov qabul qilindi
        </div>
      )}
    </div>
  )
}

// ─── 3. Xaritada kuryer ───────────────────────────────────────

const ROUTE: [number, number][] = [[90, 900], [90, 700], [250, 700], [250, 470], [420, 470], [420, 300], [470, 300]]

function pointOn(route: [number, number][], p: number): { x: number; y: number; a: number } {
  const lens = route.slice(1).map((pt, i) => Math.hypot(pt[0] - route[i][0], pt[1] - route[i][1]))
  const total = lens.reduce((a, b) => a + b, 0)
  let d = p * total
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = Math.min(1, d / lens[i])
      const [x0, y0] = route[i]
      const [x1, y1] = route[i + 1]
      return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, a: Math.atan2(y1 - y0, x1 - x0) }
    }
    d -= lens[i]
  }
  return { x: route[0][0], y: route[0][1], a: 0 }
}

function MapScreen({ t }: { t: number }) {
  const draw = interp(t, [4, 22], [0, 1], ease.out)
  const drive = interp(t, [12, 72], [0, 0.93], ease.inOut)
  const car = pointOn(ROUTE, drive)
  const routeD = 'M' + ROUTE.map(([x, y]) => `${x} ${y}`).join(' L')
  const total = ROUTE.slice(1).reduce((s, pt, i) => s + Math.hypot(pt[0] - ROUTE[i][0], pt[1] - ROUTE[i][1]), 0)
  const pinBob = Math.abs(Math.sin(t / 5)) * 16
  const sheet = spring(t - 6, { stiffness: 180, damping: 18 })
  const eta = Math.max(9, Math.round(interp(t, [20, 70], [12, 9])))
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#eaf0e6' }}>
      <svg width={SCREEN_W} height={SCREEN_H} style={{ position: 'absolute', inset: 0 }}>
        <path d="M-20 1010 C 160 930, 330 1060, 600 960" stroke="#b9dcf2" strokeWidth={70} fill="none" />
        <rect x={300} y={560} width={220} height={160} rx={30} fill="#cfe7c4" />
        <rect x={20} y={200} width={180} height={220} rx={30} fill="#cfe7c4" />
        {[140, 300, 470, 700, 900].map((y) => <line key={y} x1={0} y1={y} x2={SCREEN_W} y2={y} stroke="#fff" strokeWidth={26} />)}
        {[90, 250, 420].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={SCREEN_H} stroke="#fff" strokeWidth={26} />)}
        <path d={routeD} fill="none" stroke={C.greenBright} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={total} strokeDashoffset={total * (1 - draw)} />
      </svg>
      {/* Manzil */}
      <div style={{ position: 'absolute', left: 470 - 36, top: 300 - 92 - pinBob, width: 72, height: 92, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: C.red, display: 'grid', placeItems: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.25)' }}>
          <span style={{ transform: 'rotate(45deg)', fontSize: 34 }}>🏠</span>
        </div>
      </div>
      {/* Mashina */}
      <div
        style={{
          position: 'absolute', left: car.x - 38, top: car.y - 38, width: 76, height: 76, borderRadius: '50%', background: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 42, boxShadow: '0 8px 20px rgba(0,0,0,0.25)', border: `5px solid ${C.green}`,
        }}
      >
        🚗
      </div>
      <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ background: '#fff', borderRadius: 999, padding: '14px 28px', fontFamily: FONT, fontWeight: 800, fontSize: 26, color: C.green, boxShadow: '0 6px 14px rgba(0,0,0,0.1)' }}>🚚 Yetkazilmoqda</span>
      </div>
      {/* Pastki karta */}
      <div
        style={{
          position: 'absolute', left: 20, right: 20, bottom: 30, borderRadius: 34, background: '#fff', padding: '30px 30px 34px',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.12)', transform: `translateY(${(1 - sheet) * 360}px)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 34, color: C.ink }}>Kuryer yo‘lda</div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 24, color: '#6b7a71', marginTop: 4 }}>Taxminan</div>
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 56, color: C.green }}>~{eta} <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26 }}>daq</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
          <span style={{ width: 70, height: 70, borderRadius: '50%', background: C.yellow, display: 'grid', placeItems: 'center', fontFamily: FONT_DISPLAY, fontSize: 32, color: C.ink }}>A</span>
          <div style={{ flex: 1, fontFamily: FONT, fontWeight: 800, fontSize: 28, color: C.ink }}>Ali <span style={{ color: '#8a978f', fontWeight: 700 }}>· kuryer</span></div>
          <span style={{ width: 70, height: 70, borderRadius: '50%', background: C.green, display: 'grid', placeItems: 'center', fontSize: 32 }}>📞</span>
        </div>
      </div>
    </div>
  )
}

// ─── 4. Yetkazildi ────────────────────────────────────────────

function DoneScreen({ t }: { t: number }) {
  const check = spring(t - 6, { stiffness: 170, damping: 11 })
  const ring = interp(t, [6, 30], [0, 1], ease.out)
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #ffffff 0%, #e6f6ea 100%)', textAlign: 'center' }}>
      <StatusBar />
      <div style={{ position: 'absolute', left: SCREEN_W / 2 - 150, top: 250, width: 300, height: 300 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `8px solid ${C.greenBright}`, opacity: 1 - ring, transform: `scale(${1 + ring * 0.8})` }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `linear-gradient(160deg, ${C.greenBright}, ${C.green})`, display: 'grid', placeItems: 'center', transform: `scale(${Math.max(0, check)})`, boxShadow: '0 24px 50px rgba(10,122,61,0.35)' }}>
          <svg width={150} height={150} viewBox="0 0 24 24">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - interp(t, [10, 22], [0, 1], ease.out))} />
          </svg>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 610, fontFamily: FONT, fontWeight: 900, fontSize: 44, color: C.ink, opacity: interp(t, [14, 22], [0, 1]) }}>
        Buyurtma yetkazildi!
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 690, fontFamily: FONT, fontWeight: 700, fontSize: 28, color: '#6b7a71', opacity: interp(t, [20, 28], [0, 1]) }}>
        Kuryerni baholang
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center', gap: 14 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const p = spring(t - 24 - i * 4, { stiffness: 260, damping: 11 })
          return <span key={i} style={{ fontSize: 76, transform: `scale(${Math.max(0, p)}) rotate(${(1 - Math.min(1, p)) * 40}deg)`, filter: 'drop-shadow(0 6px 10px rgba(242,169,0,0.45))' }}>⭐</span>
        })}
      </div>
      <Burst at={8} x={SCREEN_W / 2} y={400} count={22} radius={320} color={C.yellow} />
      <div style={{ position: 'absolute', left: 40, right: 40, bottom: 80, borderRadius: 24, background: '#fff', padding: '26px 0', fontFamily: FONT, fontWeight: 800, fontSize: 28, color: C.green, boxShadow: '0 6px 16px rgba(0,0,0,0.06)', opacity: interp(t, [44, 54], [0, 1]) }}>
        Rahmat! Yoqimli ishtaha 😋
      </div>
    </div>
  )
}

// ─── Telefon yonidagi suzuvchi belgilar ───────────────────────

function SideBadge({ f, step }: { f: number; step: number }) {
  const s = STEPS[step]
  const p = spring(f - s - 10, { stiffness: 200, damping: 13 })
  const out = step < 3 ? interp(f, [STEPS[step + 1] - 6, STEPS[step + 1]], [0, 1]) : interp(f, [END - 8, END], [0, 1])
  const float = Math.sin(f / 12) * 12
  const badges: { left: boolean; top: number; body: ReactNode }[] = [
    { left: true, top: 820, body: <><TgIcon /> <span>Telegram</span></> },
    { left: true, top: 1420, body: <><span style={{ fontSize: 40 }}>💳</span> <span>1 daqiqada</span></> },
    { left: true, top: 1160, body: <><span style={{ fontSize: 40 }}>📍</span> <span>Jonli kuzatuv</span></> },
    { left: true, top: 880, body: <><span style={{ fontSize: 40 }}>⭐</span> <span>5.0</span></> },
  ]
  const b = badges[step]
  return (
    <div
      style={{
        position: 'absolute', top: b.top + float, [b.left ? 'left' : 'right']: 30,
        display: 'flex', alignItems: 'center', gap: 12, padding: '20px 30px', borderRadius: 999, background: '#fff',
        boxShadow: '0 20px 40px rgba(10,60,30,0.2)', fontFamily: FONT, fontWeight: 900, fontSize: 36, color: C.ink,
        transform: `scale(${Math.max(0, p) * (1 - out)}) rotate(${b.left ? -6 : 6}deg)`, zIndex: 20,
      }}
    >
      {b.body}
    </div>
  )
}

export function TgIcon({ size = 48 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(180deg, #37aee2, #1e96c8)', display: 'grid', placeItems: 'center' }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24">
        <path d="M21.5 3.5 2.8 10.7c-1.2.5-1.2 1.2 0 1.6l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.5-1.6Z" fill="#fff" />
      </svg>
    </span>
  )
}
