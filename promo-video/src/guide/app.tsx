import type { CSSProperties, ReactNode } from 'react'
import { clamp01, ease, interp, rand, spring } from '../anim'
import { useFrame } from '../frame'
import { FONT, FONT_DISPLAY } from '../components'
import { APP, Box, Caret, SH, SW, StatusBar, fmt, pop, pushX, ramp, sheetY, typed } from './ui'
import { BotAvatar, T, TgBanner } from './tg'
import { sec } from './timeline'

/** Mini app vaqtlari (GLOBAL kadr). */
export const A = {
  open: T.appOpen,
  splashOut: sec(13.7),
  scroll1: sec(17.5),
  setPulse: sec(17.75),
  scroll2: sec(18.65),
  scrollBack: sec(20.25),
  searchTap: sec(20.85),
  searchOpen: sec(20.95),
  typeFrom: sec(21.15),
  resultTap: sec(22.55),
  productOpen: sec(22.75),
  addTap: sec(25.35),
  plus1: sec(26.9),
  plus2: sec(27.5),
  minus: sec(28.15),
  cartTap: sec(28.85),
  cartOpen: sec(29.05),
  orderTap: sec(32.25),
  checkoutOpen: sec(32.45),
  nameTap: sec(33.55),
  phoneTap: sec(34.4),
  autofill: sec(35.75),
  scrollAddr: sec(37.7),
  addrTap: sec(38.25),
  addrSheet: sec(38.4),
  hereTap: sec(39.45),
  mapOpen: sec(39.6),
  pinDrop: sec(40.85),
  dragFrom: sec(42.95),
  dragTo: sec(43.85),
  saveTap: sec(44.3),
  mapClose: sec(44.45),
  scrollPay: sec(44.7),
  cashTap: sec(46.45),
  cardTap: sec(47.7),
  receiptTap: sec(48.95),
  receiptDone: sec(49.6),
  scrollSubmit: sec(49.85),
  submitTap: sec(50.45),
  success: sec(50.6),
  orders: sec(53.85),
  banner1: sec(54.0),
  banner2: sec(55.3),
  inTransit: sec(55.4),
  trackerTap: sec(56.35),
  trackMap: sec(56.5),
  carEnd: sec(60.15),
  door: sec(60.2),
  coldBox: sec(61.7),
  doneBanner: sec(62.3),
  rate: sec(64.15),
  sendTap: sec(65.4),
  end: sec(66.2),
}

const CONTENT_TOP = 122
const CH = SH - CONTENT_TOP

export const PRODUCTS = {
  chuchvara: { name: 'Musa chuchvara', img: '/chuchvara.webp', price: 27200, chip: '🥟 Yarim tayyor' },
  kotlet: { name: 'Mol go‘shtli kotlet', img: '/kotlet.webp', price: 32670, chip: '🥩 Yarim tayyor' },
  somsa: { name: 'Qatlama somsa', img: '/somsa.webp', price: 30300, chip: '🥐 Yarim tayyor' },
  dubai: { name: 'BissGo Dubai', img: '/dubai.webp', price: 20000, chip: '🍦 Muzqaymoq' },
}

const ORDER_LINES = [
  { ...PRODUCTS.chuchvara, qty: 2 },
  { ...PRODUCTS.kotlet, qty: 1 },
  { ...PRODUCTS.somsa, qty: 1 },
]
export const ORDER_TOTAL = ORDER_LINES.reduce((s, l) => s + l.price * l.qty, 0)
export const ORDER_LABEL = '#0012 · 09.10.2026'

// ─── Umumiy bo'laklar ─────────────────────────────────────────

function Btn({ children, style, press = 0, ghost = false }: { children: ReactNode; style?: CSSProperties; press?: number; ghost?: boolean }) {
  return (
    <div style={{ height: 66, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 800, fontSize: 24, color: ghost ? APP.green : '#fff', background: ghost ? APP.soft : `linear-gradient(180deg, #11934a, ${APP.green})`, boxShadow: ghost ? 'none' : '0 10px 22px -8px rgba(10,122,61,0.65)', transform: `scale(${1 - press * 0.05})`, ...style }}>
      {children}
    </div>
  )
}

const pressAt = (f: number, at: number) => interp(f, [at - 2, at + 1, at + 7], [0, 1, 0])

function BottomNav({ active }: { active: number }) {
  const items = [['🏠', 'Bosh sahifa'], ['🧭', 'Katalog'], ['🛒', 'Savat'], ['📦', 'Buyurtmalar'], ['👤', 'Profil']]
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, background: 'rgba(255,255,255,0.97)', borderTop: `1px solid ${APP.line}`, display: 'flex', paddingBottom: 12, zIndex: 8 }}>
      {items.map(([icon, label], i) => (
        <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 14, fontWeight: 700, color: i === active ? APP.green : APP.faint }}>
          <span style={{ fontSize: 26, filter: i === active ? 'none' : 'grayscale(1) opacity(0.6)' }}>{icon}</span>{label}
        </div>
      ))}
    </div>
  )
}

