import { adminDb } from '../firebase-admin.js'
import type { Staff } from '../admin-auth.js'

/**
 * Katalog amallari: mahsulot, kategoriya, promokod.
 *
 * Bot ham shu kolleksiyalarga yozadi (bot/firebase_db.py) — hujjat
 * shakli aynan bir xil saqlanadi, aks holda mini app eski va yangi
 * yozuvlarni turlicha o'qib qolardi.
 */

type Result = Record<string, unknown>

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v).trim()).filter(Boolean)
}

/** Bot bilan bir xil: 6 xonali tasodifiy raqamli identifikator. */
function newNumericId(): string {
  return String(Math.floor(Math.random() * 900000) + 100000)
}

export async function productSave(body: Record<string, unknown>): Promise<Result> {
  const name = text(body.name)
  if (!name) throw new Error('Mahsulot nomi kerak')

  const price = num(body.price)
  if (price <= 0) throw new Error('Narx noldan katta bo‘lishi kerak')

  const category = text(body.category)
  if (!category) throw new Error('Kategoriya tanlanmagan')

  const db = await adminDb()
  const id = text(body.id) || newNumericId()
  const ref = db.collection('products').doc(id)
  const existing = await ref.get()

  const oldPrice = num(body.oldPrice, 0)

  const data: Record<string, unknown> = {
    id,
    name,
    price,
    // 0 — "eski narx yo'q"; mini app undefined kutadi
    oldPrice: oldPrice > price ? oldPrice : null,
    category,
    images: list(body.images),
    sizes: list(body.sizes),
    color: text(body.color),
    description: text(body.description),
    discount: text(body.discount),
    stock: Math.max(0, Math.round(num(body.stock))),
    updatedAt: new Date().toISOString(),
  }

  if (!existing.exists) {
    // Reyting va sharhlar soni faqat yaratilganda beriladi — keyin
    // ularni sharhlar tizimi boshqaradi, admin qo'lda tegmaydi.
    data.rating = 5
    data.reviews = 0
    data.createdAt = data.updatedAt
  }

  await ref.set(data, { merge: true })
  return { id, created: !existing.exists }
}

export async function productDelete(body: Record<string, unknown>): Promise<Result> {
  const id = text(body.id)
  if (!id) throw new Error('id kerak')
  await (await adminDb()).collection('products').doc(id).delete()
  return { id }
}

export async function categorySave(body: Record<string, unknown>): Promise<Result> {
  const name = text(body.name)
  if (!name) throw new Error('Kategoriya nomi kerak')

  const db = await adminDb()
  const id = text(body.id) || newNumericId()

  // Bir xil nomli kategoriya ikki marta bo'lmasin — mahsulotlar
  // kategoriyaga NOM bo'yicha bog'langan, dublikat filtrni buzadi.
  const clash = await db.collection('categories').where('name', '==', name).get()
  if (clash.docs.some((doc) => doc.id !== id)) {
    throw new Error('Bunday nomli kategoriya allaqachon bor')
  }

  await db.collection('categories').doc(id).set(
    { id, name, icon: text(body.icon) || 'package' },
    { merge: true },
  )
  return { id }
}

export async function categoryDelete(body: Record<string, unknown>): Promise<Result> {
  const id = text(body.id)
  if (!id) throw new Error('id kerak')

  const db = await adminDb()
  const snap = await db.collection('categories').doc(id).get()
  if (!snap.exists) throw new Error('Kategoriya topilmadi')

  const name = String(snap.data()?.name || '')
  const used = await db.collection('products').where('category', '==', name).limit(1).get()
  if (!used.empty) {
    throw new Error('Bu kategoriyada mahsulotlar bor — avval ularni ko‘chiring')
  }

  await db.collection('categories').doc(id).delete()
  return { id }
}

export async function promoSave(body: Record<string, unknown>): Promise<Result> {
  const code = text(body.code).toUpperCase()
  if (!code) throw new Error('Promokod kerak')
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    throw new Error('Promokod 3–24 ta lotin harfi, raqam, - yoki _ dan iborat bo‘lsin')
  }

  const percent = Math.round(num(body.discountPercent))
  if (percent < 1 || percent > 90) throw new Error('Chegirma 1–90% oralig‘ida bo‘lsin')

  const db = await adminDb()
  const id = text(body.id)

  const clash = await db.collection('promocodes').where('code', '==', code).get()
  if (clash.docs.some((doc) => doc.id !== id)) {
    throw new Error('Bunday promokod allaqachon bor')
  }

  const data: Record<string, unknown> = {
    code,
    discountPercent: percent,
    active: body.active !== false,
    // 0 — cheksiz
    maxUses: Math.max(0, Math.round(num(body.maxUses))),
    expiresAt: text(body.expiresAt) || null,
  }

  if (id) {
    await db.collection('promocodes').doc(id).set(data, { merge: true })
    return { id }
  }

  data.usageCount = 0
  data.createdAt = new Date().toISOString()
  const ref = await db.collection('promocodes').add(data)
  return { id: ref.id, created: true }
}

export async function promoDelete(body: Record<string, unknown>): Promise<Result> {
  const id = text(body.id)
  if (!id) throw new Error('id kerak')
  await (await adminDb()).collection('promocodes').doc(id).delete()
  return { id }
}

/** Xodim rolini tekshirish katalog amallari uchun bir joyda. */
export function requireCatalogAccess(staff: Staff) {
  if (staff.role === 'courier') throw new Error('Kuryer katalogni o‘zgartira olmaydi')
}
