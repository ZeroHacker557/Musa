import { adminDb } from '../firebase-admin.js'
import { sendMessage } from '../telegram.js'
import type { Staff } from '../admin-auth.js'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

/**
 * Sozlamalar `settings/{doc}` hujjatlarida:
 *   payment  — karta raqami va egasi (mini app checkout'da ko'rsatadi)
 *   delivery — yetkazish narxi va bepul chegarasi
 *   courier  — buyurtma kuryerlarga qanday yetkaziladi
 */
export async function settingsSave(actor: Staff, body: Record<string, unknown>) {
  if (actor.role !== 'owner') throw new Error('Faqat ega sozlamalarni o‘zgartira oladi')

  const db = await adminDb()
  const section = text(body.section)

  if (section === 'payment') {
    const cardNumber = text(body.cardNumber)
    const cardOwner = text(body.cardOwner)
    if (!cardNumber || !cardOwner) throw new Error('Karta raqami va egasi kerak')
    await db.collection('settings').doc('payment').set({ cardNumber, cardOwner }, { merge: true })
    return { ok: true }
  }

  if (section === 'delivery') {
    const fee = num(body.fee)
    const freeFrom = num(body.freeFrom)
    await db.collection('settings').doc('delivery').set({ fee, freeFrom }, { merge: true })
    return { ok: true }
  }

  if (section === 'courier') {
    // toCouriers — biriktirilgan kuryerga shaxsiy xabar
    // toGroup     — barcha buyurtmalar umumiy guruhga tushadi
    const data = {
      toCouriers: body.toCouriers !== false,
      toGroup: body.toGroup === true,
      groupChatId: text(body.groupChatId) || null,
      notifyAdmins: body.notifyAdmins !== false,
    }
    if (data.toGroup && !data.groupChatId) {
      throw new Error('Guruhga yuborish uchun guruh ID si kerak')
    }
    await db.collection('settings').doc('courier').set(data, { merge: true })
    return { ok: true }
  }

  throw new Error('Noma’lum sozlama bo‘limi')
}

/**
 * Guruh ulanishini tekshiradi — sinov xabari yuboradi.
 *
 * Guruh ID sini qo'lda yozishda xato qilish oson (masalan minus belgisi
 * tushib qoladi), shuning uchun saqlashdan oldin sinab ko'rish kerak.
 */
export async function settingsTestGroup(actor: Staff, body: Record<string, unknown>) {
  if (actor.role !== 'owner') throw new Error('Faqat ega sinovdan o‘tkaza oladi')

  const chatId = text(body.groupChatId)
  if (!chatId) throw new Error('Guruh ID si kerak')

  const result = await sendMessage(
    chatId,
    '✅ <b>MUSA admin panel</b>\n\nGuruh ulandi — yangi buyurtmalar shu yerga tushadi.',
  )
  if (!result.ok) throw new Error(`Yuborib bo‘lmadi: ${result.error}`)
  return { ok: true }
}