function Header({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  return (
    <div style={{ height: 74, display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', background: '#fff', borderBottom: `1px solid ${APP.line}` }}>
      {back && <svg width="18" height="28" viewBox="0 0 20 30"><path d="M15 3L4 15l11 12" fill="none" stroke={APP.ink} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      <div style={{ flex: 1, fontWeight: 800, fontSize: 26 }}>{title}</div>
      {right}
    </div>
  )
}

function Thumb({ src, size = 84 }: { src: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 18, background: '#fff', border: `1px solid ${APP.line}`, display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
      <img src={src} style={{ width: '88%', height: '88%', objectFit: 'contain' }} />
    </div>
  )
}

// ─── Bosh sahifa ──────────────────────────────────────────────

function LineCard({ img, label, w, h, tag = false, pulse = 0 }: { img: string; label: string; w: number; h: number; tag?: boolean; pulse?: number }) {
  return (
    <div style={{ position: 'relative', width: w, height: h, borderRadius: 26, overflow: 'visible' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 26, overflow: 'hidden', backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 10px 22px -12px rgba(0,40,20,0.5)' }}>
        {!tag && <div style={{ position: 'absolute', left: 18, bottom: 14, color: '#fff', fontWeight: 900, fontSize: 24, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>{label}</div>}
      </div>
      {tag && (
        <div style={{ position: 'absolute', left: 14, top: 18, transform: `rotate(-7deg) scale(${1 + pulse * 0.08})`, background: 'linear-gradient(180deg,#fff3c4,#ffd76a)', color: '#5a3b00', fontWeight: 900, fontSize: 19, padding: '8px 14px', borderRadius: 12, boxShadow: '0 6px 14px rgba(0,0,0,0.25)', lineHeight: 1.1 }}>
          Aksiyadagi<br />set mahsulotlar
        </div>
      )}
      {pulse > 0 && <div style={{ position: 'absolute', inset: -8, borderRadius: 32, border: `5px solid rgba(255,215,106,${pulse})` }} />}
    </div>
  )
}

function Home() {
  const f = useFrame()
  const scroll =
    interp(f, [A.scroll1, A.scroll1 + 18], [0, 390], ease.inOut) +
    interp(f, [A.scroll2, A.scroll2 + 18], [0, 330], ease.inOut) -
    interp(f, [A.scrollBack, A.scrollBack + 16], [0, 720], ease.inOut)
  const setPulse = f > A.setPulse && f < A.setPulse + 36 ? (Math.sin((f - A.setPulse) / 3) + 1) / 2 : 0
  const intro = (i: number) => pop(f, A.splashOut - 6 + i * 4)
  const searchPress = pressAt(f, A.searchTap)
  return (
    <Box style={{ background: APP.bg }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, transform: `translateY(${-scroll}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px 0', opacity: intro(0) }}>
          <BotAvatar size={50} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: APP.ink, lineHeight: 1 }}>MUSA</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: APP.green, letterSpacing: 1 }}>MUZLATILGAN MAHSULOTLAR</div>
          </div>
          <span style={{ fontSize: 26 }}>🔔</span><span style={{ fontSize: 26, marginLeft: 10 }}>🤍</span>
        </div>
        <div style={{ margin: '18px 22px 0', height: 58, borderRadius: 18, background: '#fff', border: `1px solid ${APP.line}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', color: APP.faint, fontSize: 20, fontWeight: 600, opacity: intro(1), transform: `scale(${1 - searchPress * 0.03})`, boxShadow: searchPress ? `0 0 0 3px ${APP.green}55` : '0 4px 12px -8px rgba(0,0,0,0.2)' }}>
          🔍 <span>Mahsulot yoki turkum qidiring...</span>
        </div>
        {/* Hero */}
        <div style={{ position: 'relative', margin: '18px 22px 0', height: 250, borderRadius: 28, overflow: 'hidden', background: 'radial-gradient(120% 90% at 85% 10%, #1fa463 0%, transparent 55%), linear-gradient(160deg, #0b8443, #04542a)', color: '#fff', opacity: intro(2), transform: `translateY(${(1 - intro(2)) * 30}px)` }}>
          <div style={{ position: 'absolute', left: 24, top: 26, width: 260 }}>
            <div style={{ display: 'inline-block', background: '#fff', color: APP.green, fontWeight: 800, fontSize: 15, borderRadius: 999, padding: '6px 12px' }}>Yangi va sifatli</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, lineHeight: 1.08, marginTop: 12 }}>Uydagidek ta’m — bir necha daqiqada</div>
          </div>
          <img src="/hero-products.webp" style={{ position: 'absolute', right: -40, bottom: -16, width: 300 }} />
        </div>
        <div style={{ margin: '28px 22px 14px', fontWeight: 900, fontSize: 27, color: APP.ink }}>Yo‘nalishlar</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '0 22px', opacity: intro(3) }}>
          <LineCard img="/cat-yarim-tayyor.webp" label="Yarim tayyorlar" w={516} h={170} />
          <LineCard img="/cat-muzqaymoq.webp" label="Muzqaymoqlar" w={251} h={170} />
          <LineCard img="/cat-sirok.webp" label="Siroklar" w={251} h={170} />
          <LineCard img="/cat-setlar.webp" label="Setlar" w={516} h={180} tag pulse={setPulse} />
        </div>
        <div style={{ margin: '28px 22px 14px', fontWeight: 900, fontSize: 27, color: APP.ink }}>Mashhur mahsulotlar</div>
        <div style={{ display: 'flex', gap: 14, padding: '0 22px' }}>
          {Object.values(PRODUCTS).map((p, i) => {
            const s = pop(f, A.scroll2 + 6 + i * 4)
            return (
              <div key={p.name} style={{ width: 210, flexShrink: 0, background: '#fff', borderRadius: 22, padding: 12, border: `1px solid ${APP.line}`, transform: `scale(${0.85 + s * 0.15})`, opacity: 0.4 + s * 0.6 }}>
                <div style={{ height: 150, display: 'grid', placeItems: 'center' }}><img src={p.img} style={{ width: '92%', height: 140, objectFit: 'contain' }} /></div>
                <div style={{ fontWeight: 800, fontSize: 18, marginTop: 6, height: 46, lineHeight: 1.2 }}>{p.name}</div>
                <div style={{ fontWeight: 900, fontSize: 20, color: APP.green, marginTop: 4 }}>{fmt(p.price)} so‘m</div>
              </div>
            )
          })}
        </div>
      </div>
      <BottomNav active={0} />
    </Box>
  )
}

function SearchOverlay() {
  const f = useFrame()
  const q = typed('chuchvara', f, A.typeFrom, 0.5)
  const res = ramp(f, A.typeFrom + 10, A.typeFrom + 20)
  const hl = f >= A.resultTap - 2 ? 1 : 0
  const inP = ramp(f, A.searchOpen, A.searchOpen + 8)
  return (
    <Box style={{ background: `rgba(244,248,245,${inP})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 22px 0', height: 60, borderRadius: 18, background: '#fff', border: `2px solid ${APP.green}`, padding: '0 18px', fontSize: 22, fontWeight: 700, opacity: inP }}>
        🔍 <span>{q}</span><Caret f={f} />
      </div>
      <div style={{ margin: '18px 22px 0', opacity: res, transform: `translateY(${(1 - res) * 16}px)` }}>
        {[PRODUCTS.chuchvara, { ...PRODUCTS.chuchvara, name: 'Musa chuchvara (mol go‘shti)', price: 31900 }].map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14, borderRadius: 20, background: i === 0 && hl ? APP.soft : '#fff', border: `1px solid ${APP.line}`, marginBottom: 12 }}>
            <Thumb src={p.img} size={80} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 21 }}>{p.name}</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: APP.green, marginTop: 6 }}>{fmt(p.price)} so‘m</div>
            </div>
          </div>
        ))}
      </div>
    </Box>
  )
}

// ─── Mahsulot ─────────────────────────────────────────────────

function Product() {
  const f = useFrame()
  const p = PRODUCTS.chuchvara
  const img = pop(f, A.productOpen + 6, 170, 13)
  const added = f >= A.addTap + 2
  const qty = f < A.plus1 ? 1 : f < A.plus2 ? 2 : f < A.minus ? 3 : 2
  const bump = Math.max(pressAt(f, A.plus1), pressAt(f, A.plus2), pressAt(f, A.minus))
  const badge = pop(f, A.addTap + 16, 300, 12)
  // Savatga uchib boradigan rasm
  const fly = interp(f, [A.addTap + 2, A.addTap + 18], [0, 1], ease.inOut)
  const flyOn = f > A.addTap + 1 && f < A.addTap + 19
  const cartPress = pressAt(f, A.cartTap)
  return (
    <Box style={{ background: '#fff' }}>
      <Header title="Mahsulot" right={
        <div style={{ position: 'relative', width: 54, height: 54, borderRadius: 16, background: APP.soft, display: 'grid', placeItems: 'center', fontSize: 26, transform: `scale(${1 - cartPress * 0.1 + badge * 0.0})` }}>
          🛒
          {badge > 0 && <div style={{ position: 'absolute', right: -6, top: -6, minWidth: 26, height: 26, borderRadius: 13, background: APP.red, color: '#fff', fontWeight: 900, fontSize: 15, display: 'grid', placeItems: 'center', transform: `scale(${badge + bump * 0.3})` }}>{qty}</div>}
        </div>
      } />
      <div style={{ margin: '0 22px', marginTop: 14, height: 400, borderRadius: 30, background: 'radial-gradient(circle at 50% 45%, #ffffff, #eaf3ed)', display: 'grid', placeItems: 'center' }}>
        <img src={p.img} style={{ width: 380, height: 360, objectFit: 'contain', transform: `scale(${0.7 + img * 0.3}) rotate(${(1 - img) * -8}deg)` }} />
      </div>
      {flyOn && <img src={p.img} style={{ position: 'absolute', width: 160 - fly * 120, left: 200 + fly * 270, top: 300 - fly * 260 + Math.sin(fly * Math.PI) * -80, opacity: 1 - fly * 0.4, zIndex: 9 }} />}
      <div style={{ padding: '22px 26px 0' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ background: APP.soft, color: APP.green, fontWeight: 800, fontSize: 17, borderRadius: 999, padding: '7px 14px' }}>{p.chip}</span>
          <span style={{ background: '#fff4d6', color: '#8a5a00', fontWeight: 800, fontSize: 17, borderRadius: 999, padding: '7px 14px' }}>❄️ Shok muzlatilgan</span>
        </div>
        <div style={{ fontWeight: 900, fontSize: 32, marginTop: 16, color: APP.ink }}>{p.name}</div>
        <div style={{ fontWeight: 900, fontSize: 36, marginTop: 8, color: APP.green }}>{fmt(p.price)} so‘m</div>
        <div style={{ fontSize: 19, color: APP.muted, marginTop: 14, lineHeight: 1.5 }}>Yangi go‘sht va yupqa xamir. 10 daqiqada qaynatib, issiq-issiq dasturxonga torting.</div>
      </div>
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 26 }}>
        {!added ? (
          <Btn press={pressAt(f, A.addTap)}>🛒 Savatchaga qo‘shish</Btn>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, transform: `scale(${0.9 + pop(f, A.addTap + 2) * 0.1})` }}>
            <div style={{ flex: 1, height: 66, borderRadius: 20, background: APP.soft, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
              <div style={{ width: 50, height: 50, borderRadius: 15, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 900, color: APP.green, transform: `scale(${1 - pressAt(f, A.minus) * 0.15})` }}>−</div>
              <div style={{ fontWeight: 900, fontSize: 30, color: APP.ink, transform: `scale(${1 + bump * 0.25})` }}>{qty}</div>
              <div style={{ width: 50, height: 50, borderRadius: 15, background: APP.green, display: 'grid', placeItems: 'center', fontSize: 32, fontWeight: 900, color: '#fff', transform: `scale(${1 - Math.max(pressAt(f, A.plus1), pressAt(f, A.plus2)) * 0.15})` }}>+</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 24, color: APP.green, minWidth: 150, textAlign: 'right' }}>{fmt(p.price * qty)}<br /><span style={{ fontSize: 16, color: APP.muted }}>so‘m</span></div>
          </div>
        )}
      </div>
    </Box>
  )
}

// ─── Savat ────────────────────────────────────────────────────

function CartDrawer() {
  const f = useFrame()
  const y = sheetY(f, A.cartOpen, A.checkoutOpen + 2, 900)
  const dim = ramp(f, A.cartOpen, A.cartOpen + 10) * (1 - ramp(f, A.checkoutOpen, A.checkoutOpen + 10))
  const total = ORDER_LINES.reduce((s, l, i) => s + (f >= A.cartOpen + 8 + i * 5 ? l.price * l.qty : 0), 0)
  return (
    <Box>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(4,18,11,${dim * 0.5})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 900, transform: `translateY(${y}px)`, background: '#fff', borderRadius: '34px 34px 0 0', boxShadow: '0 -20px 50px rgba(0,0,0,0.25)', padding: '14px 22px 0' }}>
        <div style={{ width: 52, height: 5, borderRadius: 3, background: APP.line, margin: '0 auto 16px' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 900, fontSize: 30 }}>Savat</div>
          <div style={{ color: APP.muted, fontSize: 18, fontWeight: 700 }}>3 xil mahsulot</div>
        </div>
        <div style={{ marginTop: 18 }}>
          {ORDER_LINES.map((l, i) => {
            const s = pop(f, A.cartOpen + 8 + i * 5)
            return (
              <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: `1px solid ${APP.line}`, opacity: s, transform: `translateX(${(1 - s) * 60}px)` }}>
                <Thumb src={l.img} size={92} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 21 }}>{l.name}</div>
                  <div style={{ color: APP.muted, fontSize: 18, marginTop: 6 }}>{l.qty} × {fmt(l.price)} so‘m</div>
                </div>
                <div style={{ fontWeight: 900, fontSize: 21 }}>{fmt(l.price * l.qty)}</div>
              </div>
            )
          })}
        </div>
        <div style={{ position: 'absolute', left: 22, right: 22, bottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontWeight: 800, fontSize: 24 }}>Jami</span>
            <span style={{ fontWeight: 900, fontSize: 30, color: APP.green }}>{fmt(total)} so‘m</span>
          </div>
          <Btn press={pressAt(f, A.orderTap)}>🛍 Buyurtma berish</Btn>
        </div>
      </div>
    </Box>
  )
}

// ─── Buyurtma berish (forma, manzil, to'lov) ─────────────────

function Field({ label, value, focus, glow = 0, placeholder, f }: { label: string; value: string; focus: boolean; glow?: number; placeholder: string; f: number }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: APP.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ position: 'relative', height: 64, borderRadius: 18, background: '#fff', border: `2px solid ${focus || glow ? APP.green : APP.line}`, display: 'flex', alignItems: 'center', padding: '0 18px', fontSize: 23, fontWeight: 700, color: value ? APP.ink : APP.faint, boxShadow: glow ? `0 0 0 ${4 + glow * 4}px rgba(20,163,82,${0.25 * glow})` : 'none' }}>
        {value || placeholder}{focus && <Caret f={f} />}
        {glow > 0 && <span style={{ position: 'absolute', right: 14, fontSize: 22, transform: `scale(${glow})` }}>✨</span>}
      </div>
    </div>
  )
}

const ADDRESS_1 = 'Chilonzor tumani, Bunyodkor ko‘chasi, 12-uy'
const ADDRESS_2 = 'Chilonzor, 9-kvartal, 5-uy'

function Checkout() {
  const f = useFrame()
  const name = typed('Aziza', f, A.nameTap + 4, 0.35)
  const phone = typed('+998 90 123 45 67', f, A.phoneTap + 4, 0.62)
  const glow = f >= A.autofill ? clamp01(spring(f - A.autofill, { stiffness: 160, damping: 10 })) * (1 - ramp(f, A.autofill + 40, A.autofill + 56)) : 0
  const hint = pop(f, A.autofill + 4) * (1 - ramp(f, A.autofill + 44, A.autofill + 54))
  const addrDone = f >= A.mapClose
  const addrText = f >= A.mapClose ? ADDRESS_2 : ''
  const cash = f >= A.cashTap + 2 && f < A.cardTap + 2
  const card = f >= A.cardTap + 2
  const cardOpen = pop(f, A.cardTap + 4, 170, 20)
  const receipt = ramp(f, A.receiptTap + 2, A.receiptDone)
  const receiptOk = pop(f, A.receiptDone)
  const scroll =
    interp(f, [A.scrollAddr, A.scrollAddr + 16], [0, 160], ease.inOut) +
    interp(f, [A.scrollPay, A.scrollPay + 16], [0, 220], ease.inOut) +
    interp(f, [A.scrollSubmit, A.scrollSubmit + 14], [0, 200], ease.inOut)
  return (
    <Box style={{ background: APP.bg }}>
      <Header title="Buyurtma berish" />
      <div style={{ position: 'absolute', top: 74, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px', transform: `translateY(${-scroll}px)` }}>
          <Field label="Ismingiz" value={name} focus={f >= A.nameTap && f < A.phoneTap} glow={glow} placeholder="Ismingizni kiriting" f={f} />
          <Field label="Telefon raqami" value={phone} focus={f >= A.phoneTap && f < A.autofill} glow={glow} placeholder="+998 __ ___ __ __" f={f} />
          {hint > 0 && (
            <div style={{ marginTop: -6, marginBottom: 14, display: 'inline-flex', gap: 8, alignItems: 'center', background: APP.green, color: '#fff', fontWeight: 800, fontSize: 17, borderRadius: 999, padding: '8px 14px', transform: `scale(${hint})`, transformOrigin: 'left center' }}>⚡ Keyingi safar o‘zi to‘ldiriladi</div>
          )}
          <div style={{ fontWeight: 800, fontSize: 18, color: APP.muted, margin: '8px 0 8px' }}>Yetkazish manzili</div>
          <div style={{ height: 78, borderRadius: 18, background: '#fff', border: `2px solid ${addrDone ? APP.green : f >= A.addrTap - 2 && f < A.addrSheet + 4 ? APP.green : APP.line}`, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', transform: `scale(${1 - pressAt(f, A.addrTap) * 0.03})` }}>
            <span style={{ fontSize: 28 }}>📍</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 20, color: addrDone ? APP.ink : APP.faint }}>{addrText || 'Manzilni tanlang'}</span>
            <span style={{ fontSize: 24, color: addrDone ? APP.green : APP.faint }}>{addrDone ? '✓' : '›'}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: APP.muted, margin: '24px 0 8px' }}>To‘lov usuli</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {[['💵', 'Naqd', 'Kuryerga to‘laysiz', cash, A.cashTap], ['💳', 'Karta', 'O‘tkazma + chek', card, A.cardTap]].map(([icon, label, sub, on, at]) => (
              <div key={label as string} style={{ flex: 1, height: 112, borderRadius: 20, background: on ? APP.soft : '#fff', border: `2px solid ${on ? APP.green : APP.line}`, padding: '14px 16px', transform: `scale(${1 - pressAt(f, at as number) * 0.05})` }}>
                <div style={{ fontSize: 30 }}>{icon as string}</div>
                <div style={{ fontWeight: 900, fontSize: 22, marginTop: 4 }}>{label as string}</div>
                <div style={{ fontSize: 15, color: APP.muted, fontWeight: 700 }}>{sub as string}</div>
              </div>
            ))}
          </div>
          {card && (
            <div style={{ marginTop: 16, opacity: cardOpen, transform: `translateY(${(1 - cardOpen) * 20}px)` }}>
              <div style={{ height: 150, borderRadius: 22, padding: 20, color: '#fff', background: 'linear-gradient(135deg, #1f3f9e, #0f2678)', boxShadow: '0 12px 26px -12px rgba(15,38,120,0.7)' }}>
                <div style={{ fontSize: 16, opacity: 0.8, fontWeight: 700 }}>Shu kartaga o‘tkazing</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 28, fontWeight: 800, letterSpacing: 2, marginTop: 14 }}>8600 •••• •••• 4321</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 10, opacity: 0.9 }}>MUSA SERVIS</div>
              </div>
              <div style={{ marginTop: 14, height: 84, borderRadius: 18, border: `2px dashed ${receiptOk > 0 ? APP.green : APP.faint}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', transform: `scale(${1 - pressAt(f, A.receiptTap) * 0.04})` }}>
                <div style={{ width: 56, height: 64, borderRadius: 8, background: receipt > 0 ? '#f6f6f6' : APP.soft, border: `1px solid ${APP.line}`, display: 'grid', placeItems: 'center', fontSize: 26 }}>{receipt > 0 ? '🧾' : '📎'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 19 }}>{receiptOk > 0 ? 'Chek yuklandi' : receipt > 0 ? 'Yuklanmoqda…' : 'To‘lov chekini yuklang'}</div>
                  <div style={{ height: 8, borderRadius: 4, background: APP.line, marginTop: 8, overflow: 'hidden' }}><div style={{ width: `${receipt * 100}%`, height: '100%', background: APP.green }} /></div>
                </div>
                {receiptOk > 0 && <div style={{ width: 40, height: 40, borderRadius: '50%', background: APP.green, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 22, transform: `scale(${receiptOk})` }}>✓</div>}
              </div>
            </div>
          )}
          <div style={{ marginTop: 22, background: '#fff', borderRadius: 20, padding: 18, border: `1px solid ${APP.line}`, fontSize: 19, fontWeight: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: APP.muted }}><span>Mahsulotlar</span><span>{fmt(ORDER_TOTAL)} so‘m</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: APP.muted, marginTop: 8 }}><span>Yetkazish</span><span style={{ color: APP.green }}>Bepul</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 23, fontWeight: 900 }}><span>Jami</span><span>{fmt(ORDER_TOTAL)} so‘m</span></div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 22, right: 22, bottom: 24 }}>
        <Btn press={pressAt(f, A.submitTap)}>✅ Buyurtma berish</Btn>
      </div>
    </Box>
  )
}

