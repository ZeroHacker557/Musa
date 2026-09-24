import type { VercelRequest, VercelResponse } from '@vercel/node'
import { linkoPull } from './_lib/actions/linko.js'
import { endExpiredShifts } from './_lib/actions/shift.js'
import { fail } from './_lib/http.js'

/**
 * Linko katalogini jadval bo'yicha tortadi.
 *
 * Ikki joydan chaqiriladi:
 *   • Vercel Cron — `Authorization: Bearer <CRON_SECRET>` yuboradi;
 *   • bot (bot/bot.py) — `x-cron-secret` sarlavhasi bilan, kun davomida
 *     tez-tez, chunki Hobby rejasida cron kuniga bir marta ishlaydi.
 *
 * Admin panel esa `linko.pull` amali orqali qo'lda chaqiradi — mantiq
 * bitta joyda (api/_lib/actions/linko.ts).
 *
 * Shu bilan birga kechagi kuryer smenalari yopiladi (actions/shift.ts):
 * alohida funksiya ochilmadi — Vercel'da funksiyalar soni cheklangan.
 * Ikkinchi cron (19:00 UTC = Toshkent 00:00) aynan shu uchun.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = String(process.env.CRON_SECRET || '')
  if (!secret) return fail(res, 500, 'CRON_SECRET sozlanmagan', 'CRON_SECRET_MISSING')

  const header = String(req.headers.authorization || '')
  const provided = header.startsWith('Bearer ')
    ? header.slice(7)
    : String(req.headers['x-cron-secret'] || '')

  if (provided !== secret) return fail(res, 401, 'Ruxsat yo‘q', 'FORBIDDEN')

  // Smenalar Linko'dan mustaqil: sinxron yiqilsa ham yopilaversin
  let shifts: { ended: number } | { error: string }
  try {
    shifts = await endExpiredShifts()
  } catch (error) {
    console.error('[linko-cron] smenalar yopilmadi:', error)
    shifts = { error: error instanceof Error ? error.message : 'xato' }
  }

  try {
    const result = await linkoPull(null, { full: req.query.full === '1' })
    return res.status(200).json({ ...result, shifts })
  } catch (error) {
    // Sinxron yiqilsa do'kon ishlashda davom etadi — faqat log va 200 emas 500
    console.error('[linko-cron] xato:', error)
    return fail(res, 500, error instanceof Error ? error.message : 'Sinxron bajarilmadi')
  }
}
