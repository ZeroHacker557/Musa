import { adminDb } from '../firebase-admin.js'
import { escapeHtml, sendMessage } from '../telegram.js'
import { adminTargets } from './orders.js'

/**
 * Mijoz kuryerni baholaydi (mini app'dagi 5 yulduzli oyna).
 *
 * POST /api/reviews { kind: "courier", orderId, stars, tags?, comment? }
 *
 * Shartlar: buyurtma shu mijozniki, «Yetkazildi», kuryeri bor va hali
 * baholanmagan. Baho buyurtmaga yoziladi, kuryerning `staff` hujjatida
 * esa yig'indi va soni oshadi — profildagi «★ 4.8 (23)» shundan.
 * Past baho (1–2) adminlarga darhol xabar qilinadi.
 */

const TAGS = new Set([
  'fast', 'polite', 'careful',       // yaxshi
  'late', 'rude', 'damaged',         // yomon
])
const TAG_UZ: Record<string, string> = {
  fast: 'Tez yetkazdi', polite: 'Xushmuomala', careful: 'Ehtiyotkor',
  late: 'Kechikdi', rude: 'Qo‘pol', damaged: 'Mahsulot shikastlangan',
}

export class RatingError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function rateCourier(userId: number, body: Record<string, unknown>) {
  const orderId = String(body.orderId || '').trim()
  const stars = Math.floor(Number(body.stars))
  if (!orderId) throw new RatingError('ORDER_MISSING', 'Buyurtma tanlanmagan')
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    throw new RatingError('RATING_RANGE', 'Baho 1 dan 5 gacha bo‘lishi kerak')
  }
  const tags = Array.isArray(body.tags) ? [...new Set(body.tags.map(String))].filter((t) => TAGS.has(t)) : []
  const comment = String(body.comment ?? '').trim().slice(0, 500)

  const db = await adminDb()
  const orderRef = db.collection('orders').doc(orderId)
  const now = new Date().toISOString()

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef)
    if (!snap.exists) throw new RatingError('ORDER_GONE', 'Buyurtma topilmadi')
    const order = snap.data() as {
      userId?: number; status?: string; courierId?: string | null; courierName?: string
      orderNumber?: string; courierRating?: unknown
    }
    if (Number(order.userId) !== userId) throw new RatingError('NOT_YOURS', 'Bu buyurtma sizniki emas')
    if (order.status !== 'Yetkazildi') throw new RatingError('NOT_DELIVERED', 'Buyurtma hali yetkazilmagan')
    if (!order.courierId) throw new RatingError('NO_COURIER', 'Bu buyurtmani kuryer yetkazmagan')
    if (order.courierRating) throw new RatingError('ALREADY_RATED', 'Siz bu buyurtmani allaqachon baholagansiz')

    const staffRef = db.collection('staff').doc(order.courierId)
    const staffSnap = await tx.get(staffRef)
    const staff = (staffSnap.data() || {}) as { ratingSum?: number; ratingCount?: number }

    tx.update(orderRef, { courierRating: { stars, tags, comment, at: now } })
    if (staffSnap.exists) {
      tx.update(staffRef, {
        ratingSum: (Number(staff.ratingSum) || 0) + stars,
        ratingCount: (Number(staff.ratingCount) || 0) + 1,
      })
    }
    return { courierName: order.courierName || 'Kuryer', orderNumber: order.orderNumber || `#${orderId.slice(0, 6)}` }
  })

  // Past baho — admin darhol bilsin
  if (stars <= 2) {
    try {
      const text =
        `⭐ <b>Past baho: ${stars}/5</b> — ${escapeHtml(result.courierName)}\n` +
        `📦 ${escapeHtml(result.orderNumber)}` +
        (tags.length ? `\n🏷 ${tags.map((t) => TAG_UZ[t]).join(', ')}` : '') +
        (comment ? `\n💬 ${escapeHtml(comment)}` : '')
      for (const target of await adminTargets()) await sendMessage(target, text)
    } catch (error) {
      console.error('[rating] adminlarga xabar ketmadi:', error)
    }
  }

  return { ok: true, stars }
}