function AddressSheet() {
  const f = useFrame()
  const y = sheetY(f, A.addrSheet, A.mapOpen, 470)
  const dim = ramp(f, A.addrSheet, A.addrSheet + 8) * (1 - ramp(f, A.mapOpen, A.mapOpen + 10))
  const opts = [
    ['📍', 'Men turgan joy', 'Joylashuvingiz xaritadan avtomatik olinadi', A.hereTap],
    ['🗺️', 'Boshqa joy', 'Xaritadan o‘zingiz belgilaysiz', -100],
  ] as const
  return (
    <Box>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(4,18,11,${dim * 0.5})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 470, transform: `translateY(${y}px)`, background: '#fff', borderRadius: '34px 34px 0 0', padding: '14px 22px 0' }}>
        <div style={{ width: 52, height: 5, borderRadius: 3, background: APP.line, margin: '0 auto 18px' }} />
        <div style={{ fontWeight: 900, fontSize: 28, marginBottom: 18 }}>Manzilni qo‘shing</div>
        {opts.map(([icon, title, sub, at]) => (
          <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, borderRadius: 22, background: f >= at - 2 && at > 0 ? APP.soft : APP.bg, border: `2px solid ${f >= at - 2 && at > 0 ? APP.green : 'transparent'}`, marginBottom: 14, transform: `scale(${1 - pressAt(f, at) * 0.04})` }}>
            <div style={{ width: 62, height: 62, borderRadius: 18, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 30 }}>{icon}</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22 }}>{title}</div>
              <div style={{ fontSize: 17, color: APP.muted, fontWeight: 600, marginTop: 4 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </Box>
  )
}

