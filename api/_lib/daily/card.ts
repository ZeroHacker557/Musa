import { FONTS } from './fonts.js'

/**
 * Kunlik e’lon rasmi: 4 ta mahsulot, narxlari bilan, bir xil shablonda.
 *
 * satori — tartib (flexbox) va matnni SVG ga aylantiradi, resvg — PNG ga.
 * Ikkalasi ham og‘ir, shuning uchun faqat rasm kerak bo‘lganda yuklanadi.
 */

export type CardProduct = {
  name: string
  price: number
  oldPrice?: number | null
  /** data: URI (png/jpeg/webp) yoki null — rasm o‘rnida belgi. */
  image: string | null
}

export type CardInput = {
  products: CardProduct[]
  /** Sarlavhaning oq qatori: «BUGUN BUYURTMA BERING —». */
  title: string
  /** Sarlavhaning sariq qatori: «MUZDEK HOLDA YETKAZAMIZ». */
  accent: string
  /** Pastki chap: «@musauz_bot». */
  footer: string
  /** Pastki o‘ng: «Yetkazish 15 000 so‘m». */
  footerNote: string
  /** Yuqori o‘ng: «1-oktabr». */
  dateLabel: string
}

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

const C = {
  green: '#0a7a3d',
  greenDeep: '#05522a',
  greenBright: '#14a352',
  yellow: '#ffd43b',
  gold: '#f5b800',
  blue: '#1f3f9e',
  ink: '#10231a',
  muted: '#5d6f64',
  red: '#e8453c',
  white: '#ffffff',
  tile: '#f1f6f2',
}

type Style = Record<string, string | number>
type Node = { type: string; props: { style?: Style; children?: unknown; [key: string]: unknown } }

/** Kichik «JSX» — satori oddiy obyektlarni ham qabul qiladi. */
function h(type: string, style: Style, ...children: unknown[]): Node {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false)
  return { type, props: { style: { display: 'flex', ...style }, children: flat.length === 1 ? flat[0] : flat } }
}

