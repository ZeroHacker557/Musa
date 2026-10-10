import { ease, interp, spring } from '../anim'
import { useFrame } from '../frame'
import { FONT } from '../components'
import { APP, Box, Caret, SH, SW, StatusBar, TG, pop, pushX, ramp, typed } from './ui'
import { sec } from './timeline'

/**
 * Telegram ekranlari: chatlar ro'yxati → qidiruv → bot → START → til →
 * salomlashuv → «Katalogni ochish». Hammasi GLOBAL kadr bilan.
 */

export const T = {
  searchTap: sec(5.35),
  typeFrom: sec(5.6),
  resultTap: sec(6.85),
  openBot: sec(6.98),
  startTap: sec(8.15),
  userStart: sec(8.32),
  langMsg: sec(8.75),
  langTap: sec(9.65),
  langEdit: sec(9.9),
  welcome: sec(10.45),
  catalogTap: sec(12.2),
  appOpen: sec(12.4),
}

const QUERY = 'musauz_bot'

/** Bayroq (Windows'da emoji bayroqlar harf bo'lib chiqadi). */
function Flag({ c }: { c: 'uz' | 'ru' }) {
  const stripes = c === 'uz' ? ['#1eb5e6', '#fff', '#1eb53a'] : ['#fff', '#0039a6', '#d52b1e']
  return (
    <svg width="30" height="20" viewBox="0 0 30 20" style={{ verticalAlign: '-3px', marginRight: 8, borderRadius: 3, boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }}>
      {stripes.map((col, i) => <rect key={i} y={i * 6.67} width="30" height="6.7" fill={col} />)}
      {c === 'uz' && <><rect y="6.3" width="30" height="0.8" fill="#ce1126" /><rect y="12.9" width="30" height="0.8" fill="#ce1126" /><circle cx="6" cy="3.4" r="2.2" fill="#fff" /><circle cx="6.9" cy="3.4" r="1.9" fill="#1eb5e6" /></>}
    </svg>
  )
}

/** Bot avatari (MUSA belgisi). */
export function BotAvatar({ size = 52 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#ffd43b', flexShrink: 0, display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}>
      <img src="/musa-mark.webp" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
}

function Verified() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginLeft: 4, flexShrink: 0 }}>
      <path d="M12 1.5l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3 1 3-2.6 1.9-1 3-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3L2.6 16l1-3-1-3 2.6-1.9 1-3 3.2.2z" fill={TG.blue} />
      <path d="M7.5 12.2l3 3 6-6.2" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Chatlar ro'yxati va qidiruv. */
function ChatList() {
  const f = useFrame()
  const query = typed(QUERY, f, T.typeFrom, 0.42)
  const searching = f >= T.searchTap + 2
  const results = ramp(f, T.typeFrom + 10, T.typeFrom + 20)
  const hl = f >= T.resultTap - 2 && f < T.openBot + 6 ? 1 : 0
  const chats = [
    { name: 'Onam ❤️', msg: 'Kechqurun kelasanmi?', time: '9:12', c: '#e17076' },
    { name: 'Ish guruhi', msg: 'Bobur: Hisobot tayyor', time: '8:47', c: '#7bc862' },
    { name: 'Aziz', msg: 'Ertaga ko‘rishamiz 👍', time: 'Kecha', c: '#65aadd' },
    { name: 'Uy-joy kanali', msg: 'Yangi e’lonlar', time: 'Kecha', c: '#ee7aae' },
  ]
  return (
    <Box style={{ background: '#fff' }}>
      <StatusBar />
      <div style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', fontWeight: 800, fontSize: 28, opacity: 1 - ramp(f, T.searchTap, T.searchTap + 8) }}>Chatlar</div>
      <div style={{ position: 'absolute', top: interp(f, [T.searchTap, T.searchTap + 10], [122, 76], ease.out), left: 20, right: 20, height: 54, borderRadius: 16, background: '#f0f1f4', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', fontSize: 23, color: query ? '#000' : '#8e8e93', boxShadow: searching ? `0 0 0 3px ${TG.blue}55` : 'none' }}>
        <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" fill="none" stroke="#8e8e93" strokeWidth="2.6" /><path d="M16 16l5 5" stroke="#8e8e93" strokeWidth="2.6" strokeLinecap="round" /></svg>
        <span style={{ fontWeight: 600 }}>{query || 'Qidirish'}</span>
        {searching && <Caret f={f} color={TG.blue} />}
      </div>
      {/* Oddiy chatlar — qidiruv boshlanganda yo'qoladi */}
      <div style={{ position: 'absolute', top: 196, left: 0, right: 0, opacity: 1 - results }}>
        {chats.map((c) => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 16, height: 96, padding: '0 22px', borderBottom: `1px solid ${TG.line}` }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: c.c, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 26 }}>{c.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 23 }}>{c.name}</div>
              <div style={{ color: TG.sub, fontSize: 20, marginTop: 4 }}>{c.msg}</div>
            </div>
            <div style={{ color: TG.sub, fontSize: 18 }}>{c.time}</div>
          </div>
        ))}
      </div>
      {/* Qidiruv natijasi */}
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, opacity: results, transform: `translateY(${(1 - results) * 20}px)` }}>
        <div style={{ padding: '14px 22px', fontSize: 18, fontWeight: 700, color: TG.sub, background: '#f6f6f8' }}>Botlar va kanallar</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 104, padding: '0 22px', background: hl ? '#e8f1fd' : '#fff' }}>
          <BotAvatar size={66} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 24 }}>MUSA <Verified /></div>
            <div style={{ color: TG.blue, fontSize: 20, marginTop: 4, fontWeight: 600 }}>@musauz_bot · bot</div>
          </div>
        </div>
      </div>
    </Box>
  )
}