/** Stilize xarita (ko'chalar, daryo, bog'). `ox`, `oy` — siljish. */
export function MapArt({ ox = 0, oy = 0, route }: { ox?: number; oy?: number; route?: ReactNode }) {
  const roads = [
    'M-200 300 L800 360', 'M-200 620 L800 560', 'M-200 900 L800 980', 'M120 -100 L60 1400',
    'M360 -100 L420 1400', 'M620 -100 L560 1400', 'M-200 140 L800 40',
  ]
  return (
    <svg width={SW} height={CH} style={{ position: 'absolute', inset: 0 }}>
      <rect width={SW} height={CH} fill="#eef1e6" />
      <g transform={`translate(${ox} ${oy})`}>
        {Array.from({ length: 36 }, (_, i) => (
          <rect key={i} x={-180 + (i % 6) * 170 + rand(i) * 20} y={-120 + Math.floor(i / 6) * 230 + rand(i + 50) * 20} width={120} height={150} rx={14} fill={i % 7 === 3 ? '#cfe8c0' : '#e2e6da'} />
        ))}
        <path d="M-200 760 C 100 700, 260 820, 520 760 S 820 700, 900 760" fill="none" stroke="#a9d3f5" strokeWidth="46" />
        {roads.map((d, i) => <path key={i} d={d} stroke="#fff" strokeWidth={i === 1 || i === 4 ? 30 : 20} fill="none" strokeLinecap="round" />)}
        {roads.map((d, i) => <path key={`c${i}`} d={d} stroke="#f2d27a" strokeWidth={i === 1 || i === 4 ? 4 : 0} strokeDasharray="18 18" fill="none" />)}
        {route}
      </g>
    </svg>
  )
}