/** 15000 → «15 000». */
export function som(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Qor parchasi — oq chiziqlardan (emoji shrifti kerak emas). */
function snowflake(size: number, opacity: number, style: Style): Node {
  const arms = [0, 60, 120].map((deg) =>
    h('div', {
      position: 'absolute',
      left: size / 2 - size * 0.035,
      top: 0,
      width: size * 0.07,
      height: size,
      borderRadius: size,
      background: C.white,
      transform: `rotate(${deg}deg)`,
    }),
  )
  return h('div', { position: 'absolute', width: size, height: size, opacity, ...style }, ...arms)
}

function logo(): Node {
  return h(
    'div',
    {
      alignItems: 'center',
      justifyContent: 'center',
      width: 220,
      height: 84,
      borderRadius: 24,
      background: `linear-gradient(180deg, #fff3a6 0%, ${C.yellow} 40%, ${C.gold} 100%)`,
      border: '4px solid #c98f00',
      boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
    },
    h('div', { fontFamily: 'Archivo Black', fontSize: 58, letterSpacing: 2, color: C.blue, marginTop: 4 }, 'MUSA'),
  )
}

function productCard(p: CardProduct): Node {
  const discount = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0
  return h(
    'div',
    {
      flexDirection: 'column',
      width: 480,
      height: 416,
      padding: 20,
      borderRadius: 36,
      background: C.white,
      boxShadow: '0 18px 40px rgba(0,30,10,0.28)',
      position: 'relative',
    },
    h(
      'div',
      { width: 440, height: 214, borderRadius: 24, background: C.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
      p.image
        ? { type: 'img', props: { src: p.image, width: 400, height: 214, style: { objectFit: 'contain', width: 400, height: 214 } } }
        : h('div', { width: 120, height: 120, borderRadius: 120, background: C.tile }),
    ),
    discount > 0
      ? h(
          'div',
          { position: 'absolute', top: 36, left: 36, padding: '8px 16px', borderRadius: 999, background: C.red, color: C.white, fontSize: 26, fontWeight: 800 },
          `−${discount}%`,
        )
      : null,
    h(
      'div',
      {
        marginTop: 14,
        height: 74,
        fontSize: 30,
        fontWeight: 700,
        lineHeight: 1.22,
        color: C.ink,
        overflow: 'hidden',
        // ikki qatorga sig‘masa — «…»
        display: 'block',
        lineClamp: 2,
      },
      p.name,
    ),
    h(
      'div',
      { marginTop: 'auto', alignItems: 'flex-end', gap: 10 },
      h('div', { fontSize: 50, fontWeight: 800, color: C.green, lineHeight: 1 }, som(p.price)),
      h('div', { fontSize: 26, fontWeight: 700, color: C.green, marginBottom: 4 }, 'so‘m'),
      discount > 0
        ? h('div', { fontSize: 24, fontWeight: 600, color: C.muted, textDecoration: 'line-through', marginBottom: 5, marginLeft: 6 }, som(p.oldPrice!))
        : null,
    ),
  )
}

/** Shablon daraxti — sinovda ham shu ishlatiladi. */
export function cardTree(input: CardInput): Node {
  const items = input.products.slice(0, 4)
  return h(
    'div',
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      flexDirection: 'column',
      position: 'relative',
      fontFamily: 'Montserrat',
      padding: '44px 48px 40px',
      background: `linear-gradient(160deg, ${C.greenBright} 0%, ${C.green} 45%, ${C.greenDeep} 100%)`,
      overflow: 'hidden',
    },
    // Fon: qor parchalari va yorug‘ dog‘
    h('div', { position: 'absolute', top: -260, right: -200, width: 720, height: 720, borderRadius: 720, background: 'rgba(255,255,255,0.10)' }),
    snowflake(150, 0.12, { top: 210, right: 40 }),
    snowflake(90, 0.14, { top: 40, left: 520 }),
    snowflake(120, 0.08, { bottom: 140, left: -30 }),
    // Yuqori qator
    h(
      'div',
      { justifyContent: 'space-between', alignItems: 'center' },
      logo(),
      h(
        'div',
        { padding: '14px 26px', borderRadius: 999, background: 'rgba(255,255,255,0.16)', border: '2px solid rgba(255,255,255,0.35)', color: C.white, fontSize: 30, fontWeight: 700 },
        input.dateLabel,
      ),
    ),
    // Sarlavha
    h(
      'div',
      { flexDirection: 'column', marginTop: 30 },
      h('div', { fontSize: 62, fontWeight: 800, color: C.white, lineHeight: 1.08, letterSpacing: -1 }, input.title.toUpperCase()),
      h('div', { fontSize: 62, fontWeight: 800, color: C.yellow, lineHeight: 1.08, letterSpacing: -1, marginTop: 6 }, input.accent.toUpperCase()),
    ),
    // 2×2 kartochkalar
    h(
      'div',
      { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 24, marginTop: 32 },
      ...items.map(productCard),
    ),
    // Pastki qator
    h(
      'div',
      {
        marginTop: 'auto',
        height: 86,
        padding: '0 34px',
        borderRadius: 28,
        background: C.white,
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 14px 30px rgba(0,30,10,0.25)',
      },
      h('div', { fontSize: 36, fontWeight: 800, color: C.ink }, input.footer),
      h('div', { fontSize: 28, fontWeight: 800, color: C.green }, input.footerNote),
    ),
  )
}

let fontCache: { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: 'normal' }[] | null = null

/** PNG rasm. */
export async function renderCard(input: CardInput): Promise<Buffer> {
  const [{ default: satori }, { Resvg }] = await Promise.all([import('satori'), import('@resvg/resvg-js')])
  fontCache ??= FONTS.map((f) => ({ name: f.name, weight: f.weight, style: 'normal' as const, data: Buffer.from(f.data, 'base64') }))
  const svg = await satori(cardTree(input) as never, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: fontCache })
  return new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng()
}

/** Rasm manzilini data: URI ga aylantiradi (satori tashqi rasmni o‘zi yuklamaydi). */
export async function imageData(url: string | null | undefined, timeoutMs = 8000): Promise<string | null> {
  if (!url || !/^https:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = /^image\/(png|jpeg|webp|gif)$/.test(type) ? type : sniff(buf)
    return mime ? `data:${mime};base64,${buf.toString('base64')}` : null
  } catch {
    return null
  }
}

function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString('hex') === '89504e47') return 'image/png'
  if (buf.subarray(0, 3).toString('hex') === 'ffd8ff') return 'image/jpeg'
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return null
}