/** Xabar pufakchasi (bot — chapda, mijoz — o'ngda). */
function Bubble({ out = false, children, width }: { out?: boolean; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', padding: '0 14px' }}>
      <div style={{ maxWidth: width ?? 440, width, background: out ? TG.out : TG.in, borderRadius: out ? '20px 20px 6px 20px' : '20px 20px 20px 6px', padding: '12px 16px', fontSize: 21, lineHeight: 1.38, color: '#111', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
        {children}
      </div>
    </div>
  )
}

function InlineBtn({ label, green = false, flash = 0 }: { label: React.ReactNode; green?: boolean; flash?: number }) {
  return (
    <div style={{ flex: 1, height: 54, borderRadius: 14, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 21, color: '#fff', background: green ? `rgba(49,162,76,${0.92 + flash * 0.08})` : `rgba(60,90,60,${0.42 + flash * 0.3})`, boxShadow: green ? '0 4px 12px rgba(20,120,50,0.35)' : 'none', transform: `scale(${1 - flash * 0.05})` }}>
      {label}
    </div>
  )
}

/** Bot bilan chat. */
function BotChat() {
  const f = useFrame()
  const started = f >= T.startTap + 2
  // Xabarlar paydo bo'lishi (balandligini prujina bilan egallaydi)
  const pUser = pop(f, T.userStart)
  const pLang = pop(f, T.langMsg)
  const pWelcome = pop(f, T.welcome, 200, 18)
  const edit = ramp(f, T.langEdit, T.langEdit + 8)
  const langH = 182 - edit * 70
  const welcomeH = 372
  const bottom = 1060
  const yWelcome = bottom - welcomeH * pWelcome
  const yLang = yWelcome - 14 * pWelcome - langH * pLang
  const yUser = yLang - 14 * pLang - 62 * pUser
  const langFlash = interp(f, [T.langTap - 2, T.langTap + 2, T.langTap + 10], [0, 1, 0])
  const catFlash = interp(f, [T.catalogTap - 2, T.catalogTap + 2, T.catalogTap + 12], [0, 1, 0])
  const catPulse = f > T.welcome + 20 && f < T.catalogTap ? (Math.sin((f - T.welcome) / 4) + 1) / 2 : 0
  const intro = 1 - ramp(f, T.startTap, T.startTap + 8)

  return (
    <Box style={{ background: TG.chatBg }}>
      {/* Devor naqshi */}
      <svg width={SW} height={SH} style={{ position: 'absolute', inset: 0, opacity: 0.18 }}>
        {Array.from({ length: 40 }, (_, i) => (
          <text key={i} x={(i % 5) * 120 + (Math.floor(i / 5) % 2) * 60} y={160 + Math.floor(i / 5) * 130} fontSize="34" fill="#3b6b2a">{['❄', '🥟', '✦', '🍦'][i % 4]}</text>
        ))}
      </svg>
      <StatusBar bg="#fff" />
      <div style={{ position: 'absolute', top: 64, left: 0, right: 0, height: 74, background: '#fff', display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', borderBottom: `1px solid ${TG.line}`, zIndex: 5 }}>
        <svg width="20" height="30" viewBox="0 0 20 30"><path d="M15 3L4 15l11 12" fill="none" stroke={TG.blue} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <BotAvatar size={52} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 800, fontSize: 23 }}>MUSA <Verified /></div>
          <div style={{ color: TG.sub, fontSize: 18 }}>bot</div>
        </div>
      </div>

      {/* START dan oldin: bot tanishtiruvi */}
      {intro > 0 && (
        <div style={{ position: 'absolute', top: 330, left: 60, right: 60, opacity: intro, transform: `scale(${0.9 + intro * 0.1})`, background: 'rgba(255,255,255,0.92)', borderRadius: 24, padding: 22, textAlign: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><BotAvatar size={96} /></div>
          <div style={{ fontWeight: 800, fontSize: 24, marginTop: 14 }}>Bu bot nima qila oladi?</div>
          <div style={{ fontSize: 20, color: '#333', marginTop: 10, lineHeight: 1.4 }}>🥟 MUSA rasmiy do‘koni — muzlatilgan mahsulotlarni uyingizgacha yetkazamiz.</div>
        </div>
      )}

      {/* Xabarlar */}
      {pUser > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: yUser, opacity: pUser }}>
          <Bubble out><span style={{ color: TG.blue, fontWeight: 600 }}>/start</span></Bubble>
        </div>
      )}
      {pLang > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: yLang, opacity: pLang, transform: `scale(${0.9 + pLang * 0.1})`, transformOrigin: 'left bottom' }}>
          <Bubble width={430}>
            {edit < 0.5
              ? <><b><Flag c="uz" />Tilni tanlang</b><br /><b><Flag c="ru" />Выберите язык</b></>
              : <>✅ Til o‘zbekchaga o‘zgartirildi.</>}
          </Bubble>
          {edit < 1 && (
            <div style={{ display: 'flex', gap: 8, padding: '8px 14px 0', width: 458, opacity: 1 - edit }}>
              <InlineBtn label={<span><Flag c="uz" />O‘zbekcha</span>} flash={langFlash} />
              <InlineBtn label={<span><Flag c="ru" />Русский</span>} />
            </div>
          )}
        </div>
      )}
      {pWelcome > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: yWelcome, opacity: pWelcome, transform: `scale(${0.9 + pWelcome * 0.1})`, transformOrigin: 'left bottom' }}>
          <Bubble width={470}>
            Assalomu alaykum, <b>Aziza</b>! 👋<br /><br />
            🥟 <b>MUSA rasmiy do‘koniga xush kelibsiz!</b><br />
            <i style={{ color: '#444' }}>Muzlatilgan mahsulotlar — yangi xomashyo, shok muzlatish.</i><br /><br />
            👇 <i>Buyurtmani boshlash uchun quyidagi tugmani bosing:</i>
          </Bubble>
          <div style={{ display: 'flex', padding: '8px 14px 0', width: 498 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: -6, borderRadius: 18, border: `4px solid rgba(255,215,106,${catPulse * 0.9})`, transform: `scale(${1 + catPulse * 0.03})` }} />
              <InlineBtn label="🥟 Katalogni ochish" green flash={catFlash} />
            </div>
          </div>
        </div>
      )}

      {/* Pastki panel: START yoki xabar maydoni */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, background: '#fff', borderTop: `1px solid ${TG.line}`, display: 'flex', alignItems: 'center', padding: '0 16px 10px', zIndex: 5 }}>
        {!started ? (
          <div style={{ flex: 1, height: 62, borderRadius: 16, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 25, letterSpacing: 2, color: '#fff', background: TG.blue, transform: `scale(${1 - interp(f, [T.startTap - 2, T.startTap + 1, T.startTap + 6], [0, 0.06, 0])})`, boxShadow: '0 6px 16px rgba(51,144,236,0.4)' }}>START</div>
        ) : (
          <>
            <div style={{ height: 50, borderRadius: 14, padding: '0 16px', display: 'grid', placeItems: 'center', background: TG.blue, color: '#fff', fontWeight: 800, fontSize: 20 }}>🥟 Katalog</div>
            <div style={{ flex: 1, marginLeft: 12, color: '#9a9a9a', fontSize: 21 }}>Xabar</div>
          </>
        )}
      </div>
    </Box>
  )
}