function Pin({ drop, pulse = 0 }: { drop: number; pulse?: number }) {
  return (
    <div style={{ position: 'absolute', left: SW / 2 - 30, top: CH / 2 - 92 - (1 - drop) * 220, width: 60, height: 92, opacity: drop > 0 ? 1 : 0 }}>
      <div style={{ position: 'absolute', left: 30 - 40 - pulse * 30, top: 76 - 14 - pulse * 10, width: 80 + pulse * 60, height: 28 + pulse * 20, borderRadius: '50%', background: `rgba(10,122,61,${0.25 * (1 - pulse)})` }} />
      <svg width="60" height="80" viewBox="0 0 60 80" style={{ position: 'absolute', top: 0 }}>
        <path d="M30 78C30 78 4 46 4 28a26 26 0 0 1 52 0c0 18-26 50-26 50z" fill="#e8453c" stroke="#fff" strokeWidth="4" />
        <circle cx="30" cy="28" r="10" fill="#fff" />
      </svg>
    </div>
  )
}

function MapPicker() {
  const f = useFrame()
  const locating = f >= A.mapOpen + 6 && f < A.pinDrop
  const drop = clamp01(spring(f - A.pinDrop, { stiffness: 260, damping: 14 }))
  const pulse = f >= A.pinDrop + 6 ? ((f - A.pinDrop - 6) % 30) / 30 : 0
  const drag = interp(f, [A.dragFrom + 4, A.dragTo], [0, 1], ease.inOut)
  const lift = f >= A.dragFrom + 2 && f <= A.dragTo + 2 ? 1 : 0
  const addr = f >= A.dragTo + 2 ? ADDRESS_2 : typed(ADDRESS_1, f, A.pinDrop + 6, 1.4)
  return (
    <Box>
      <div style={{ position: 'absolute', inset: 0 }}><MapArt ox={drag * 80} oy={drag * 90} /></div>
      <div style={{ position: 'absolute', left: 16, right: 16, top: 16, height: 64, borderRadius: 20, background: '#fff', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', fontWeight: 800, fontSize: 22 }}>‹ <span>Manzilni belgilang</span></div>
      {locating && (
        <div style={{ position: 'absolute', left: SW / 2 - 60, top: CH / 2 - 60, width: 120, height: 120 }}>
          {[0, 15].map((d) => {
            const k = ((f - A.mapOpen + d) % 30) / 30
            return <div key={d} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `rgba(51,144,236,${0.35 * (1 - k)})`, transform: `scale(${0.3 + k})` }} />
          })}
          <div style={{ position: 'absolute', left: 46, top: 46, width: 28, height: 28, borderRadius: '50%', background: '#3390ec', border: '5px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-lift * 18}px)` }}><Pin drop={drop} pulse={pulse} /></div>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 22, borderRadius: 26, background: '#fff', boxShadow: '0 -6px 30px rgba(0,0,0,0.18)', padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: APP.muted }}>{locating ? 'Joylashuvingiz aniqlanmoqda…' : 'Yetkazish manzili'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, minHeight: 58, lineHeight: 1.3 }}>{addr}</div>
        <Btn press={pressAt(f, A.saveTap)} style={{ marginTop: 12 }}>Shu manzil</Btn>
      </div>
    </Box>
  )
}

// ─── Muvaffaqiyat ─────────────────────────────────────────────

function Success() {
  const f = useFrame()
  const bg = ramp(f, A.success, A.success + 8)
  const circle = clamp01(spring(f - A.success - 4, { stiffness: 200, damping: 12 }))
  const check = ramp(f, A.success + 12, A.success + 26, ease.out)
  const title = pop(f, sec(51.0))
  const meta = pop(f, sec(51.4))
  const conf = f - A.success
  return (
    <Box style={{ background: `rgba(255,255,255,${bg})` }}>
      {conf > 6 && conf < 80 && (
        <svg width={SW} height={CH} style={{ position: 'absolute', inset: 0 }}>
          {Array.from({ length: 46 }, (_, i) => {
            const a = rand(i) * Math.PI * 2
            const v = 6 + rand(i + 9) * 10
            const t = conf - 6
            const x = SW / 2 + Math.cos(a) * v * t
            const y = 380 + Math.sin(a) * v * t + 0.32 * t * t
            const c = ['#0a7a3d', '#ffd76a', '#14a352', '#3390ec', '#ff7a59'][i % 5]
            return <rect key={i} x={x} y={y} width={10} height={18} rx={3} fill={c} transform={`rotate(${t * 12 + i * 30} ${x} ${y})`} opacity={1 - t / 74} />
          })}
        </svg>
      )}
      <div style={{ position: 'absolute', left: SW / 2 - 110, top: 260, width: 220, height: 220, borderRadius: '50%', background: `linear-gradient(160deg, #14a352, ${APP.green})`, transform: `scale(${circle})`, boxShadow: '0 24px 50px -16px rgba(10,122,61,0.7)', display: 'grid', placeItems: 'center' }}>
        <svg width="120" height="120" viewBox="0 0 120 120"><path d="M30 62 L52 84 L92 40" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="100" strokeDashoffset={100 - check * 100} /></svg>
      </div>
      <div style={{ position: 'absolute', left: 30, right: 30, top: 530, textAlign: 'center', transform: `scale(${0.8 + title * 0.2})`, opacity: title }}>
        <div style={{ fontWeight: 900, fontSize: 36, color: APP.ink }}>Buyurtma qabul qilindi!</div>
      </div>
      <div style={{ position: 'absolute', left: 50, right: 50, top: 610, opacity: meta, transform: `translateY(${(1 - meta) * 20}px)`, background: APP.bg, borderRadius: 24, padding: 22, textAlign: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 28, color: APP.green }}>{ORDER_LABEL}</div>
        <div style={{ fontWeight: 700, fontSize: 20, color: APP.muted, marginTop: 8 }}>Jami: {fmt(ORDER_TOTAL)} so‘m · Karta</div>
      </div>
    </Box>
  )
}

// ─── Buyurtmalar, kuzatish, yetkazildi ────────────────────────

function Orders() {
  const f = useFrame()
  const transit = f >= A.inTransit
  const tracker = pop(f, A.inTransit + 6, 180, 16)
  const carX = ((f - A.inTransit) * 4) % 300
  return (
    <Box style={{ background: APP.bg }}>
      <Header title="Buyurtmalarim" back={false} />
      <div style={{ padding: '20px 22px' }}>
        <div style={{ background: '#fff', borderRadius: 24, padding: 20, border: `1px solid ${APP.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 24 }}>{ORDER_LABEL}</div>
            <div style={{ fontWeight: 800, fontSize: 16, padding: '6px 12px', borderRadius: 999, background: transit ? '#e9edfb' : APP.soft, color: transit ? '#16359e' : APP.green, transform: `scale(${1 + pressAt(f, A.inTransit) * 0.15})` }}>{transit ? '🚚 Yetkazilmoqda' : '✅ Qabul qilindi'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {ORDER_LINES.map((l) => <Thumb key={l.name} src={l.img} size={74} />)}
          </div>
          <div style={{ marginTop: 14, fontWeight: 800, fontSize: 20 }}>{fmt(ORDER_TOTAL)} so‘m</div>
        </div>
      </div>
      {tracker > 0 && (
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 110, borderRadius: 24, background: 'linear-gradient(135deg, #0b8443, #04542a)', color: '#fff', padding: '18px 20px', transform: `translateY(${(1 - tracker) * 160}px) scale(${1 - pressAt(f, A.trackerTap) * 0.04})`, boxShadow: '0 16px 30px -12px rgba(10,122,61,0.7)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 21 }}><span>Kuryer yo‘lda</span><span style={{ background: APP.yellow, color: '#3a2a00', borderRadius: 10, padding: '2px 10px' }}>~12 daq</span></div>
          <div style={{ position: 'relative', height: 40, marginTop: 12 }}>
            <div style={{ position: 'absolute', left: 0, right: 30, top: 26, borderTop: '3px dashed rgba(255,255,255,0.5)' }} />
            <div style={{ position: 'absolute', left: carX, top: 0, fontSize: 30 }}>🚗</div>
            <div style={{ position: 'absolute', right: 0, top: 0, fontSize: 30 }}>📍</div>
          </div>
        </div>
      )}
      <BottomNav active={3} />
    </Box>
  )
}

const ROUTE = [[90, 90], [110, 340], [420, 380], [380, 620], [300, 690]] as const
function along(p: number): [number, number] {
  const segs = ROUTE.slice(1).map((pt, i) => Math.hypot(pt[0] - ROUTE[i][0], pt[1] - ROUTE[i][1]))
  const total = segs.reduce((a, b) => a + b, 0)
  let d = p * total
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) {
      const k = d / segs[i]
      return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * k, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * k]
    }
    d -= segs[i]
  }
  return [ROUTE[ROUTE.length - 1][0], ROUTE[ROUTE.length - 1][1]]
}

function LiveMap() {
  const f = useFrame()
  const p = interp(f, [A.trackMap + 6, A.carEnd], [0, 1], ease.inOut)
  const [cx, cy] = along(p)
  const [nx] = along(Math.min(1, p + 0.01))
  const right = nx >= cx
  const eta = Math.max(1, Math.round(12 * (1 - p)))
  const door = f >= A.door
  const doorPop = pop(f, A.door, 240, 12)
  const path = `M${ROUTE.map((pt) => pt.join(' ')).join(' L')}`
  return (
    <Box>
      <MapArt ox={0} oy={0} route={
        <>
          <path d={path} fill="none" stroke="#0a7a3d" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
          <path d={path} fill="none" stroke="#0a7a3d" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2000" strokeDashoffset={-2000 * p} />
        </>
      } />
      <div style={{ position: 'absolute', left: 300 - 28, top: 690 - 70, fontSize: 52 }}>🏠</div>
      <div style={{ position: 'absolute', left: cx - 30, top: cy - 30, width: 60, height: 60, borderRadius: '50%', background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,0.3)', display: 'grid', placeItems: 'center', fontSize: 34, transform: `scale(${1 + doorPop * 0.25})` }}>
        <span style={{ transform: right ? 'scaleX(-1)' : 'none' }}>🚗</span>
      </div>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 22, borderRadius: 26, background: door ? APP.yellow : '#fff', boxShadow: '0 -6px 30px rgba(0,0,0,0.18)', padding: 20, display: 'flex', alignItems: 'center', gap: 16, transform: `scale(${1 + doorPop * 0.04 - (door ? 0.04 : 0)})` }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: APP.green, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 28 }}>J</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>{door ? '📍 Kuryer eshik oldida!' : 'Jasur · kuryer'}</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: door ? '#5a3b00' : APP.muted, marginTop: 4 }}>{door ? 'Chiqib kutib oling' : `Yo‘lda · ~${eta} daqiqa`}</div>
        </div>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: door ? '#fff' : APP.soft, display: 'grid', placeItems: 'center', fontSize: 26 }}>📞</div>
      </div>
    </Box>
  )
}

function RatingSheet() {
  const f = useFrame()
  const y = sheetY(f, A.rate, -1, 520)
  const dim = ramp(f, A.rate, A.rate + 8)
  const starAt = (i: number) => sec(64.45) + i * 4
  const sent = f >= A.sendTap + 2
  return (
    <Box>
      <div style={{ position: 'absolute', inset: 0, background: `rgba(4,18,11,${dim * 0.5})` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 520, transform: `translateY(${y}px)`, background: '#fff', borderRadius: '34px 34px 0 0', padding: '14px 26px 0', textAlign: 'center' }}>
        <div style={{ width: 52, height: 5, borderRadius: 3, background: APP.line, margin: '0 auto 18px' }} />
        <div style={{ width: 84, height: 84, borderRadius: '50%', margin: '0 auto', background: APP.green, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 36 }}>J</div>
        <div style={{ fontWeight: 900, fontSize: 28, marginTop: 14 }}>{sent ? 'Rahmat! 💚' : 'Buyurtmangiz yetkazildi!'}</div>
        <div style={{ fontWeight: 700, fontSize: 19, color: APP.muted, marginTop: 6 }}>Jasur · {ORDER_LABEL} — yetkazish qanday bo‘ldi?</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const on = f >= starAt(i)
            const s = on ? 1 + 0.35 * Math.exp(-(f - starAt(i)) / 4) * Math.sin(((f - starAt(i)) / 5) * Math.PI) : 1
            return <div key={i} style={{ fontSize: 58, color: on ? '#ffb21e' : '#d9dfdb', transform: `scale(${s})`, textShadow: on ? '0 4px 12px rgba(255,178,30,0.45)' : 'none' }}>★</div>
          })}
        </div>
        <div style={{ position: 'absolute', left: 26, right: 26, bottom: 30 }}>
          <Btn press={pressAt(f, A.sendTap)}>Yuborish</Btn>
        </div>
      </div>
    </Box>
  )
}

/** «Muzdek holda» — telefon ustida katta quti va qor. */
export function ColdBox() {
  const f = useFrame()
  if (f < A.coldBox - 2 || f > A.doneBanner + 50) return null
  const p = clamp01(spring(f - A.coldBox, { stiffness: 190, damping: 12 }))
  const out = ramp(f, A.doneBanner + 34, A.doneBanner + 48, ease.in)
  const l = f - A.coldBox
  return (
    <Box style={{ zIndex: 45, background: `rgba(225,240,250,${0.55 * p * (1 - out)})` }}>
      <svg width={SW} height={SH} style={{ position: 'absolute', inset: 0, opacity: 1 - out }}>
        {Array.from({ length: 30 }, (_, i) => {
          const x = rand(i * 3) * SW
          const y = ((rand(i * 7) * SH + l * (3 + rand(i) * 4)) % SH)
          return <text key={i} x={x} y={y} fontSize={20 + rand(i * 11) * 26} fill="#fff" opacity="0.9">❄</text>
        })}
      </svg>
      <div style={{ position: 'absolute', left: SW / 2 - 170, top: 380, width: 340, transform: `scale(${p * (1 - out * 0.4)}) rotate(${(1 - p) * -12}deg)`, opacity: 1 - out, textAlign: 'center' }}>
        <div style={{ position: 'relative', height: 250, borderRadius: 30, background: 'linear-gradient(160deg, #e8f6ff, #b9e0f7)', border: '5px solid #fff', boxShadow: '0 26px 50px -18px rgba(30,100,160,0.6)', display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['/chuchvara.webp', '/kotlet.webp', '/somsa.webp'].map((src, i) => <img key={src} src={src} style={{ width: 100, height: 100, objectFit: 'contain', transform: `translateY(${Math.sin((l + i * 8) / 6) * 4}px)` }} />)}
          </div>
          <div style={{ position: 'absolute', top: -22, right: -22, width: 70, height: 70, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', fontSize: 40, boxShadow: '0 6px 14px rgba(0,0,0,0.15)' }}>❄️</div>
        </div>
        <div style={{ marginTop: 22, display: 'inline-block', fontFamily: FONT_DISPLAY, fontSize: 40, color: '#0b4f7a', background: '#fff', borderRadius: 20, padding: '10px 22px', boxShadow: '0 10px 24px -10px rgba(0,60,100,0.5)' }}>Muzdek holda!</div>
      </div>
    </Box>
  )
}

// ─── Mini app konteyneri ──────────────────────────────────────

/** Ekran oralig'i: [from, to). */
const on = (f: number, a: number, b: number) => f >= a && f < b

export function MiniApp() {
  const f = useFrame()
  if (f < A.open || f > A.end) return null
  const y = sheetY(f, A.open)
  const splash = 1 - ramp(f, A.splashOut - 4, A.splashOut + 6)
  const logo = pop(f, A.open + 8, 200, 11)
  return (
    <Box style={{ transform: `translateY(${y}px)`, background: '#fff', borderRadius: f < A.open + 20 ? 30 : 0, overflow: 'hidden', boxShadow: '0 -20px 40px rgba(0,0,0,0.25)' }}>
      <StatusBar bg="#fff" />
      {/* Telegram mini app sarlavhasi */}
      <div style={{ position: 'absolute', top: 64, left: 0, right: 0, height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', background: '#fff', borderBottom: `1px solid ${APP.line}`, zIndex: 20, fontFamily: FONT }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#3390ec' }}>✕ Yopish</span>
        <span style={{ fontWeight: 900, fontSize: 22 }}>MUSA</span>
        <span style={{ fontSize: 26, color: '#3390ec' }}>⋯</span>
      </div>
      <div style={{ position: 'absolute', top: CONTENT_TOP, left: 0, right: 0, height: CH, overflow: 'hidden' }}>
        {on(f, A.splashOut - 6, A.productOpen + 22) && <Home />}
        {on(f, A.searchOpen, A.productOpen + 22) && <SearchOverlay />}
        {on(f, A.productOpen, A.checkoutOpen + 24) && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateX(${pushX(f, A.productOpen)}px)`, boxShadow: '-10px 0 30px rgba(0,0,0,0.12)' }}><Product /></div>
        )}
        {on(f, A.cartOpen, A.checkoutOpen + 14) && <CartDrawer />}
        {on(f, A.checkoutOpen, A.orders + 10) && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateX(${pushX(f, A.checkoutOpen)}px)` }}><Checkout /></div>
        )}
        {on(f, A.addrSheet, A.mapOpen + 14) && <AddressSheet />}
        {on(f, A.mapOpen, A.mapClose + 14) && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateX(${f < A.mapClose ? pushX(f, A.mapOpen) : (1 - pushX(f, A.mapClose) / SW) * SW}px)` }}><MapPicker /></div>
        )}
        {on(f, A.success, A.orders + 12) && <div style={{ position: 'absolute', inset: 0, opacity: 1 - ramp(f, A.orders, A.orders + 10) }}><Success /></div>}
        {on(f, A.orders, A.trackMap + 16) && <div style={{ position: 'absolute', inset: 0, opacity: ramp(f, A.orders, A.orders + 10) }}><Orders /></div>}
        {on(f, A.trackMap, A.end + 1) && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateX(${pushX(f, A.trackMap)}px)` }}><LiveMap /></div>
        )}
        {on(f, A.rate, A.end + 1) && <RatingSheet />}
        {/* Ochilish: MUSA belgisi */}
        {splash > 0 && (
          <Box style={{ background: `radial-gradient(100% 70% at 50% 40%, #14a352, ${APP.green} 50%, ${APP.greenDeep})`, opacity: splash, display: 'grid', placeItems: 'center' }}>
            <div style={{ textAlign: 'center', transform: `scale(${0.6 + logo * 0.4})` }}>
              <div style={{ width: 170, height: 170, margin: '0 auto', borderRadius: 44, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}><img src="/musa-mark.webp" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
              <div style={{ color: '#fff', fontFamily: FONT_DISPLAY, fontSize: 46, marginTop: 22 }}>MUSA</div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: 18, letterSpacing: 2 }}>MUZLATILGAN MAHSULOTLAR</div>
            </div>
          </Box>
        )}
      </div>
      {/* Telegram bildirishnomalari */}
      <TgBanner at={A.banner1} out={A.banner2 - 4} text={<>✅ <b>{ORDER_LABEL}</b> buyurtmangiz tasdiqlandi va tayyorlanmoqda.</>} />
      <TgBanner at={A.banner2} out={A.trackerTap - 6} text={<>🚚 <b>{ORDER_LABEL}</b> buyurtmangiz yo‘lga chiqdi. Kuryer tez orada bog‘lanadi.</>} />
      <TgBanner at={A.doneBanner} out={A.rate - 4} text={<>🎉 <b>{ORDER_LABEL}</b> buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!</>} />
      <ColdBox />
    </Box>
  )
}
