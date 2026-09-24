import { adminDb } from '../firebase-admin.js'
import type { Staff } from '../admin-auth.js'
import { canDeliver } from '../courier-staff.js'

/**
 * Kuryerning jonli joylashuvi.
 *
 *   courier_locations/{staffUid}  — admin xaritasi (faqat admin o'qiydi)
 *   order_tracking/{orderId}      — mijozning «Kuryer qayerda» xaritasi
 *                                   (faqat buyurtma egasi o'qiydi)
 *
 * Ikki manba bor:
 *   live — Telegram'ning «Jonli joylashuv»i: kuryer botga bir marta
 *          ulashadi, Telegram esa fonda yuborib turadi (mini app yopiq
 *          bo'lsa ham). Bot uni qabul qilib, xuddi shu shaklda yozadi
 *          (bot/firebase_db.py → save_courier_location).
 *   app  — mini app ochiq turganda ilovaning o'zi (har 30 soniyada).
 *
 * Mijozga faqat «Yetkazilmoqda» holatidagi O'Z buyurtmasi bo'yicha
 * ko'rinadi. Buyurtma yopilishi bilan `order_tracking` o'chiriladi
 * (orders.ts → applyStatusEffects), ya'ni kuryer yetkazib bo'lgach
 * uning joyi mijozga ko'rinmay qoladi.
 */

type Body = Record<string, unknown>

export type LocationPoint = {
  lat: number
  lng: number
  accuracy?: number | null
  heading?: number | null
  speed?: number | null
}

export type LocationSource = 'live' | 'app'

/** Ilova yuborgan nuqta — noto'g'ri bo'lsa rad etiladi. */
export function readPoint(body: Body): LocationPoint {
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    throw new Error('Joylashuv noto‘g‘ri')
  }
  const num = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null)
  return { lat, lng, accuracy: num(body.accuracy), heading: num(body.heading), speed: num(body.speed) }
}

/**
 * Joylashuvni yozadi: kuryer hujjati va uning yo'ldagi har buyurtmasi
 * uchun kuzatuv hujjati.
 *
 * `liveUntil` — Telegram jonli ulashishi qachongacha (faqat `live`).
 * Ilova manbasi jonli ulashishni «bosib» ketmasin: jonli ulashish
 * yaqinda kelgan bo'lsa, ilova nuqtasi faqat aniqroq bo'lsagina yoziladi.
 */
export async function saveCourierLocation(
  staff: Pick<Staff, 'uid' | 'name' | 'telegramId'>,
  point: LocationPoint,
  source: LocationSource,
  liveUntil: string | null = null,
) {
  const db = await adminDb()
  const at = new Date().toISOString()
  const ref = db.collection('courier_locations').doc(staff.uid)

  if (source === 'app') {
    const prev = (await ref.get()).data() as { source?: string; at?: string } | undefined
    const recentLive = prev?.source === 'live' && Date.now() - Date.parse(prev.at || '') < 60_000
    if (recentLive) return { saved: false, reason: 'live' }
  }

  const doc = {
    uid: staff.uid,
    name: staff.name,
    telegramId: staff.telegramId ?? null,
    lat: point.lat,
    lng: point.lng,
    accuracy: point.accuracy ?? null,
    heading: point.heading ?? null,
    speed: point.speed ?? null,
    source,
    at,
    ...(source === 'live' ? { liveUntil } : {}),
  }
  await ref.set(doc, { merge: true })

  // Yo'ldagi buyurtmalarning mijozlari uchun
  const active = await db.collection('orders').where('courierId', '==', staff.uid).get()
  const batch = db.batch()
  let tracked = 0
  for (const order of active.docs) {
    const data = order.data() as { status?: string; userId?: number }
    if (data.status !== 'Yetkazilmoqda' || !data.userId) continue
    batch.set(db.collection('order_tracking').doc(order.id), {
      userId: data.userId,
      courierUid: staff.uid,
      courierName: staff.name,
      lat: point.lat,
      lng: point.lng,
      heading: point.heading ?? null,
      source,
      at,
    })
    tracked++
  }
  if (tracked) await batch.commit()

  return { saved: true, tracked }
}

/** Mini app: ochiq turganda joylashuv (smenadagi kuryer). */
export async function courierLocation(staff: Staff, body: Body) {
  if (!canDeliver(staff)) throw new Error('Bu amal faqat kuryer uchun')
  return saveCourierLocation(staff, readPoint(body), 'app')
}

/**
 * Kuryer yangi buyurtma olganda — so'nggi ma'lum joylashuvi darhol
 * mijozga ham ko'rinsin (keyingi yangilanishni kutmasdan).
 */
export async function seedOrderTracking(orderId: string, staff: Pick<Staff, 'uid' | 'name'>, userId?: number | null) {
  if (!userId) return
  try {
    const db = await adminDb()
    const snap = await db.collection('courier_locations').doc(staff.uid).get()
    const loc = snap.data() as { lat?: number; lng?: number; heading?: number | null; source?: string; at?: string } | undefined
    // 10 daqiqadan eski joylashuv mijozni chalg'itadi
    if (!loc?.lat || !loc.lng || Date.now() - Date.parse(loc.at || '') > 10 * 60_000) return
    await db.collection('order_tracking').doc(orderId).set({
      userId,
      courierUid: staff.uid,
      courierName: staff.name,
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading ?? null,
      source: loc.source ?? 'app',
      at: loc.at,
    })
  } catch (error) {
    console.error('[location] kuzatuv boshlanmadi:', error)
  }
}

/** Buyurtma yopildi — mijoz kuryerning joyini endi ko'rmasin. */
export async function clearOrderTracking(orderId: string) {
  try {
    await (await adminDb()).collection('order_tracking').doc(orderId).delete()
  } catch (error) {
    console.error('[location] kuzatuv o‘chirilmadi:', error)
  }
}

/** Kuryer profili uchun: jonli ulashish holati. */
export async function locationStatus(uid: string) {
  const snap = await (await adminDb()).collection('courier_locations').doc(uid).get()
  const loc = snap.data() as { source?: string; at?: string; liveUntil?: string | null } | undefined
  if (!loc?.at) return { at: null, source: null, liveUntil: null }
  return { at: loc.at, source: loc.source ?? null, liveUntil: loc.liveUntil ?? null }
}
