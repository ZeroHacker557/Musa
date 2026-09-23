import { adminDb } from '../firebase-admin.js'
import type { Staff } from '../admin-auth.js'
import { applyStatusEffects, type OrderDoc } from './orders.js'
import { canDeliver } from '../courier-staff.js'

/**
 * Kuryer amallari — mini app'dagi kuryer sahifasi uchun.
 *
 * Ikki yo'ldan chaqiriladi:
 *   • api/courier.ts — mini app (Telegram orqali kirgan kuryer)
 *   • api/admin/action.ts — botdagi eski «Oldim / Yetkazdim» tugmalari
 *
 * Holat o'zgargandan keyingi hamma ish (mijozga xabar, Linko, tarix,
 * boshqa kuryerlardagi xabarlar) `applyStatusEffects` da — admin panel
 * bilan bir xil yo'l. Kuryerni aniqlash — ../courier-staff.ts.
 */

type Body = Record<string, unknown>

/** Toshkent vaqti — UTC+5, yozgi vaqt yo'q. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function requireCourier(staff: Staff) {
  if (!canDeliver(staff)) throw new Error('Bu amal faqat kuryer uchun')
}

function orderIdOf(body: Body): string {
  const id = String(body.orderId || '').trim()
  if (!id) throw new Error('orderId kerak')
  return id
}

export type TakeOutcome = 'claimed' | 'already' | 'taken' | 'closed' | 'not_found'

/**
 * Buyurtmani kuryerga BAND qiladi — atomar.
 *
 * Bitta buyurtma bir necha kuryerga ketadi; ikkitasi bir vaqtda «Olaman»
 * bossa, tranzaksiya faqat bittasini o'tkazadi. Ikkinchisi `taken` oladi.
 *
 *   claimed   — endi shu kuryerniki, holat «Yetkazilmoqda»
 *   already   — shu kuryer allaqachon olgan (qayta bosdi)
 *   taken     — boshqa kuryer olib bo'lgan
 *   closed    — buyurtma bekor qilingan yoki hali tasdiqlanmagan
 *   not_found — buyurtma yo'q
 */
export async function courierTake(staff: Staff, body: Body) {
  requireCourier(staff)
  const orderId = orderIdOf(body)
  const db = await adminDb()
  const ref = db.collection('orders').doc(orderId)
  const now = new Date().toISOString()
  const by = { uid: staff.uid, name: staff.name, role: staff.role }

  const { outcome, order } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { outcome: 'not_found' as TakeOutcome, order: null }
    const data = snap.data() as OrderDoc

    if (data.courierId && data.courierId !== staff.uid) {
      return { outcome: 'taken' as TakeOutcome, order: data }
    }
    if (data.courierId === staff.uid && (data.status === 'Yetkazilmoqda' || data.status === 'Yetkazildi')) {
      return { outcome: 'already' as TakeOutcome, order: data }
    }
    // Faqat tasdiqlangan buyurtma olinadi — bekor qilingani yoki hali
    // admin ko'rmagani kuryerga tegmaydi
    if (data.status !== 'Qabul qilindi') return { outcome: 'closed' as TakeOutcome, order: data }

    tx.update(ref, {
      courierId: staff.uid,
      courierName: staff.name,
      status: 'Yetkazilmoqda',
      takenAt: now,
      statusUpdatedAt: now,
      statusUpdatedBy: by,
    })
    return { outcome: 'claimed' as TakeOutcome, order: data }
  })

  if (outcome === 'claimed' && order) {
    await applyStatusEffects(
      orderId,
      { ...order, courierId: staff.uid, courierName: staff.name },
      'Yetkazilmoqda',
      by,
      now,
    )
  }

  return { outcome, courierName: order?.courierName ?? null }
}

export type DeliverOutcome = 'done' | 'already' | 'not_yours' | 'closed' | 'not_found'

