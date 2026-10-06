import { adminDb } from '../firebase-admin.js'
import { linkoGet, linkoPost, linkoToken, readLinkoSettings, tmOf, type LinkoSettings } from '../linko.js'
import { isCashPayment } from '../pay-method.js'
import { orderLabel } from '../order-number.js'
import { AWAITING_PAYMENT, statusFromRitm } from './orders.js'

/**
 * Buyurtmalarni Linko'ga yuborish.
 *
 * Yo'nalish katalogникiga TESKARI: katalog Linko'dan olinadi, buyurtma
 * esa Linko'ga yuboriladi. Ikkalasi bitta faylda bo'lsa chalkashardi,
 * shuning uchun alohida modul.
 *
 * Nima yuboriladi:
 *   1. MIJOZ — Linko'da «market» (savdo nuqtasi) bo'lib yoziladi.
 *      Telegram id si `service_id` bo'ladi: bir mijoz ikki marta
 *      yaratilmaydi, ma'lumoti esa har buyurtmada yangilanadi.
 *   2. BUYURTMA — mahsulotlar, narx, miqdor, to'lov turi va holati.
 *
 * Xato bo'lsa buyurtma YO'QOLMAYDI: sabab buyurtma hujjatiga yoziladi
 * (`linko.error`) va admin panelda qayta yuborish mumkin.
 */

type Result = Record<string, unknown>

type OrderProduct = {
  product?: { id?: number | string; name?: string; price?: number; originalPrice?: number; pack?: number; [key: string]: unknown }
  quantity?: number
  [key: string]: unknown
}

/** Buyurtmadagi Linko belgisi (server yozadi). */
type LinkoMark = {
  orderId?: number
  marketId?: number
  status?: string
  error?: string | null
  skipped?: string[]
  /** Ritm'dan oxirgi olingan holatning `tm` i. */
  tm?: number | null
  deliveryDate?: string | null
  deliveryManId?: number | null
  agentId?: number | null
  /** Ritm'dagi izoh (operator yozgan). */
  note?: string
  editedAt?: string
  edits?: { at: string; text: string }[]
}

type OrderDoc = {
  orderNumber?: string
  /** Toshkent sanasi — chek raqami har kuni #0001 dan boshlanadi. */
  orderDay?: string
  status?: string
  userId?: number
  total?: number
  paymentMethod?: string
  createdAt?: string
  products?: OrderProduct[]
  customer?: {
    name?: string
    phone?: string
    address?: string
    comment?: string
    location?: { lat: number; lng: number } | null
  }
  linko?: LinkoMark
  subtotal?: number
  discount?: number
  discountPercent?: number
  deliveryFee?: number
}

/**
 * MUSA holati → Linko holati.
 *
 * Linko to'rtta qiymatni qabul qiladi: `not_delivered`, `given`,
 * `delivered`, `cancelled`. Bizdagi «Yangi» va «Qabul qilindi» hali
 * yo'lga chiqmagan, shuning uchun ikkalasi ham `not_delivered`.
 */