/** Telegram qismi: ro'yxat → bot (chapga surilish bilan). */
export function TelegramScreens() {
  const f = useFrame()
  if (f > T.appOpen + 40) return null
  const x = pushX(f, T.openBot)
  return (
    <Box>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${f >= T.openBot ? -(SW - x) * 0.3 : 0}px)`, filter: f >= T.openBot ? `brightness(${0.85 + (x / SW) * 0.15})` : undefined }}>
        <ChatList />
      </div>
      {f >= T.openBot && (
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${x}px)`, boxShadow: '-10px 0 30px rgba(0,0,0,0.15)' }}>
          <BotChat />
        </div>
      )}
    </Box>
  )
}

/**
 * Telegram ichki bildirishnomasi (tepadan tushadi).
 * `at` — chiqish, `out` — ketish kadri.
 */
export function TgBanner({ at, out, text }: { at: number; out: number; text: React.ReactNode }) {
  const f = useFrame()
  if (f < at - 1 || f > out + 14) return null
  const p = spring(f - at, { stiffness: 210, damping: 18 })
  const q = interp(f, [out, out + 12], [0, 1], ease.in)
  const y = -150 + p * 220 - q * 240
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, top: y, zIndex: 50, borderRadius: 26, background: 'rgba(250,250,252,0.97)', boxShadow: '0 14px 34px rgba(0,0,0,0.22)', padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', fontFamily: FONT }}>
      <BotAvatar size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: TG.sub }}><b style={{ color: '#111', fontSize: 20 }}>MUSA</b><span>hozir</span></div>
        <div style={{ fontSize: 20, lineHeight: 1.35, marginTop: 4, color: '#222' }}>{text}</div>
      </div>
    </div>
  )
}

export { APP }
