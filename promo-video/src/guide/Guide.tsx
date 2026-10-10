import { clamp01, ease, interp, spring } from '../anim'
import { FrameProvider, useFrame } from '../frame'
import { C, FONT, Phone, PHONE_H, PHONE_W, Snow } from '../components'
import { A, MiniApp } from './app'
import { Cta, Hook } from './ends'
import { T, TelegramScreens } from './tg'
import { LINES, SCENES, STEPS } from './timeline'
import { Finger, type TapPoint } from './ui'

/**
 * Qo'llanma video: @musauz_bot da START dan buyurtma yetib kelguncha.
 * 1080×1920, 30 kadr/s, ≈73 s. Vaqtlar — timeline.ts.
 */

/** Bosishlar (ekran koordinatasi 560×1190) — guruhlar: barmoq orada yashirinadi. */
const TAP_GROUPS: TapPoint[][] = [
  [{ f: T.searchTap, x: 280, y: 150 }, { f: T.resultTap, x: 280, y: 250 }],
  [{ f: T.startTap, x: 280, y: 1135 }],
  [{ f: T.langTap, x: 120, y: 995 }],
  [{ f: T.catalogTap, x: 250, y: 1010 }],
  [{ f: A.searchTap, x: 280, y: 237 }, { f: A.resultTap, x: 280, y: 272 }],
  [{ f: A.addTap, x: 280, y: 1131 }],
  [{ f: A.plus1, x: 339, y: 1131 }, { f: A.plus2, x: 339, y: 1131 }, { f: A.minus, x: 57, y: 1131 }, { f: A.cartTap, x: 511, y: 159 }],
  [{ f: A.orderTap, x: 280, y: 1127 }],
  [{ f: A.nameTap, x: 280, y: 278 }, { f: A.phoneTap, x: 280, y: 390 }],
  [{ f: A.addrTap, x: 280, y: 357 }, { f: A.hereTap, x: 280, y: 858 }],
  [{ f: A.dragFrom, x: 300, y: 700, drag: { x: 380, y: 790, to: A.dragTo } }, { f: A.saveTap, x: 280, y: 1115 }],
  [{ f: A.cashTap, x: 147, y: 286 }, { f: A.cardTap, x: 412, y: 286 }, { f: A.receiptTap, x: 280, y: 564 }],
  [{ f: A.submitTap, x: 280, y: 1133 }],
  [{ f: A.trackerTap, x: 280, y: 1024 }],
  [0, 1, 2, 3, 4].map((i) => ({ f: A.rate + 9 + i * 4, x: 156 + i * 62, y: 927 })).concat([{ f: A.sendTap, x: 280, y: 1127 }]),
]
const ALL_TAPS = TAP_GROUPS.flat().map((t) => t.f)

/** «Kamera»: [kadr, masshtab, vertikal siljish]. */
const CAMERA: [number, number, number][] = [
  [0, 1, 0],
  [T.langMsg, 1, 0], [T.langMsg + 12, 1.2, -170], [T.langEdit + 4, 1.2, -170], [T.welcome + 6, 1, 0],
  [T.welcome + 30, 1, 0], [T.welcome + 44, 1.16, -150], [T.catalogTap + 4, 1.16, -150], [T.appOpen + 14, 1, 0],
  [A.plus1 - 14, 1, 0], [A.plus1 - 2, 1.14, -130], [A.minus + 6, 1.14, -130], [A.cartTap - 4, 1, 0],
  [A.nameTap - 10, 1, 0], [A.nameTap + 2, 1.15, 140], [A.autofill + 30, 1.15, 140], [A.autofill + 46, 1, 0],
  [A.cashTap - 14, 1, 0], [A.cashTap - 2, 1.1, 80], [A.receiptDone + 10, 1.1, 80], [A.scrollSubmit + 6, 1, 0],
  [A.coldBox - 6, 1, 0], [A.coldBox + 10, 1.06, 0], [A.doneBanner + 40, 1.06, 0], [A.doneBanner + 52, 1, 0],
]
function camera(f: number): [number, number] {
  let i = 0
  while (i < CAMERA.length - 2 && f > CAMERA[i + 1][0]) i++
  const [a, s0, y0] = CAMERA[i]
  const [b, s1, y1] = CAMERA[i + 1]
  const k = interp(f, [a, b], [0, 1], ease.inOut)
  return [s0 + (s1 - s0) * k, y0 + (y1 - y0) * k]
}

const BASE_SCALE = 1.12
const PHONE_CY = 952

