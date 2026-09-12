import { initializeApp, getApps } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig } from '../../config/firebase'

/**
 * Admin panel Firebase seansi.
 *
 * Mini app Telegram initData orqali custom token bilan kiradi; admin panel
 * esa oddiy email/parol bilan. Ikkalasi bir Firebase loyihasida, lekin
 * alohida sahifalar — seanslar bir-biriga aralashmaydi.
 */
const app = getApps()[0] ?? initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

/** Sahifa yopilib ochilganda ham kirgan holat saqlanadi. */
export const persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => {})

export type StaffRole = 'owner' | 'admin' | 'courier'

export type Staff = {
  uid: string
  email: string
  name: string
  role: StaffRole
  telegramId?: number | null
  phone?: string | null
  active: boolean
}

const RANK: Record<StaffRole, number> = { courier: 1, admin: 2, owner: 3 }

/** Rol yetarlimi? `owner` — `admin`ning, u esa `courier`ning hamma huquqiga ega. */
export function can(role: StaffRole | undefined, required: StaffRole): boolean {
  if (!role) return false
  return RANK[role] >= RANK[required]
}

export function watchUser(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export async function login(email: string, password: string) {
  await persistenceReady
  await signInWithEmailAndPassword(auth, email.trim(), password)
}

export function logout() {
  return signOut(auth)
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email.trim())
}

/**
 * Firebase xatolarini tushunarli o'zbekcha matnga aylantiradi.
 * Xavfsizlik uchun "email yo'q" va "parol noto'g'ri" bitta xabar beradi —
 * aks holda qaysi email ro'yxatdan o'tganini tekshirib olish mumkin.
 */
export function authErrorText(error: unknown): string {
  const code = (error as { code?: string })?.code ?? ''
  switch (code) {
    case 'auth/invalid-email':
      return 'Email manzili noto‘g‘ri'
    case 'auth/user-disabled':
      return 'Bu hisob bloklangan'
    case 'auth/too-many-requests':
      return 'Juda ko‘p urinish. Bir necha daqiqadan keyin qayta urinib ko‘ring'
    case 'auth/network-request-failed':
      return 'Tarmoqqa ulanib bo‘lmadi'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email yoki parol noto‘g‘ri'

    // Eng ko'p uchraydigan sozlash xatosi: Firebase Console'da
    // Email/Password provayderi yoqilmagan. Admin SDK hisob yarata
    // oladi, lekin brauzerdan kirish ishlamaydi — shuning uchun
    // "hisob yaratildi, lekin kira olmayapman" holati kelib chiqadi.
    case 'auth/operation-not-allowed':
      return 'Firebase Console → Authentication → Sign-in method da Email/Password yoqilmagan'

    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Firebase config noto‘g‘ri (src/config/firebase.ts)'

    default:
      // Noma'lum xatoda kodni ko'rsatamiz — aks holda sababni
      // topish uchun brauzer konsolini ochish kerak bo'ladi.
      return code ? `Kirib bo‘lmadi (${code})` : 'Kirib bo‘lmadi. Qaytadan urinib ko‘ring'
  }
}