/** Kuryer «Yetkazdim» bosganda — ham atomar. */
export async function courierDeliver(staff: Staff, body: Body) {
  requireCourier(staff)
  const orderId = orderIdOf(body)
  const db = await adminDb()
  const ref = db.collection('orders').doc(orderId)
  const now = new Date().toISOString()
  const by = { uid: staff.uid, name: staff.name, role: staff.role }

  const { outcome, order } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return { outcome: 'not_found' as DeliverOutcome, order: null }
    const data = snap.data() as OrderDoc

    if (data.courierId !== staff.uid) return { outcome: 'not_yours' as DeliverOutcome, order: data }
    if (data.status === 'Yetkazildi') return { outcome: 'already' as DeliverOutcome, order: data }
    // Biriktirilgan, lekin «Olaman» bosilmagan buyurtmani ham yetkazish mumkin
    if (data.status !== 'Yetkazilmoqda' && data.status !== 'Qabul qilindi') {
      return { outcome: 'closed' as DeliverOutcome, order: data }
    }

    tx.update(ref, {
      status: 'Yetkazildi',
      deliveredAt: now,
      statusUpdatedAt: now,
      statusUpdatedBy: by,
    })
    return { outcome: 'done' as DeliverOutcome, order: data }
  })

  if (outcome === 'done' && order) {
    await applyStatusEffects(orderId, order, 'Yetkazildi', by, now)
  }

  return { outcome }
}

/* ─── Ro'yxat va statistika ──────────────────────────────────── */

type RawOrder = OrderDoc & {
  createdAt?: string
  takenAt?: string
  deliveredAt?: string
  statusUpdatedAt?: string
  assignedAt?: string
  orderDay?: string
  subtotal?: number
  discount?: number
  promoCode?: string | null
  deliveryFee?: number
  paymentStatus?: string | null
  products?: {
    product?: {
      name?: string
      price?: number
      images?: string[]
      thumbs?: string[]
      variantSources?: string[]
    }
    quantity?: number
    size?: string | null
    color?: string | null
  }[]
}

/**
 * Mahsulotning kichik rasmi — src/utils/product-image.ts → productThumb
 * bilan bir xil qoida: siqilgan nusxa faqat o'sha asl rasmdan yasalgan
 * bo'lsa olinadi, aks holda asl rasm.
 */
function thumbOf(product: { images?: string[]; thumbs?: string[]; variantSources?: string[] } = {}) {
  const original = product.images?.[0] || ''
  const fresh = original && product.variantSources?.[0] === original
  return (fresh && product.thumbs?.[0]) || original || null
}

/** Kuryerga kerakli qismi — ichki maydonlar (dispatch xabarlari va h.k.) chiqmaydi. */
function present(id: string, order: RawOrder, uid: string) {
  const customer = order.customer || {}
  const location = customer.location
  return {
    id,
    number: order.orderNumber || `#${id.slice(0, 6)}`,
    status: order.status || '',
    createdAt: order.createdAt || null,
    takenAt: order.takenAt || null,
    deliveredAt: deliveredAt(order),
    assignedToMe: order.courierId === uid,
    customer: {
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      comment: customer.comment || '',
      recipientName: customer.recipientName || '',
      recipientPhone: customer.recipientPhone || '',
      location:
        location && typeof location.lat === 'number' && typeof location.lng === 'number'
          ? { lat: location.lat, lng: location.lng }
          : null,
    },
    items: (order.products || []).map((line) => ({
      name: line.product?.name || '',
      quantity: Number(line.quantity) || 1,
      price: Number(line.product?.price) || 0,
      size: line.size || null,
      image: thumbOf((line.product ?? {}) as Parameters<typeof thumbOf>[0]),
    })),
    total: Number(order.total) || 0,
    paymentMethod: order.paymentMethod || 'Naqd',
    // Chek uchun — hisob-kitob tarkibi va kim yetkazgani
    orderDay: order.orderDay || null,
    subtotal: Number(order.subtotal) || 0,
    discount: Number(order.discount) || 0,
    promoCode: order.promoCode || null,
    deliveryFee: Number(order.deliveryFee) || 0,
    paymentStatus: order.paymentStatus || null,
    courierName: order.courierName || null,
  }
}

