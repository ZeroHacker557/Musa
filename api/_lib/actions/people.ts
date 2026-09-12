import { adminAuth, adminDb } from '../firebase-admin.js'
import { sendMessage } from '../telegram.js'
import type { Staff, StaffRole } from '../admin-auth.js'

const ROLES: StaffRole[] = ['owner', 'admin', 'courier']

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Xodim qo'shadi yoki yangilaydi.
 *
 * Ikki xil xodim bo'lishi mumkin:
 *
 *   • Veb xodim (ega, admin) — email va parol bilan, Firebase Auth'da
 *     hisobi bor, panelga kiradi. Rol IKKI joyga yoziladi: custom claim
 *     (Firestore Rules shuni o'qiydi) va `staff/{uid}` hujjati.
 *
 *   • Telegram kuryeri — email/parolsiz. Auth'da hisobi YO'Q, faqat
 *     `staff` hujjati sifatida yashaydi va buyurtmalarni Telegram orqali
 *     oladi. Kuryerga panel kerak emas, shuning uchun undan email so'rash
 *     ortiqcha to'siq bo'lardi.
 *
 * Kuryerga keyinchalik email qo'shilsa, unga panel ham ochiladi.
 */
export async function staffSave(actor: Staff, body: Record<string, unknown>) {
  if (actor.role !== 'owner') throw new Error('Faqat ega xodim qo‘sha oladi')

  const uid = text(body.uid)
  const email = text(body.email).toLowerCase()
  const name = text(body.name)
  const password = text(body.password)
  const role = body.role as StaffRole
  const phone = text(body.phone)
  const telegramRaw = text(body.telegramId)
  const active = body.active !== false

  if (!ROLES.includes(role)) throw new Error('Rol noto‘g‘ri')
  if (!name) throw new Error('Ism kerak')

  const telegramId = telegramRaw ? Number(telegramRaw) : null
  if (telegramRaw && !Number.isInteger(telegramId)) {
    throw new Error('Telegram ID faqat raqamlardan iborat bo‘lsin')
  }

  const auth = await adminAuth()
  const db = await adminDb()

  const webAccess = Boolean(email)

  if (!webAccess) {
    if (role !== 'courier') throw new Error('Admin va ega uchun email majburiy')
    if (!telegramId) throw new Error('Kuryerga Telegram ID kerak — busiz buyurtma bormaydi')
  } else if (!email.includes('@')) {
    throw new Error('Email manzili noto‘g‘ri')
  }

  // Telegram ID ikki xodimda takrorlanmasin — aks holda «Oldim» tugmasi
  // qaysi kuryerniki ekani aniqlanmay qoladi.
  if (telegramId) {
    const clash = await db.collection('staff').where('telegramId', '==', telegramId).get()
    if (clash.docs.some((doc) => doc.id !== uid)) {
      throw new Error('Bu Telegram ID boshqa xodimga biriktirilgan')
    }
  }

  const existing = uid ? await db.collection('staff').doc(uid).get() : null
  const hadAuth = existing?.exists ? existing.data()?.webAccess !== false : false

  let targetUid = uid

  if (webAccess && targetUid && hadAuth) {
    if (targetUid === actor.uid && role !== 'owner') {
      throw new Error('O‘z rolingizni pasaytira olmaysiz')
    }
    if (targetUid === actor.uid && !active) throw new Error('O‘zingizni bloklay olmaysiz')

    await auth.updateUser(targetUid, {
      email,
      displayName: name,
      disabled: !active,
      ...(password ? { password } : {}),
    })
    await auth.setCustomUserClaims(targetUid, { role })
  } else if (webAccess) {
    // Yangi veb hisob — yoki Telegram-only kuryerga endi panel ochilmoqda
    if (password.length < 8) throw new Error('Parol kamida 8 belgidan iborat bo‘lsin')

    const created = await auth.createUser({ email, password, displayName: name })
    // Eski Telegram-only hujjat yangi identifikatorga ko'chadi
    if (targetUid && existing?.exists) await db.collection('staff').doc(targetUid).delete()
    targetUid = created.uid
    await auth.setCustomUserClaims(targetUid, { role })
  } else if (!targetUid) {
    // Telegram-only kuryer: Auth hisobisiz, o'z identifikatori bilan
    targetUid = db.collection('staff').doc().id
  }

  await db.collection('staff').doc(targetUid).set(
    {
      uid: targetUid,
      email: email || null,
      name,
      role,
      phone: phone || null,
      telegramId,
      active,
      webAccess,
      updatedAt: new Date().toISOString(),
      ...(uid ? {} : { createdAt: new Date().toISOString() }),
    },
    { merge: true },
  )

  if (!uid && telegramId) {
    await sendMessage(
      telegramId,
      '👋 <b>Siz MUSA jamoasiga qo‘shildingiz</b>\n\n' +
        `Rol: <b>${role === 'courier' ? 'Kuryer' : role === 'admin' ? 'Admin' : 'Ega'}</b>\n` +
        'Buyurtmalar shu chatga tushadi.',
    )
  }

  return { uid: targetUid, created: !uid, webAccess }
}

export async function staffDelete(actor: Staff, body: Record<string, unknown>) {
  if (actor.role !== 'owner') throw new Error('Faqat ega xodimni o‘chira oladi')

  const uid = text(body.uid)
  if (!uid) throw new Error('uid kerak')
  if (uid === actor.uid) throw new Error('O‘zingizni o‘chira olmaysiz')

  const db = await adminDb()

  // Kuryerga biriktirilgan buyurtmalar egasiz qolmasin
  const assigned = await db.collection('orders').where('courierId', '==', uid).get()
  for (const doc of assigned.docs) {
    await doc.ref.set({ courierId: null, courierName: null }, { merge: true })
  }

  await db.collection('staff').doc(uid).delete()
  try {
    await (await adminAuth()).deleteUser(uid)
  } catch {
    // Telegram-only kuryerda Auth hisobi bo'lmaydi — bu normal holat
  }

  return { uid, unassigned: assigned.size }
}

type Segment = 'all' | 'customers' | 'active30'

/**
 * Ommaviy xabar — BO'LAKLAB yuboriladi.
 *
 * Vercel funksiyasi bir necha soniyada to'xtaydi, Telegram esa soniyasiga
 * ~30 xabarga ruxsat beradi. Shuning uchun bitta chaqiruv cheklangan
 * miqdorni yuboradi va keyingi kursorni qaytaradi; admin panel esa
 * tugagunicha takrorlaydi va jarayonni ko'rsatib turadi.
 */
export async function broadcast(actor: Staff, body: Record<string, unknown>) {
  if (actor.role === 'courier') throw new Error('Kuryer ommaviy xabar yubora olmaydi')

  const message = text(body.text)
  if (!message) throw new Error('Xabar matni bo‘sh')
  if (message.length > 3500) throw new Error('Xabar juda uzun (3500 belgigacha)')

  const segment = (text(body.segment) || 'all') as Segment
  const after = text(body.after)
  const limit = Math.min(40, Math.max(1, Number(body.limit) || 25))

  const db = await adminDb()
  let query = db.collection('users').orderBy('__name__').limit(limit)
  if (after) query = db.collection('users').orderBy('__name__').startAfter(after).limit(limit)

  const snap = await query.get()

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const doc of snap.docs) {
    const data = doc.data() as { lastActive?: string; phone?: string }

    if (segment === 'customers' && !data.phone) {
      skipped++
      continue
    }
    if (segment === 'active30') {
      const last = Date.parse(String(data.lastActive || ''))
      if (!last || last < cutoff) {
        skipped++
        continue
      }
    }

    const result = await sendMessage(doc.id, message)
    if (result.ok) sent++
    else failed++
    await new Promise((resolve) => setTimeout(resolve, 40))
  }

  const last = snap.docs[snap.docs.length - 1]
  return {
    sent,
    failed,
    skipped,
    processed: snap.size,
    nextCursor: snap.size === limit && last ? last.id : null,
  }
}