const STATUS: Record<string, string> = {
  'Yangi': 'not_delivered',
  'Qabul qilindi': 'not_delivered',
  'Yetkazilmoqda': 'given',
  'Yetkazildi': 'delivered',
  'Bekor qilingan': 'cancelled',
  'Rad etildi': 'cancelled',
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** `2026-09-22` — Linko sanani shu ko'rinishda kutadi. */
function dateOnly(value?: string): string {
  const time = Date.parse(String(value || ''))
  return new Date(Number.isNaN(time) ? Date.now() : time).toISOString().slice(0, 10)
}

/** Sozlama to'liq bo'lmasa buyurtma yuborilmaydi — sababini aytamiz. */
function missingSetting(settings: LinkoSettings): string | null {
  if (!settings.sendOrders) return null
  if (!settings.baseUrl) return 'Linko manzili kiritilmagan'
  if (!linkoToken()) return 'LINKO_TOKEN sozlanmagan'
  if (!settings.agentId) return 'Agent tanlanmagan (Sozlamalar → Linko)'
  // Yetkazuvchi ixtiyoriy — buyurtma agentga tushadi (Abubakr talabi, 2026-09-25)
  if (!settings.orderStockId) return 'Sklad tanlanmagan (Sozlamalar → Linko)'
  return null
}

/**
 * Do'kon mahsuloti → Linko pozitsiyasi.
 *
 * Bitta mahsulotga bir nechta pozitsiya bog'langan bo'lishi mumkin
 * (ta'mlar). Buyurtmada bittasini ko'rsatish kerak — narx manbasi
 * bo'lgan «asosiy» pozitsiya olinadi, u bo'lmasa birinchisi.
 */
async function linkoProductId(productId: string): Promise<number | null> {
  const db = await adminDb()
  const snap = await db
    .collection('linko_products')
    .where('productIds', 'array-contains', productId)
    .get()
  if (snap.empty) return null

  const rows = snap.docs.map((doc) => doc.data() as { linkoId?: number; primary?: boolean })
  const primary = rows.find((row) => row.primary)
  return num((primary ?? rows[0]).linkoId) || null
}

/**
 * Mijozni Linko'da «market» sifatida YARATADI (faqat birinchi marta —
 * `marketFor`). Admin panelda yoki Ritm'da tuzatilgan ma'lumot bo'lsa
 * (`profile.contact*`) — o'sha, aks holda buyurtmadagisi.
 */
async function syncMarket(
  order: OrderDoc,
  settings: LinkoSettings,
  profile: Record<string, unknown> = {},
): Promise<{ id: number | null; serviceId: string }> {
  const customer = order.customer ?? {}
  const serviceId = `musa-${order.userId ?? 'mehmon'}`

  const payload = [{
    service_id: serviceId,
    name: text(profile.contactName) || text(customer.name) || `Telegram mijoz ${order.userId ?? ''}`.trim(),
    is_confirmed: true,
    phone: text(profile.contactPhone) || text(customer.phone),
    address: text(profile.contactAddress) || text(customer.address),
    ...(customer.location
      ? { location: { lat: customer.location.lat, lon: customer.location.lng } }
      : {}),
    ...(settings.agentId ? { responsible_agent: { linko_id: settings.agentId } } : {}),
    ...(settings.priceListId ? { price_list: { linko_id: settings.priceListId } } : {}),
    // Mijoz turi («Telegram bot B2C») — mavjud mijozda ham keyingi buyurtmada yangilanadi
    ...(settings.marketTypeId ? { market_type: { linko_id: settings.marketTypeId } } : {}),
  }]

  const body = await linkoPost<{ results?: { id?: number }[]; errors?: unknown[] }>(
    'sync_market/', payload, settings,
  )
  if (body.errors?.length) {
    throw new Error(`Mijoz yozilmadi: ${JSON.stringify(body.errors).slice(0, 200)}`)
  }
  return { id: num(body.results?.[0]?.id) || null, serviceId }
}

/**
 * Buyurtmaning Linko mijozi. MUHIM: mijoz Linko'da allaqachon bo'lsa uning
 * ism, telefon, manzili QAYTA YOZILMAYDI — ilgari har buyurtma (va har holat
 * o'zgarishi) Ritm adminlari tuzatgan ma'lumotni eskisiga qaytarardi.
 * O'zgartirish faqat admin panel orqali (customers.ts) yoki Ritm'ning o'zida.
 */
async function marketFor(order: OrderDoc, settings: LinkoSettings): Promise<{ id: number | null; serviceId: string }> {
  const uid = order.userId ? String(order.userId) : ''
  const serviceId = `musa-${uid || 'mehmon'}`
  const known = num(order.linko?.marketId)
  if (known) return { id: known, serviceId }
  if (!uid) return syncMarket(order, settings)

  const db = await adminDb()
  const userRef = db.collection('users').doc(uid)
  const user = (await userRef.get()).data() ?? {}
  if (num(user.linkoMarketId)) return { id: num(user.linkoMarketId), serviceId }

  // Ilgari yuborilgan buyurtmalaridan (bog'lanish saqlanmagan eski mijozlar)
  const prev = await db.collection('orders').where('userId', '==', Number(uid)).get()
  const old = prev.docs.map((d) => num((d.data() as OrderDoc).linko?.marketId)).find((n) => n > 0)
  if (old) {
    await userRef.set({ linkoMarketId: old }, { merge: true })
    return { id: old, serviceId }
  }

  // Birinchi marta — yaratiladi
  const created = await syncMarket(order, settings, user)
  if (created.id) await userRef.set({ linkoMarketId: created.id }, { merge: true })
  return created
}

type MarketRow = {
  id?: number
  name?: string
  service_id?: string | null
  market_type?: { id?: number } | null
  market_phones?: { phone?: string }[]
  address?: string | null
  location?: { lat?: number; lon?: number } | null
  responsible_agent?: { id?: number } | null
  tm?: string | number
}

/**
 * Admin panelda tuzatilgan mijozni Ritm'ga yuboradi. Ritm'dagi agent va
 * mijoz turi (oxirgi sinxronda olingan) saqlanadi — ustidan yozilmaydi.
 */
export async function pushCustomerToLinko(
  uid: string,
  contact: { name: string; phone: string; address: string; location?: { lat?: number; lng?: number } | null },
  settings: LinkoSettings,
  profile: Record<string, unknown> = {},
): Promise<void> {
  const agent = num(profile.linkoAgentId) || settings.agentId
  const type = num(profile.linkoMarketTypeId) || settings.marketTypeId
  const loc = contact.location
  const body = await linkoPost<{ results?: unknown[]; errors?: unknown[] }>('sync_market/', [{
    service_id: `musa-${uid}`,
    name: contact.name,
    is_confirmed: true,
    ...(contact.phone ? { phone: contact.phone } : {}),
    ...(contact.address ? { address: contact.address } : {}),
    ...(loc?.lat != null && loc?.lng != null ? { location: { lat: loc.lat, lon: loc.lng } } : {}),
    ...(agent ? { responsible_agent: { linko_id: agent } } : {}),
    ...(settings.priceListId ? { price_list: { linko_id: settings.priceListId } } : {}),
    ...(type ? { market_type: { linko_id: type } } : {}),
  }], settings)
  if (body.errors?.length) throw new Error(`Ritm qabul qilmadi: ${JSON.stringify(body.errors).slice(0, 200)}`)
}

/** Bir sinxronda mijozlarni varaqlashga ajratilgan vaqt (mahsulot sinxroni ham ulgurishi kerak). */
const MARKETS_BUDGET_MS = 15_000
const MARKETS_PAGE = 1000

/**
 * Ritm'da o'zgargan mijozlarni bizga tortadi (Linko sinxroni, har 30 daqiqa).
 * Faqat bizning mijozlar (`service_id: musa-<telegram id>`); qiymat
 * o'zgarmagan bo'lsa yozilmaydi.
 *
 * Ritm tunda barcha mijozlarning `tm` ini birdaniga yangilaydi (~12 ming
 * yozuv, 2026-10 da tekshirildi). Javob `tm` bo'yicha o'sib boradi, shuning
 * uchun vaqt tugasa — ko'rilgan eng katta `tm` kursor bo'ladi va keyingi
 * sinxron o'sha joydan davom etadi.
 */
export async function pullMarkets(settings: LinkoSettings): Promise<{ checked: number; updated: number; lastMarketTm: number }> {
  // Birinchi marta — oxirgi 30 kun (butun bazani varaqlamaslik uchun)
  const since = settings.lastMarketTm || Math.floor(Date.now() / 1000) - 30 * 86400
  const deadline = Date.now() + MARKETS_BUDGET_MS
  const rows: MarketRow[] = []
  for (let offset = 0; Date.now() < deadline; offset += MARKETS_PAGE) {
    const body = await linkoGet<{ results?: MarketRow[] }>('markets/', { last_tm: since, limit: MARKETS_PAGE, offset }, settings)
    const page = Array.isArray(body?.results) ? body.results : []
    rows.push(...page)
    if (page.length < MARKETS_PAGE) break
  }
  const db = await adminDb()
  let updated = 0
  let maxTm = since
  for (const row of rows) {
    maxTm = Math.max(maxTm, tmOf(row.tm))
    const match = /^musa-(\d+)$/.exec(String(row.service_id ?? ''))
    if (!match || !row.id) continue
    const ref = db.collection('users').doc(match[1])
    const snap = await ref.get()
    if (!snap.exists) continue
    const user = snap.data() ?? {}
    const phone = text(row.market_phones?.find((p) => p?.phone)?.phone)
    const location = row.location?.lat != null && row.location?.lon != null
      ? { lat: Number(row.location.lat), lng: Number(row.location.lon) }
      : null
    const next = {
      contactName: text(row.name),
      contactPhone: phone,
      contactAddress: text(row.address),
      contactLocation: location,
      linkoMarketId: row.id,
      linkoAgentId: num(row.responsible_agent?.id) || null,
      linkoMarketTypeId: num(row.market_type?.id) || null,
    }
    const same = (Object.keys(next) as (keyof typeof next)[])
      .every((k) => JSON.stringify(user[k] ?? null) === JSON.stringify(next[k] ?? null))
    if (same) continue
    const contactChanged = user.contactName !== next.contactName || (user.contactPhone ?? '') !== next.contactPhone
      || (user.contactAddress ?? '') !== next.contactAddress
    await ref.set({
      ...next,
      ...(phone ? { phone } : {}),
      ...(contactChanged ? { contactSource: 'ritm', contactUpdatedAt: new Date().toISOString() } : {}),
    }, { merge: true })
    updated++
  }
  return { checked: rows.length, updated, lastMarketTm: maxTm }
}

/** Bizdagi mahsulotlar → Linko qatorlari (bog'lanmaganlari `skipped`). */
async function buildLines(items: OrderProduct[]): Promise<{ lines: Record<string, unknown>[]; skipped: string[] }> {
  const lines: Record<string, unknown>[] = []
  const skipped: string[] = []

  for (const item of items) {
    const productId = String(item.product?.id ?? '')
    const amount = num(item.quantity, 1)
    if (!productId || amount <= 0) continue

    const linkoId = await linkoProductId(productId)
    if (!linkoId) {
      skipped.push(text(item.product?.name) || productId)
      continue
    }

    // O'ram: Linko'da hammasi DONADA — miqdor ×pack, narx ÷pack
    const pack = Math.max(1, Math.floor(num(item.product?.pack, 1)))
    const price = Math.round(num(item.product?.price) / pack)
    lines.push({
      product: { linko_id: linkoId },
      price,
      /*
       * `origin_price` hujjatda ixtiyoriy deb yozilgan, lekin API uni
       * TALAB qiladi (sinovda: «origin_price: This field is required»).
       * Aksiya bo'lmasa — sotuv narxining o'zi.
       */
      origin_price: Math.round(num(item.product?.originalPrice, num(item.product?.price)) / pack),
      amount: amount * pack,
    })
  }
  return { lines, skipped }
}

type LinkoLine = {
  product?: { id?: number } | null
  price?: number | string
  origin_price?: number | string
  amount?: number | string
  return_amount?: number | string
  discount_percent?: number | string
}

/** Ritm'dagi buyurtma — `orders/` ro'yxatidagi qator. */
type LinkoOrderRow = {
  id?: number
  status?: string
  tm?: string | number
  payment_type?: string
  custom_payment_type?: string | null
  market?: { id?: number; service_id?: string | null } | null
  stock?: { id?: number } | null
  agent?: { id?: number } | null
  delivery_man?: { id?: number } | null
  price_list?: { id?: number } | null
  currency?: { id?: number } | null
  comment?: string | null
  date_delivery?: string | null
  service_order_number?: string | null
  products?: LinkoLine[]
}

const refId = (ref?: { id?: number } | null) => num(ref?.id)

/** Holatlar tartibi: Ritm oldinga ketgan bo'lsa, bizdagi eski holat uni orqaga qaytarmaydi. */
const RANK: Record<string, number> = { not_delivered: 0, given: 1, delivered: 2 }

async function fetchLinkoOrder(id: number, settings: LinkoSettings): Promise<LinkoOrderRow | null> {
  const body = await linkoGet<{ results?: LinkoOrderRow[] }>('orders/', { ids: id, limit: 1 }, settings)
  return (body?.results ?? []).find((row) => num(row.id) === id) ?? null
}

/** Ritm'dagi qator — o'zgartirmasdan qaytarib yuborish uchun. */
function echoLine(line: LinkoLine): Record<string, unknown> {
  return {
    product: { linko_id: refId(line.product) },
    price: num(line.price),
    origin_price: num(line.origin_price, num(line.price)),
    amount: num(line.amount),
    ...(num(line.discount_percent) ? { discount_percent: num(line.discount_percent) } : {}),
  }
}

/**
 * Ritm'da bor buyurtma: faqat HOLAT yangilanadi.
 *
 * Ilgari har holat o'zgarishida butun buyurtma (mahsulot, miqdor, narx,
 * agent, yetkazuvchi, sana) qayta yuborilardi va Ritm adminlari
 * tuzatgani eskisiga qaytardi. Endi Ritm'dagi joriy buyurtma o'qiladi va
 * xuddi o'zi qaytariladi — faqat `status` bizniki. Ilgari bog'lanmagan,
 * endi bog'langan mahsulot bo'lsa — qo'shiladi.
 */
async function updateInLinko(
  orderId: string,
  order: OrderDoc,
  settings: LinkoSettings,
  save: (data: Record<string, unknown>) => Promise<unknown>,
): Promise<Result> {
  const linkoOrderId = num(order.linko?.orderId)
  const target = STATUS[text(order.status)] ?? 'not_delivered'
  const pending = order.linko?.skipped ?? []
  const now = new Date().toISOString()

  // Holat bir xil va yetishmagan mahsulot yo'q — Ritm'ga umuman tegilmaydi
  if (order.linko?.status === target && !pending.length && !order.linko?.error) {
    return { ok: true, linkoOrderId, unchanged: true }
  }

  const row = await fetchLinkoOrder(linkoOrderId, settings)
  if (!row) {
    const error = `Ritm’da №${linkoOrderId} buyurtma topilmadi (o‘chirilgan bo‘lishi mumkin)`
    await save({ error, at: now })
    return { ok: false, error }
  }

  const products = (row.products ?? []).filter((line) => refId(line.product)).map(echoLine)
  const before = products.length
  let skipped: string[] = []
  if (pending.length) {
    const missing = (order.products ?? []).filter(
      (item) => pending.includes(text(item.product?.name)) || pending.includes(String(item.product?.id ?? '')),
    )
    const extra = await buildLines(missing)
    const have = new Set(products.map((line) => num((line.product as { linko_id?: number }).linko_id)))
    for (const line of extra.lines) {
      if (!have.has(num((line.product as { linko_id?: number }).linko_id))) products.push(line)
    }
    skipped = extra.skipped
  }
  const added = products.length > before

  // Ritm oldinga ketgan (masalan, u yerda «yo'lda») — bizdagi eski holat uni qaytarmaydi
  const behind = target in RANK && (row.status ?? '') in RANK && RANK[target] < RANK[row.status ?? '']
  if ((row.status === target || behind) && !added) {
    await save({ orderId: linkoOrderId, status: row.status ?? null, syncedAt: now, error: null, skipped })
    return { ok: true, linkoOrderId, unchanged: true }
  }

  const status = behind ? row.status : target
  const payload = [{
    linko_id: linkoOrderId,
    service_id: `musa-${orderId}`,
    payment_type: row.payment_type || (isCashPayment(text(order.paymentMethod)) ? 'cash' : 'bank'),
    ...(row.custom_payment_type ? { custom_payment_type: row.custom_payment_type } : {}),
    status,
    comment: row.comment ?? '',
    date_delivery: row.date_delivery || dateOnly(order.createdAt),
    market: { linko_id: refId(row.market) || num(order.linko?.marketId) },
    stock: { linko_id: refId(row.stock) || settings.orderStockId },
    agent: { linko_id: refId(row.agent) || settings.agentId },
    ...(refId(row.delivery_man) ? { delivery_man: { linko_id: refId(row.delivery_man) } } : {}),
    ...(refId(row.price_list) ? { price_list: { linko_id: refId(row.price_list) } } : {}),
    ...(refId(row.currency) || settings.currencyId ? { linko_currency_id: refId(row.currency) || settings.currencyId } : {}),
    service_order_number: row.service_order_number || text(order.orderNumber) || orderId,
    products,
  }]

  const body = await linkoPost<{ results?: { id?: number }[]; errors?: unknown[] }>('sync_order/', payload, settings)
  if (body.errors?.length) {
    const error = `Linko qabul qilmadi: ${JSON.stringify(body.errors).slice(0, 300)}`
    await save({ error, at: now })
    return { ok: false, error }
  }
  const marketId = refId(row.market) || num(order.linko?.marketId) || null
  await save({ orderId: linkoOrderId, marketId, status, syncedAt: now, error: null, skipped })
  return { ok: true, linkoOrderId, marketId, skipped }
}

/* ─── Ritm → biz: buyurtmadagi o'zgarishlar ─────────────────── */

/** Ritm holati → bizniki. `not_delivered` olinmaydi: bizda u «Yangi» ham, «Qabul qilindi» ham. */
const FROM_RITM: Record<string, string> = {
  given: 'Yetkazilmoqda',
  delivered: 'Yetkazildi',
  cancelled: 'Bekor qilingan',
}

const ORDERS_BUDGET_MS = 12_000
const ORDERS_PAGE = 1000

const round2 = (n: number) => Math.round(n * 100) / 100
const som = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Ritm'da qo'shilgan mahsulot — bizdagi mahsulot kartochkasidan (bo'lsa). */
async function itemFromLinko(linkoId: number, line: { amount: number; price: number }): Promise<OrderProduct> {
  const db = await adminDb()
  const mirror = (await db.collection('linko_products').doc(String(linkoId)).get()).data() ?? {}
  const ids = Array.isArray(mirror.productIds) ? mirror.productIds : mirror.productId ? [mirror.productId] : []
  const productId = ids.map(String).find(Boolean)
  const data = productId ? (await db.collection('products').doc(productId).get()).data() : undefined
  if (data) {
    const pack = Array.isArray(data.bundle) && data.bundle.length ? 1 : Math.max(1, Math.floor(num(data.pack, 1)))
    return {
      product: {
        id: num(data.id, num(productId)),
        name: pack > 1 ? `${text(data.name)} (${pack} dona)` : text(data.name),
        price: line.price * pack,
        ...(pack > 1 ? { pack } : {}),
        images: Array.isArray(data.images) ? data.images : [],
        thumbs: Array.isArray(data.thumbs) ? data.thumbs : [],
        category: String(data.category || ''),
      },
      quantity: round2(line.amount / pack),
      fromRitm: true,
    }
  }
  return {
    product: { id: 0, name: text(mirror.name) || `Ritm mahsuloti №${linkoId}`, price: line.price, images: [] },
    quantity: line.amount,
    fromRitm: true,
  }
}

/**
 * Ritm'dagi buyurtmani bizdagisiga qo'llaydi: mahsulot/miqdor/narx (jami
 * qayta hisoblanadi — yetkazish va promokod saqlanadi), holat, yetkazish
 * sanasi va izoh. Hech narsa o'zgarmagan bo'lsa — yozilmaydi.
 */
async function applyRitmOrder(orderId: string, order: OrderDoc, row: LinkoOrderRow): Promise<boolean> {
  const rowTm = tmOf(row.tm)
  if (rowTm && num(order.linko?.tm) >= rowTm) return false

  // ── Mahsulotlar: Ritm qatorlari linko ID bo'yicha navbatda ──
  const queue = new Map<number, { amount: number; price: number }[]>()
  for (const line of row.products ?? []) {
    const id = refId(line.product)
    if (!id) continue
    const list = queue.get(id) ?? []
    list.push({ amount: num(line.amount) - num(line.return_amount), price: num(line.price) })
    queue.set(id, list)
  }

  const skipped = order.linko?.skipped ?? []
  const cache = new Map<string, number | null>()
  const edits: string[] = []
  const next: OrderProduct[] = []
  for (const item of order.products ?? []) {
    const productId = String(item.product?.id ?? '')
    const name = text(item.product?.name) || productId
    if (productId && !cache.has(productId)) cache.set(productId, await linkoProductId(productId))
    const linkoId = productId ? cache.get(productId) : null
    // Ritm'ga hech qachon ketmagan (bog'lanmagan) — tegilmaydi
    if (!linkoId || skipped.includes(name) || skipped.includes(productId)) {
      next.push(item)
      continue
    }
    const line = queue.get(linkoId)?.shift()
    if (!line || line.amount <= 0) {
      edits.push(`− ${name}`)
      continue
    }
    const pack = Math.max(1, Math.floor(num(item.product?.pack, 1)))
    const quantity = round2(line.amount / pack)
    const ourPrice = num(item.product?.price)
    // Linko'ga dona narxi yaxlitlab ketgan — o'shaning o'zi qaytsa, bizdagi narx qoladi
    const price = line.price === Math.round(ourPrice / pack) ? ourPrice : line.price * pack
    if (quantity !== num(item.quantity)) edits.push(`${name}: ${num(item.quantity)} → ${quantity}`)
    if (price !== ourPrice) edits.push(`${name}: narx ${som(ourPrice)} → ${som(price)}`)
    next.push(quantity === item.quantity && price === ourPrice ? item : { ...item, quantity, product: { ...item.product, price } })
  }
  for (const [linkoId, lines] of queue) {
    for (const line of lines) {
      if (line.amount <= 0) continue
      const item = await itemFromLinko(linkoId, line)
      next.push(item)
      edits.push(`+ ${text(item.product?.name)} ×${item.quantity}`)
    }
  }

  const update: Record<string, unknown> = {}
  if (edits.length) {
    const subtotal = next.reduce((sum, item) => sum + num(item.product?.price) * num(item.quantity), 0)
    const discount = num(order.discountPercent) > 0
      ? Math.round((subtotal * num(order.discountPercent)) / 100)
      : Math.min(num(order.discount), subtotal)
    Object.assign(update, {
      products: next,
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0) + num(order.deliveryFee),
    })
  }

  // ── Holat ──
  const current = text(order.status)
  const adopt = FROM_RITM[row.status ?? '']
  const newStatus = adopt && STATUS[current] !== row.status && current !== AWAITING_PAYMENT ? adopt : null

  // ── Qo'shimcha: yetkazish sanasi, yetkazuvchi, agent, izoh ──
  const now = new Date().toISOString()
  const info = {
    deliveryDate: row.date_delivery ?? null,
    deliveryManId: refId(row.delivery_man) || null,
    agentId: refId(row.agent) || null,
    note: text(row.comment),
  }
  const old = order.linko ?? {}
  const blank = (v: unknown) => (v === undefined || v === '' ? null : v)
  const infoChanged = (Object.keys(info) as (keyof typeof info)[]).some((key) => blank(old[key]) !== blank(info[key]))

  if (!edits.length && !newStatus && !infoChanged && old.status === row.status) return false

  const linko: Record<string, unknown> = { ...info, tm: rowTm || null, status: row.status ?? null, pulledAt: now }
  if (edits.length) {
    linko.editedAt = now
    linko.edits = [...edits.map((t) => ({ at: now, text: t })), ...(old.edits ?? [])].slice(0, 20)
  }
  const db = await adminDb()
  await db.collection('orders').doc(orderId).set({ ...update, linko }, { merge: true })

  if (newStatus) {
    await statusFromRitm(orderId, { ...order, ...update, linko: { ...old, ...linko } }, newStatus)
  }
  return true
}

/**
 * Ritm'da o'zgargan BIZNING buyurtmalarni tortadi (Linko sinxroni, har
 * 30 daqiqa). Ritm'da kuniga ~1 500 buyurtma o'zgaradi (2026-10), bizniki
 * mijozining `service_id: musa-…` dan ajratiladi — faqat ular uchun
 * Firestore o'qiladi.
 */
export async function pullOrders(settings: LinkoSettings): Promise<{ checked: number; updated: number; lastOrderTm: number }> {
  // Birinchi marta — oxirgi 3 kun
  const since = settings.lastOrderTm || Math.floor(Date.now() / 1000) - 3 * 86400
  const deadline = Date.now() + ORDERS_BUDGET_MS
  const rows: LinkoOrderRow[] = []
  for (let offset = 0; Date.now() < deadline; offset += ORDERS_PAGE) {
    const body = await linkoGet<{ results?: LinkoOrderRow[] }>('orders/', { last_tm: since, limit: ORDERS_PAGE, offset }, settings)
    const page = Array.isArray(body?.results) ? body.results : []
    rows.push(...page)
    if (page.length < ORDERS_PAGE) break
  }

  const db = await adminDb()
  let updated = 0
  let maxTm = since
  for (const row of rows) {
    maxTm = Math.max(maxTm, tmOf(row.tm))
    if (!/^musa-/.test(String(row.market?.service_id ?? '')) || !num(row.id)) continue
    const snap = await db.collection('orders').where('linko.orderId', '==', num(row.id)).limit(1).get()
    if (snap.empty) continue
    const doc = snap.docs[0]
    try {
      if (await applyRitmOrder(doc.id, doc.data() as OrderDoc, row)) updated++
    } catch (error) {
      console.error('[linko] Ritm buyurtmasi qo‘llanmadi:', doc.id, error instanceof Error ? error.message : error)
    }
  }
  return { checked: rows.length, updated, lastOrderTm: maxTm }
}

/**
 * Buyurtmani Linko'ga yuboradi (yangi bo'lsa yaratadi, bor bo'lsa
 * holatini yangilaydi) va natijani buyurtma hujjatiga yozadi.
 */
export async function pushOrder(orderId: string, order: OrderDoc): Promise<Result> {
  const settings = await readLinkoSettings()
  if (!settings.sendOrders) return { ok: false, skipped: 'sendOrders' }

  /*
   * Onlayn to'lov: to'lanmagan buyurtma hali buyurtma emas. To'lov
   * kutilayotganda yoki to'lanmay bekor bo'lganda Linko'ga yubormaymiz
   * (u yerda yaratilmagan bo'lsa — keyin ham kerak emas).
   */
  const unpaidOnline = (order as { paymentMethod?: string }).paymentMethod === 'Onlayn'
    && !(order as { paidAt?: string }).paidAt
  if (unpaidOnline && !order.linko?.orderId) return { ok: false, skipped: 'unpaid' }

  const db = await adminDb()
  const save = (data: Record<string, unknown>) =>
    db.collection('orders').doc(orderId).set({ linko: data }, { merge: true })

  const problem = missingSetting(settings)
  if (problem) {
    await save({ error: problem, at: new Date().toISOString() })
    return { ok: false, error: problem }
  }

  try {
    // Ritm'da allaqachon bor — faqat holat; Ritm'dagi tahrirlar saqlanadi
    if (order.linko?.orderId) return await updateInLinko(orderId, order, settings, save)

    // ── Mahsulotlar ──
    const { lines, skipped } = await buildLines(order.products ?? [])

    if (!lines.length) {
      const error = 'Buyurtmadagi mahsulotlar Linko bilan bog‘lanmagan'
      await save({ error, skipped, at: new Date().toISOString() })
      return { ok: false, error }
    }

    // ── Mijoz — mavjud bo'lsa ma'lumoti qayta yozilmaydi ──
    const market = await marketFor(order, settings)

    // ── Buyurtma ──
    const cash = isCashPayment(text(order.paymentMethod))
    const payload = [{
      service_id: `musa-${orderId}`,
      ...(order.linko?.orderId ? { linko_id: order.linko.orderId } : {}),
      payment_type: cash ? 'cash' : 'bank',
      // Karta orqali to'lov Linko'da alohida nom bilan ko'rinadi
      custom_payment_type: cash ? 'cash' : 'karta',
      status: STATUS[text(order.status)] ?? 'not_delivered',
      comment: text(order.customer?.comment),
      date_delivery: dateOnly(order.createdAt),
      market: market.id ? { linko_id: market.id } : { service_id: market.serviceId },
      stock: { linko_id: settings.orderStockId },
      agent: { linko_id: settings.agentId },
      ...(settings.deliveryManId ? { delivery_man: { linko_id: settings.deliveryManId } } : {}),
      ...(settings.priceListId ? { price_list: { linko_id: settings.priceListId } } : {}),
      ...(settings.currencyId ? { linko_currency_id: settings.currencyId } : {}),
      // Chek raqami har kuni #0001 dan boshlanadi — Linko'da sana bilan
      service_order_number: order.orderDay
        ? `${text(order.orderNumber)} · ${text(order.orderDay).split('-').reverse().join('.')}`
        : text(order.orderNumber) || orderId,
      products: lines,
    }]

    const body = await linkoPost<{ results?: { id?: number }[]; errors?: unknown[] }>(
      'sync_order/', payload, settings,
    )
    if (body.errors?.length) {
      const raw = JSON.stringify(body.errors)
      // Linko yetkazuvchini talab qilsa — admin nima qilishni bilsin
      const error = /delivery_man/i.test(raw) && !settings.deliveryManId
        ? 'Linko yetkazuvchini talab qilyapti — Linko sozlamasida yetkazuvchi majburiy bo‘lmasligi kerak'
        : `Linko qabul qilmadi: ${raw.slice(0, 300)}`
      await save({ error, at: new Date().toISOString() })
      return { ok: false, error }
    }

    const linkoOrderId = num(body.results?.[0]?.id) || order.linko?.orderId || null
    await save({
      orderId: linkoOrderId,
      marketId: market.id,
      status: STATUS[text(order.status)] ?? 'not_delivered',
      syncedAt: new Date().toISOString(),
      ...(skipped.length ? { skipped } : {}),
      error: null,
    })
    return { ok: true, linkoOrderId, marketId: market.id, skipped }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Noma’lum xato'
    await save({ error: message, at: new Date().toISOString() })
    console.error('[linko] buyurtma yuborilmadi:', message)
    return { ok: false, error: message }
  }
}

/**
 * Buyurtma yaratilganda yoki holati o'zgarganda chaqiriladi.
 *
 * Xato tashlamaydi — Linko ishlamayotgani do'kondagi buyurtmani
 * to'xtatib qo'ymasligi kerak.
 */
export async function pushOrderSafe(orderId: string, order: OrderDoc): Promise<void> {
  try {
    await pushOrder(orderId, order)
  } catch (error) {
    console.error('[linko] buyurtma yuborishda kutilmagan xato:', error)
  }
}

/**
 * Bitta buyurtmani Linko'ga yuboradi.
 *
 * Kuryer botdagi «Oldim»/«Yetkazdim» tugmasini bosganda holat
 * Firestore'ga TO'G'RIDAN-TO'G'RI yoziladi (ikki kuryer bir buyurtmani
 * olib qo'ymasligi uchun atomar tranzaksiya kerak). Shu sababli u yo'l
 * `order.status` amalidan o'tmaydi va Linko'ga xabar bormay qolardi —
 * bot shu amalni alohida chaqiradi.
 */
export async function linkoPushOrder(_staff: unknown, body: Record<string, unknown>): Promise<Result> {
  const orderId = text(body.orderId)
  if (!orderId) throw new Error('orderId kerak')

  const db = await adminDb()
  const snap = await db.collection('orders').doc(orderId).get()
  if (!snap.exists) throw new Error('Buyurtma topilmadi')

  return pushOrder(orderId, snap.data() as OrderDoc)
}

/**
 * Yuborilmay qolganlarini qayta yuboradi — admin paneldagi tugma.
 *
 * Linko o'chiq bo'lgan yoki sozlama to'liq bo'lmagan paytdagi
 * buyurtmalar shu tariqa tiklanadi.
 */
/**
 * Botdan kelgan ESKI mijozlarning turini bir martada yangilaydi (sozlamadagi
 * `marketTypeId`, masalan «Telegram bot B2C»).
 *
 * Faqat tur o'zgaradi. Linko ismni majburiy talab qiladi, shuning uchun
 * mijozning Linko'dagi HOZIRGI ismi o'qib olinadi va o'zgarmasdan qaytadi
 * (qo'lda o'zgartirilgan nom ustidan yozilmasin). Agent, narx ro'yxati,
 * manzil yuborilmaydi. Mijozlar — Linko'ga tushgan buyurtmalardagi
 * `userId` lar (`service_id: musa-<id>`); Linko'da ular buyurtmadagi ism
 * bo'yicha qidiriladi va `service_id` bilan aniq ajratiladi.
 * `userId` berilsa — faqat o'sha mijoz (sinov uchun).
 */
export async function linkoSyncMarketTypes(body: Record<string, unknown> = {}): Promise<Result> {
  const settings = await readLinkoSettings()
  if (!settings.marketTypeId) return { ok: false, error: 'Mijoz turi (marketTypeId) sozlanmagan' }

  const db = await adminDb()
  const snap = await db.collection('orders').where('linko.marketId', '>', 0).get()
  const only = text(String(body.userId ?? ''))

  // Mijoz → buyurtmalardagi ismlari (qidiruv uchun)
  const names = new Map<string, Set<string>>()
  for (const doc of snap.docs) {
    const data = doc.data() as OrderDoc
    const id = String(data.userId ?? '')
    if (!id || (only && id !== only)) continue
    const set = names.get(id) ?? new Set<string>()
    const name = text(data.customer?.name)
    if (name) set.add(name)
    names.set(id, set)
  }

  type MarketRow = {
    id?: number
    name?: string
    service_id?: string | null
    market_type?: { id?: number } | null
    market_phones?: { phone?: string }[]
    address?: string | null
    location?: { lat?: number; lon?: number } | null
    responsible_agent?: { id?: number } | null
  }
  let updated = 0
  let already = 0
  const notFound: string[] = []
  const errors: string[] = []

  for (const [id, candidates] of names) {
    const serviceId = `musa-${id}`
    let row: MarketRow | undefined
    for (const name of candidates) {
      const res = await linkoGet<{ results?: MarketRow[] }>('markets/', { search: name, limit: 50 }, settings)
      row = res.results?.find((m) => m.service_id === serviceId)
      if (row) break
    }
    if (!row?.name) {
      notFound.push(id)
      continue
    }
    if (row.market_type?.id === settings.marketTypeId) {
      already++
      continue
    }
    try {
      /*
       * Linko qisqa so'rovni («ism + tur») «Ошибка сервера» bilan rad etadi —
       * shuning uchun mijozning Linko'dagi HOZIRGI qiymatlari o'zgarmasdan
       * qaytariladi, faqat tur yangi.
       */
      const phone = row.market_phones?.find((p) => p?.phone)?.phone
      const res = await linkoPost<{ results?: unknown[]; errors?: unknown[] }>('sync_market/', [{
        service_id: serviceId,
        name: row.name,
        is_confirmed: true,
        ...(phone ? { phone } : {}),
        ...(row.address ? { address: row.address } : {}),
        ...(row.location?.lat != null && row.location?.lon != null
          ? { location: { lat: row.location.lat, lon: row.location.lon } }
          : {}),
        ...(row.responsible_agent?.id ? { responsible_agent: { linko_id: row.responsible_agent.id } } : {}),
        ...(settings.priceListId ? { price_list: { linko_id: settings.priceListId } } : {}),
        market_type: { linko_id: settings.marketTypeId },
      }], settings)
      if (res.errors?.length) errors.push(`${id}: ${JSON.stringify(res.errors).slice(0, 200)}`)
      else updated++
    } catch (error) {
      errors.push(`${id}: ${error instanceof Error ? error.message.slice(0, 200) : 'xato'}`)
    }
  }
  return { ok: errors.length === 0, users: names.size, updated, already, notFound, errors: errors.slice(0, 5) }
}

export async function linkoPushOrders(_staff: unknown, body: Record<string, unknown>): Promise<Result> {
  const settings = await readLinkoSettings()
  if (!settings.sendOrders) return { ok: true, skipped: 'sendOrders', sent: 0, failed: 0 }
  const days = Math.min(90, Math.max(1, Math.round(num(body.days, 7))))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const db = await adminDb()
  const snap = await db.collection('orders').where('createdAt', '>=', since).get()

  let sent = 0
  let failed = 0
  let skipped = 0
  const errors: string[] = []

  for (const doc of snap.docs) {
    const order = doc.data() as OrderDoc
    // Allaqachon yuborilgan va holati o'zgarmaganlarini qayta yubormaymiz
    const already = order.linko?.orderId
    const sameStatus = (order.linko as { status?: string } | undefined)?.status ===
      (STATUS[text(order.status)] ?? 'not_delivered')
    if (already && sameStatus) {
      skipped++
      continue
    }

    const result = await pushOrder(doc.id, order)
    if (result.ok) sent++
    else if (result.skipped) skipped++
    else {
      failed++
      errors.push(`${orderLabel(order, doc.id)}: ${String(result.error || '').slice(0, 120)}`)
    }
  }

  const summary = { at: new Date().toISOString(), sent, failed, skipped, checked: snap.size, errors: errors.slice(0, 5) }
  // Panel «Avtomatik yuborish» kartasida oxirgi natija ko'rinadi
  await db.collection('settings').doc('linko').set({ lastOrderPush: summary }, { merge: true })
  return { ok: true, ...summary, days }
}