function PhoneStage() {
  const f = useFrame()
  const enter = spring(f - (SCENES.hook[1] - 18), { stiffness: 120, damping: 16 })
  const exit = interp(f, [SCENES.cta[0] - 8, SCENES.cta[0] + 12], [0, 1], ease.in)
  if (f < SCENES.hook[1] - 20 || exit >= 1) return null
  const [cs, cy] = camera(f)
  const punch = ALL_TAPS.reduce((m, t) => Math.max(m, interp(f, [t - 1, t + 2, t + 9], [0, 1, 0])), 0)
  const sway = Math.sin(f / 70) * 3.2
  const scale = BASE_SCALE * cs * (1 + punch * 0.012) * (1 - exit * 0.35)
  const y = PHONE_CY + cy + (1 - enter) * 1500 - exit * 900
  return (
    <div style={{ position: 'absolute', left: 540 - PHONE_W / 2, top: y - PHONE_H / 2, width: PHONE_W, height: PHONE_H, zIndex: 10, opacity: 1 - exit, transform: `perspective(2600px) rotateY(${sway + (1 - enter) * -24}deg) rotateX(${2 + (1 - enter) * 18}deg) scale(${scale})` }}>
      <Phone>
        <TelegramScreens />
        <MiniApp />
        {TAP_GROUPS.map((g, i) => <Finger key={i} taps={g} />)}
      </Phone>
    </div>
  )
}

/** Tepadagi qadam yorlig'i va nuqtalar. */
function StepChip() {
  const f = useFrame()
  if (f < SCENES.search[0] - 4 || f > SCENES.cta[0]) return null
  let idx = 0
  STEPS.forEach((s, i) => { if (f >= SCENES[s.from][0]) idx = i })
  const at = SCENES[STEPS[idx].from][0]
  const p = clamp01(spring(f - at, { stiffness: 260, damping: 18 }))
  const vis = interp(f, [SCENES.search[0] - 4, SCENES.search[0] + 6, SCENES.cta[0] - 10, SCENES.cta[0]], [0, 1, 1, 0])
  const step = STEPS[idx]
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 70, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: vis, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 34px 16px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.96)', boxShadow: '0 16px 40px rgba(0,30,15,0.35)', transform: `scale(${0.85 + p * 0.15})` }}>
        <span style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(160deg, #14a352, ${C.green})`, display: 'grid', placeItems: 'center', fontSize: 34, transform: `rotate(${(1 - p) * -90}deg) scale(${p})` }}>{step.icon}</span>
        <span style={{ fontWeight: 900, fontSize: 42, color: C.ink, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>{step.label}</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {STEPS.map((s, i) => (
          <div key={s.from} style={{ width: i === idx ? 38 : 12, height: 12, borderRadius: 6, background: i <= idx ? C.yellow : 'rgba(255,255,255,0.35)', transition: 'none' }} />
        ))}
      </div>
    </div>
  )
}

/** So'zma-so'z subtitr: joriy so'z sariq. */
function Subtitles() {
  const f = useFrame()
  if (f < SCENES.hook[1] || f >= SCENES.cta[0]) return null
  const line = LINES.find((l) => f >= l.from && f < l.to + 6)
  if (!line) return null
  const p = clamp01(spring(f - line.from, { stiffness: 280, damping: 20 }))
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top: 1675, zIndex: 25, display: 'flex', justifyContent: 'center', fontFamily: FONT }}>
      <div style={{ maxWidth: 980, textAlign: 'center', padding: '18px 30px', borderRadius: 32, background: 'rgba(3,32,17,0.72)', boxShadow: '0 18px 40px rgba(0,0,0,0.35)', transform: `translateY(${(1 - p) * 24}px) scale(${0.94 + p * 0.06})`, opacity: p, lineHeight: 1.22 }}>
        {line.words.map((w, i) => {
          const cur = f >= w.from && f < w.to
          const said = f >= w.from
          const k = cur ? clamp01(spring(f - w.from, { stiffness: 400, damping: 18 })) : 0
          return (
            <span key={i} style={{ display: 'inline-block', margin: '0 8px', fontWeight: 900, fontSize: 54, color: cur ? C.yellow : said ? '#fff' : 'rgba(255,255,255,0.6)', transform: `scale(${1 + k * 0.08 * (1 - clamp01((f - w.from) / 10))}) translateY(${cur ? -2 : 0}px)`, textShadow: '0 4px 14px rgba(0,0,0,0.45)' }}>{w.text}</span>
          )
        })}
      </div>
    </div>
  )
}

function Background() {
  const f = useFrame()
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(80% 55% at 50% 42%, #138a47 0%, ${C.green} 40%, ${C.greenDeep} 78%, #022012 100%)` }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', left: 190 + Math.sin(f / (90 + i * 30) + i * 2) * 360 - 350 + 350, top: 400 + i * 450 + Math.cos(f / (110 + i * 20) + i) * 160 - 350, background: `radial-gradient(circle, rgba(${i === 1 ? '255,215,106' : '60,220,140'},0.22), transparent 65%)` }} />
      ))}
      <Snow count={46} opacity={0.45} seed={5} speed={0.7} />
    </>
  )
}

export function Guide({ frame }: { frame: number }) {
  return (
    <FrameProvider frame={frame}>
      <div style={{ position: 'relative', width: 1080, height: 1920, overflow: 'hidden', background: C.greenDeep }}>
        <Background />
        <PhoneStage />
        <StepChip />
        <Subtitles />
        <Hook />
        <Cta />
      </div>
    </FrameProvider>
  )
}
