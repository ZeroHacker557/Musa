/**
 * Admin panelga xodim qo'shadi (yoki mavjudining parolini/rolini yangilaydi).
 *
 * Birinchi egani shu skript bilan yaratasiz — undan keyin qolganlari
 * admin panelning o'zidan qo'shiladi.
 *
 * Ishlatish (loyiha ildizidan):
 *   node scripts/create-staff.mjs <email> <parol> [rol] [ism] [telegramId]
 *
 * Masalan:
 *   node scripts/create-staff.mjs musa@example.com "Kuchli-Parol-123" owner "Abubakr" 7203124812
 *
 * Rollar: owner | admin | courier   (ko'rsatilmasa — owner)
 *
 * Service account JSON loyiha ildizida turishi kerak (bot/config.py dagi
 * FIREBASE_KEY_FILE bilan bir xil fayl). U .gitignore'da.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const ROLES = ['owner', 'admin', 'courier']

const [, , email, password, role = 'owner', name = '', telegramId = ''] = process.argv

if (!email || !password) {
  console.error('Ishlatish: node scripts/create-staff.mjs <email> <parol> [rol] [ism] [telegramId]')
  process.exit(1)
}
if (!ROLES.includes(role)) {
  console.error(`Rol noto'g'ri: ${role}. Ruxsat etilgan: ${ROLES.join(', ')}`)
  process.exit(1)
}
if (password.length < 8) {
  console.error("Parol kamida 8 belgidan iborat bo'lsin.")
  process.exit(1)
}

// Ildizdagi service account faylini o'zi topadi
const keyFile = readdirSync(process.cwd()).find(
  (f) => f.includes('firebase-adminsdk') && f.endsWith('.json'),
)
if (!keyFile) {
  console.error("Service account JSON topilmadi (loyiha ildizida *firebase-adminsdk*.json bo'lishi kerak).")
  process.exit(1)
}

const key = JSON.parse(readFileSync(resolve(process.cwd(), keyFile), 'utf8'))
initializeApp({
  credential: cert({
    projectId: key.project_id,
    clientEmail: key.client_email,
    privateKey: key.private_key.replace(/\\n/g, '\n'),
  }),
})

const auth = getAuth()
const db = getFirestore()

let user
try {
  user = await auth.getUserByEmail(email)
  await auth.updateUser(user.uid, { password, displayName: name || user.displayName })
  console.log(`Mavjud hisob yangilandi: ${email}`)
} catch (error) {
  if (error.code !== 'auth/user-not-found') throw error
  user = await auth.createUser({ email, password, displayName: name || email })
  console.log(`Yangi hisob yaratildi: ${email}`)
}

// Rol ikki joyda: custom claim (Firestore Rules uchun) va staff hujjati
// (admin panel ro'yxati va darhol bloklash uchun).
await auth.setCustomUserClaims(user.uid, { role })

await db.collection('staff').doc(user.uid).set(
  {
    uid: user.uid,
    email,
    name: name || email.split('@')[0],
    role,
    telegramId: telegramId ? Number(telegramId) : null,
    active: true,
    createdAt: new Date().toISOString(),
  },
  { merge: true },
)

console.log(`Rol: ${role}`)
console.log(`UID: ${user.uid}`)
if (telegramId) console.log(`Telegram ID: ${telegramId}`)
console.log('\nEndi /admin manzilidan shu email va parol bilan kiring.')
process.exit(0)
