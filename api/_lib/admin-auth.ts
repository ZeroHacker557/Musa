import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth, adminDb } from './firebase-admin.js'
import { fail } from './http.js'

/**
 * Xodim rollari.
 *
 *   owner   — hamma narsa, shu jumladan boshqa adminlarni boshqarish
 *   admin   — kundalik ish: buyurtma, mahsulot, mijoz, broadcast
 *   courier — faqat o'ziga biriktirilgan buyurtmalar va ularning holati
 */
export type StaffRole = 'owner' | 'admin' | 'courier'

export type Staff = {
  uid: string
  email: string
  name: string
  role: StaffRole
  /** Telegram ID — buyurtma xabarnomalari shu manzilga boradi. */
  telegramId?: number | null
  phone?: string | null
  active: boolean
}

/** Rol ierarxiyasi: yuqoridagi quyidagining hamma huquqini o'z ichiga oladi. */
const RANK: Record<StaffRole, number> = { courier: 1, admin: 2, owner: 3 }

export function atLeast(role: StaffRole, required: StaffRole): boolean {
  return RANK[role] >= RANK[required]
}

/**
 * `Authorization: Bearer <Firebase ID token>` sarlavhasini tekshiradi.
 *
 * Faqat imzoni emas, Firestore'dagi `staff/{uid}` hujjatini ham o'qiydi:
 * custom claim tokenga yozilgan bo'lsa-da, xodim o'chirilganda yoki
 * bloklanganda token muddati tugagunicha (1 soat) amal qilib turaveradi.
 * Hujjatni har so'rovda tekshirish — bloklash darhol kuchga kirishi uchun.
 *
 * Ruxsat bo'lmasa javobni O'ZI yozadi va null qaytaradi.
 */
export async function requireStaff(
  req: VercelRequest,
  res: VercelResponse,
  required: StaffRole = 'admin',
): Promise<Staff | null> {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    fail(res, 401, 'Tizimga kirilmagan')
    return null
  }

  let uid: string
  try {
    const decoded = await (await adminAuth()).verifyIdToken(token, true)
    uid = decoded.uid
  } catch {
    fail(res, 401, 'Seans muddati tugagan — qaytadan kiring')
    return null
  }

  let snap
  try {
    snap = await (await adminDb()).collection('staff').doc(uid).get()
  } catch (error) {
    console.error('[admin-auth] staff o‘qilmadi:', error)
    fail(res, 500, 'Server xatosi')
    return null
  }

  if (!snap.exists) {
    fail(res, 403, 'Sizda admin panelga ruxsat yo‘q')
    return null
  }

  const data = snap.data() as Partial<Staff>
  const staff: Staff = {
    uid,
    email: String(data.email || ''),
    name: String(data.name || ''),
    role: (data.role as StaffRole) || 'courier',
    telegramId: data.telegramId ?? null,
    phone: data.phone ?? null,
    active: data.active !== false,
  }

  if (!staff.active) {
    fail(res, 403, 'Hisobingiz bloklangan')
    return null
  }

  if (!atLeast(staff.role, required)) {
    fail(res, 403, 'Bu amal uchun huquqingiz yetarli emas')
    return null
  }

  return staff
}
