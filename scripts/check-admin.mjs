/**
 * Admin panelga kira olmasangiz — sababini topadi.
 *
 * Hech narsani o'zgartirmaydi, faqat o'qiydi:
 *   • Firebase'da Email/Password kirish yoqilganmi
 *   • Hisob bormi, rol custom claim'da bormi
 *   • staff/{uid} hujjati bormi va faolmi
 *   • Qaysi domenlardan kirishga ruxsat berilgan
 *
 * Ishlatish:
 *   node scripts/check-admin.mjs [email]
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const email = process.argv[2]

const keyFile = readdirSync(process.cwd()).find(
  (f) => f.includes('firebase-adminsdk') && f.endsWith('.json'),
)
if (!keyFile) {
  console.error("Service account JSON topilmadi (loyiha ildizida *firebase-adminsdk*.json).")
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

const ok = (m) => console.log(`  ✅ ${m}`)
const bad = (m) => console.log(`  ❌ ${m}`)
const info = (m) => console.log(`     ${m}`)

console.log(`\nLoyiha: ${key.project_id}\n`)

// ── 1. Email/Password yoqilganmi ──
console.log('1. Kirish usuli')
try {
  const config = await auth.projectConfigManager().getProjectConfig()
  const enabled = config?.emailPrivacyConfig !== undefined || true
  // Admin SDK provayder holatini to'g'ridan-to'g'ri bermaydi, shuning uchun
  // quyida REST orqali aniq tekshiramiz.
  void enabled
} catch {
  /* eski SDK — pastdagi REST tekshiruvi baribir ishlaydi */
}

try {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${key.project_id}/config`,
    { headers: { Authorization: `Bearer ${await accessToken()}` } },
  )
  const config = await response.json()
  if (config?.signIn?.email?.enabled) {
    ok('Email/Password yoqilgan')
  } else {
    bad('Email/Password YOQILMAGAN — asosiy sabab shu bo‘lishi mumkin')
    info('Firebase Console → Authentication → Sign-in method → Email/Password → Enable')
  }

  const domains = config?.authorizedDomains || []
  console.log('\n2. Ruxsat etilgan domenlar')
  info(domains.join(', ') || '(bo‘sh)')
  if (!domains.includes('localhost')) {
    bad('localhost ro‘yxatda yo‘q — lokal sinovda kirish ishlamaydi')
  } else {
    ok('localhost ruxsat etilgan')
  }
} catch (error) {
  bad(`Sozlamani o‘qib bo‘lmadi: ${error.message}`)
}

// ── 3. Hisob va rol ──
console.log('\n3. Hisoblar')
const staffSnap = await db.collection('staff').get()
if (staffSnap.empty) {
  bad('staff kolleksiyasi bo‘sh — hech kim qo‘shilmagan')
} else {
  for (const doc of staffSnap.docs) {
    const data = doc.data()
    console.log(`\n  ${data.email}  (${data.role})`)
    try {
      const user = await auth.getUser(doc.id)
      ok(`Auth hisobi bor${user.disabled ? ' — LEKIN BLOKLANGAN' : ''}`)
      const claimRole = user.customClaims?.role
      if (claimRole === data.role) ok(`Rol custom claim'da: ${claimRole}`)
      else bad(`Custom claim roli mos emas: ${claimRole ?? '(yo‘q)'} ≠ ${data.role}`)
    } catch {
      bad('Auth hisobi yo‘q — faqat Firestore hujjati qolgan')
    }
    if (data.active === false) bad('staff hujjatida active: false')
  }
}

if (email) {
  console.log(`\n4. «${email}» tekshiruvi`)
  try {
    const user = await auth.getUserByEmail(email)
    ok(`Topildi, UID: ${user.uid}`)
    const staff = await db.collection('staff').doc(user.uid).get()
    if (staff.exists) ok('staff hujjati bor')
    else bad('staff hujjati YO‘Q — panel "ruxsat yo‘q" deydi')
  } catch {
    bad('Bunday email bilan hisob yo‘q — kirishda aynan qaysi email yozilganini tekshiring')
  }
}

console.log('')
process.exit(0)

/** Service account bilan qisqa muddatli access token oladi. */
async function accessToken() {
  const { GoogleAuth } = await import('google-auth-library')
  const googleAuth = new GoogleAuth({
    credentials: { client_email: key.client_email, private_key: key.private_key.replace(/\\n/g, '\n') },
    scopes: ['https://www.googleapis.com/auth/firebase'],
  })
  const client = await googleAuth.getClient()
  const token = await client.getAccessToken()
  return token.token
}
