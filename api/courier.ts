import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'
import { courierDeliver, courierOverview, courierTake } from './_lib/actions/courier.js'
import { courierByTelegram } from './_lib/courier-staff.js'

/**
 * POST /api/courier   { action: "overview" | "take" | "deliver", orderId? }
 * Authorization: Bearer <Firebase ID token>
 *
 * Mini app'dagi kuryer sahifasi. Kuryer ilovaga Telegram orqali kiradi
 * (api/auth.ts), shuning uchun token uid'i — uning Telegram ID si.
 * Kuryerligi har so'rovda `staff` dan tekshiriladi: admin kuryerni
 * bloklasa, keyingi so'rovdayoq rad etiladi.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  const authHeader = String(req.headers.authorization || '')
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) return fail(res, 401, 'Avtorizatsiya talab qilinadi')

  let uid: string
  try {
    uid = (await (await adminAuth()).verifyIdToken(idToken)).uid
  } catch {
    return fail(res, 401, 'Sessiya eskirgan, ilovani qayta oching')
  }

  const courier = await courierByTelegram(Number(uid))
  if (!courier) return fail(res, 403, 'Siz kuryer emassiz yoki hisobingiz faol emas', 'NOT_COURIER')

  const body = (req.body ?? {}) as Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : ''

  try {
    let result: object
    if (action === 'overview') result = await courierOverview(courier)
    else if (action === 'take') result = await courierTake(courier, body)
    else if (action === 'deliver') result = await courierDeliver(courier, body)
    else return fail(res, 400, `Noma’lum amal: ${action || '(bo‘sh)'}`)

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error(`[courier] ${action} xatosi:`, error)
    return fail(res, 400, error instanceof Error ? error.message : 'Amal bajarilmadi')
  }
}
