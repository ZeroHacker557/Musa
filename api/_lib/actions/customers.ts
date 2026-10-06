import { adminDb } from '../firebase-admin.js'
import type { Staff } from '../admin-auth.js'
import { linkoToken, readLinkoSettings } from '../linko.js'
import { pushCustomerToLinko } from './linko-orders.js'

/**
 * Mijoz aloqa ma'lumoti (ism, telefon, manzil) — admin panel → Mijozlar.
 *
 * Ikki joyda bir xil saqlanadi:
 *   • bizda — `users/{id}` (contactName, contactPhone, contactAddress);
 *   • Ritm (Linko)'da — mijozning «market» yozuvi.
 * Ritm'da o'zgartirilgani esa Linko sinxronida bizga tortiladi
 * (linko-orders.ts → pullMarkets) — shuning uchun hech biri ikkinchisini
 * eskisi bilan ustidan yozmaydi.
 */

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

export async function customerUpdate(actor: Staff, body: Record<string, unknown>) {
  const uid = text(body.id, 20)
  if (!/^\d{3,20}$/.test(uid)) throw new Error('Mijoz topilmadi')
  const name = text(body.name, 80)
  const phone = text(body.phone, 40)
  const address = text(body.address, 300)
  if (!name) throw new Error('Mijoz ismini kiriting')
  if (phone && phone.replace(/\D/g, '').length < 9) throw new Error('Telefon raqami noto‘g‘ri')

  const db = await adminDb()
  const ref = db.collection('users').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Mijoz topilmadi')
  const user = snap.data() ?? {}

  const now = new Date().toISOString()
  await ref.set({
    contactName: name,
    contactPhone: phone,
    contactAddress: address,
    // Mini app buyurtma formasiga shu telefon tushadi
    ...(phone ? { phone } : {}),
    contactSource: 'admin',
    contactUpdatedAt: now,
    contactUpdatedBy: actor.name || actor.email,
  }, { merge: true })

  // Ritm (Linko)
  const settings = await readLinkoSettings()
  if (!settings.baseUrl || !linkoToken()) return { ok: true, linko: 'off' }
  if (!Number(user.linkoMarketId)) {
    // Ritm'da hali yo'q — birinchi buyurtmasida aynan shu ma'lumot bilan yaratiladi
    return { ok: true, linko: 'not-yet' }
  }
  try {
    await pushCustomerToLinko(uid, { name, phone, address, location: user.contactLocation ?? null }, settings, user)
    await ref.set({ contactLinkoAt: now }, { merge: true })
    return { ok: true, linko: 'updated' }
  } catch (error) {
    return { ok: true, linko: 'error', error: error instanceof Error ? error.message.slice(0, 200) : 'xato' }
  }
}