/** Yetkazilgan vaqt. Eski buyurtmalarda `deliveredAt` yo'q — holat vaqti olinadi. */
function deliveredAt(order: RawOrder): string | null {
  if (order.status !== 'Yetkazildi') return null
  return order.deliveredAt || order.statusUpdatedAt || order.createdAt || null
}

/** Toshkent bo'yicha bugungi kun boshidan `daysBack` kun oldingi vaqt (ms). */
function tashkentDayStart(daysBack = 0): number {
  const local = Date.now() + TASHKENT_OFFSET_MS
  const midnight = local - (local % DAY_MS)
  return midnight - TASHKENT_OFFSET_MS - daysBack * DAY_MS
}

type Bucket = { delivered: number; cash: number; card: number }

function bucket(orders: RawOrder[], since: number): Bucket {
  const result: Bucket = { delivered: 0, cash: 0, card: 0 }
  for (const order of orders) {
    const at = Date.parse(deliveredAt(order) || '')
    if (!Number.isFinite(at) || at < since) continue
    result.delivered++
    const total = Number(order.total) || 0
    if (order.paymentMethod === 'Karta') result.card += total
    else result.cash += total
  }
  return result
}

/**
 * Kuryer sahifasining hamma ma'lumoti — bitta so'rovda.
 *
 *   available — olish mumkin: tasdiqlangan, hech kimga tegmagan yoki
 *               aynan shu kuryerga biriktirilgan
 *   active    — shu kuryerda, yo'lda
 *   done      — bugun yetkazganlari
 *   stats     — bugun / 7 kun / 30 kun
 *   recent    — oxirgi 30 ta yetkazilgan
 *
 * Tartiblash (yaqinlik bo'yicha) ilovada: kuryerning joylashuvi faqat
 * telefonda ma'lum.
 */
export async function courierOverview(staff: Staff) {
  requireCourier(staff)
  const db = await adminDb()

  const [ready, mine] = await Promise.all([
    db.collection('orders').where('status', '==', 'Qabul qilindi').get(),
    db.collection('orders').where('courierId', '==', staff.uid).get(),
  ])

  const available = ready.docs
    .filter((doc) => {
      const owner = (doc.data() as RawOrder).courierId
      return !owner || owner === staff.uid
    })
    .map((doc) => present(doc.id, doc.data() as RawOrder, staff.uid))

  const mineOrders = mine.docs.map((doc) => ({ id: doc.id, data: doc.data() as RawOrder }))
  const delivered = mineOrders.filter((o) => o.data.status === 'Yetkazildi')
  const today = tashkentDayStart(0)

  const active = mineOrders
    .filter((o) => o.data.status === 'Yetkazilmoqda')
    .map((o) => present(o.id, o.data, staff.uid))

  const byDeliveredDesc = (a: { data: RawOrder }, b: { data: RawOrder }) =>
    String(deliveredAt(b.data)).localeCompare(String(deliveredAt(a.data)))

  const done = delivered
    .filter((o) => Date.parse(deliveredAt(o.data) || '') >= today)
    .sort(byDeliveredDesc)
    .map((o) => present(o.id, o.data, staff.uid))

  const recent = [...delivered]
    .sort(byDeliveredDesc)
    .slice(0, 30)
    .map((o) => present(o.id, o.data, staff.uid))

  const all = delivered.map((o) => o.data)

  return {
    profile: { name: staff.name, phone: staff.phone ?? null, telegramId: staff.telegramId ?? null },
    available,
    active,
    done,
    recent,
    stats: {
      today: bucket(all, today),
      week: bucket(all, tashkentDayStart(6)),
      month: bucket(all, tashkentDayStart(29)),
      total: all.length,
    },
    serverTime: new Date().toISOString(),
  }
}
