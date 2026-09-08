/**
 * Firebase mijoz (web) konfiguratsiyasi.
 *
 * Bu qiymatlar MAXFIY EMAS — Firebase ularni brauzerga ataylab ochiq
 * beradi, himoya Firestore Rules va App Check tomonida. Shuning uchun
 * env o'zgaruvchi emas, oddiy konstanta: Vercel'da 7 ta o'zgaruvchini
 * to'ldirish o'rniga shu faylni almashtirish kifoya.
 *
 * Firebase Console → ⚙️ Project Settings → General → "Your apps" →
 * Web app → SDK setup and configuration → Config.
 *
 * DIQQAT: bu yerdagi projectId bot ishlatadigan service account
 * (bot/config.py → FIREBASE_KEY_FILE) bilan BIR XIL loyihaga tegishli
 * bo'lishi shart. Aks holda bot bir bazaga yozadi, ilova boshqasidan
 * o'qiydi va katalog bo'sh ko'rinadi.
 *
 * ⚠️ TODO(MUSA): quyidagi qiymatlar BO'SH JOY TUTUVCHI. Eski V7
 * loyihasining kalitlari ataylab olib tashlandi — aks holda MUSA
 * ilovasi V7 bazasiga ulanib qolardi. MUSA uchun yangi Firebase
 * loyihasini oching va Config'ni shu yerga ko'chiring.
 */
export const firebaseConfig = {
  apiKey: 'TODO_MUSA_API_KEY',
  authDomain: 'TODO-musa.firebaseapp.com',
  projectId: 'TODO-musa',
  storageBucket: 'TODO-musa.firebasestorage.app',
  messagingSenderId: 'TODO_MUSA_SENDER_ID',
  appId: 'TODO_MUSA_APP_ID',
  measurementId: 'TODO_MUSA_MEASUREMENT_ID',
}

/**
 * Config to'ldirilmaganda tushunarli xato beradi — aks holda Firebase
 * "auth/invalid-api-key" deb yozadi va sabab noaniq qoladi.
 */
export const firebaseConfigured = !firebaseConfig.apiKey.startsWith('TODO')

if (!firebaseConfigured) {
  console.error(
    '[MUSA] Firebase config to’ldirilmagan — src/config/firebase.ts ' +
      'faylini Firebase Console’dagi qiymatlar bilan almashtiring.',
  )
}
