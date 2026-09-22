import { adminDb } from '../firebase-admin.js'
import { linkoPost, linkoToken, readLinkoSettings, type LinkoSettings } from '../linko.js'

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
  product?: { id?: number | string; name?: string; price?: number; originalPrice?: number }
  quantity?: number
}

type OrderDoc = {
  orderNumber?: string
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
  linko?: { orderId?: number; marketId?: number }
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
  if (!settings.deliveryManId) return 'Yetkazuvchi tanlanmagan (Sozlamalar → Linko)'
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

/** Mijozni Linko'da «market» sifatida yaratadi yoki yangilaydi. */
async function syncMarket(
  order: OrderDoc,
  settings: LinkoSettings,
): Promise<{ id: number | null; serviceId: string }> {
  const customer = order.customer ?? {}
  const serviceId = `musa-${order.userId ?? 'mehmon'}`

  const payload = [{
    service_id: serviceId,
    name: text(customer.name) || `Telegram mijoz ${order.userId ?? ''}`.trim(),
    is_confirmed: true,
    phone: text(customer.phone),
    address: text(customer.address),
    ...(customer.location
      ? { location: { lat: customer.location.lat, lon: customer.location.lng } }
      : {}),
    ...(settings.agentId ? { responsible_agent: { linko_id: settings.agentId } } : {}),
    ...(settings.priceListId ? { price_list: { linko_id: settings.priceListId } } : {}),
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
 * Buyurtmani Linko'ga yuboradi (yangi bo'lsa yaratadi, bor bo'lsa
 * holatini yangilaydi) va natijani buyurtma hujjatiga yozadi.
 */
export async function pushOrder(orderId: string, order: OrderDoc): Promise<Result> {
  const settings = await readLinkoSettings()
  if (!settings.sendOrders) return { ok: false, skipped: 'sendOrders' }

  const db = await adminDb()
  const save = (data: Record<string, unknown>) =>
    db.collection('orders').doc(orderId).set({ linko: data }, { merge: true })

  const problem = missingSetting(settings)
  if (problem) {
    await save({ error: problem, at: new Date().toISOString() })
    return { ok: false, error: problem }
  }

  try {
    // ── Mahsulotlar ──
    const lines: Record<string, unknown>[] = []
    const skipped: string[] = []

    for (const item of order.products ?? []) {
      const productId = String(item.product?.id ?? '')
      const amount = num(item.quantity, 1)
      if (!productId || amount <= 0) continue

      const linkoId = await linkoProductId(productId)
      if (!linkoId) {
        skipped.push(text(item.product?.name) || productId)
        continue
      }

      const price = Math.round(num(item.product?.price))
      lines.push({
        product: { linko_id: linkoId },
        price,
        /*
         * `origin_price` hujjatda ixtiyoriy deb yozilgan, lekin API uni
         * TALAB qiladi (sinovda: «origin_price: This field is required»).
         * Aksiya bo'lmasa — sotuv narxining o'zi.
         */
        origin_price: Math.round(num(item.product?.originalPrice, price)),
        amount,
      })
    }

    if (!lines.length) {
      const error = 'Buyurtmadagi mahsulotlar Linko bilan bog‘lanmagan'
      await save({ error, skipped, at: new Date().toISOString() })
      return { ok: false, error }
    }

    // ── Mijoz ──
    const market = await syncMarket(order, settings)

    // ── Buyurtma ──
    const cash = text(order.paymentMethod) !== 'Karta'
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
      delivery_man: { linko_id: settings.deliveryManId },
      ...(settings.priceListId ? { price_list: { linko_id: settings.priceListId } } : {}),
      ...(settings.currencyId ? { linko_currency_id: settings.currencyId } : {}),
      service_order_number: text(order.orderNumber) || orderId,
      products: lines,
    }]

    const body = await linkoPost<{ results?: { id?: number }[]; errors?: unknown[] }>(
      'sync_order/', payload, settings,
    )
    if (body.errors?.length) {
      const error = `Linko qabul qilmadi: ${JSON.stringify(body.errors).slice(0, 300)}`
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
export async function linkoPushOrders(_staff: unknown, body: Record<string, unknown>): Promise<Result> {
  const days = Math.min(90, Math.max(1, Math.round(num(body.days, 7))))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const db = await adminDb()
  const snap = await db.collection('orders').where('createdAt', '>=', since).get()

  let sent = 0
  let failed = 0
  let skipped = 0

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
    else failed++
  }

  return { ok: true, sent, failed, skipped, checked: snap.size, days }
}
