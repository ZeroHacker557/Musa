import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyInitData } from './_lib/telegram-auth.js'
import { adminAuth, adminDb } from './_lib/firebase-admin.js'
import { fail, requirePost } from './_lib/http.js'
import { courierByTelegram } from './_lib/courier-staff.js'

/**
 * POST /api/auth   { initData: string }
 * → { token: string }
 *
 * Telegram imzosini tekshiradi va Firebase Custom Token qaytaradi.
 * Mini app shu token bilan signInWithCustomToken qiladi, natijada
 * Firestore Rules'da request.auth.uid ishonchli bo'ladi (F-02).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  const botToken = process.env.BOT_TOKEN
  if (!botToken) return fail(res, 500, 'Server sozlanmagan')

  const initData = typeof req.body?.initData === 'string' ? req.body.initData : ''

  let user
  try {
    user = verifyInitData(initData, botToken)
  } catch (error) {
    return fail(res, 401, error instanceof Error ? error.message : 'Tekshiruv xatosi')
  }

  const uid = String(user.id)

  try {
    /*
     * Kuryermi — mini app shu belgiga qarab kuryer sahifasini ochadi.
     * Har kirishda qayta tekshiriladi: admin kuryerni qo'shgan yoki
     * olib tashlagan bo'lsa, ilova keyingi ochilishda to'g'ri sahifaga
     * tushadi (panel belgini darhol ham yangilaydi — people.ts).
     */
    const courier = Boolean(await courierByTelegram(user.id))

    // Profil ma'lumotini serverda yangilaymiz — mijozga ishonmaymiz
    await (await adminDb()).collection('users').doc(uid).set(
      {
        id: user.id,
        courier,
        first_name: user.first_name,
        last_name: user.last_name ?? null,
        username: user.username ?? null,
        photo_url: user.photo_url ?? null,
        lastActive: new Date().toISOString(),
      },
      { merge: true },
    )

    const token = await (await adminAuth()).createCustomToken(uid, { telegramId: user.id })
    return res.status(200).json({ token })
  } catch (error) {
    console.error('[auth] xato:', error)
    return fail(res, 500, 'Autentifikatsiya amalga oshmadi')
  }
}
