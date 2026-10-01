/**
 * Kirish ovozi: mijoz botga (mini app) HAR kirganda asosiy sahifada chalinadi —
 * ilova ochilib intro (ochilish reklamasi) tugaganda va mini app yopilmay
 * fonga ketib, qayta ochilganda ham.
 *
 * Telefon brauzerlari (ayniqsa iOS / Telegram) foydalanuvchi ekranga
 * tegmaguncha ovozni bloklaydi. Shuning uchun:
 *   1) introdagi «O'tkazib yuborish» bosilganda — o'sha bosish ichida chalinadi;
 *   2) bloklansa — foydalanuvchining birinchi tegishida (bir necha soniya
 *      ichida) chalinadi; kech qolsa chalinmaydi, kutilmaganda gapirmasin.
 *
 * MUHIM: bu yerdagi hech qanday xato ilovani to'xtatmasligi kerak — ovoz
 * ixtiyoriy bezak. Hammasi try/catch ichida.
 */

/** `?v=` — fayl almashtirilganda eski nusxa keshdan chiqmasin. */
const SRC = '/sounds/welcome.mp3?v=2'
/** Bloklangan ovozni birinchi tegishda chalish uchun kutish muddati. */
const GESTURE_WINDOW_MS = 8000
/** Ketma-ket ikki marta (masalan intro + qaytish bir vaqtda) chalinmasin. */
const MIN_GAP_MS = 5000

let audio: HTMLAudioElement | null = null
let lastPlayedAt = 0
let pendingCleanup: (() => void) | null = null

/** Faylni oldindan yuklab qo'yadi — chalish kerak bo'lganda kechikmasin. */
export function prepareWelcomeVoice() {
  try {
    if (audio || typeof Audio === 'undefined') return
    audio = new Audio(SRC)
    audio.preload = 'auto'
  } catch {
    audio = null
  }
}

export function playWelcomeVoice() {
  try {
    if (Date.now() - lastPlayedAt < MIN_GAP_MS) return
    prepareWelcomeVoice()
    const sound = audio
    if (!sound) return
    lastPlayedAt = Date.now()
    pendingCleanup?.()
    sound.currentTime = 0

    const attempt = sound.play()
    if (!attempt || typeof attempt.catch !== 'function') return
    attempt.catch(() => {
      // Bloklandi — birinchi tegishda (muddat ichida) qayta urinamiz
      const until = Date.now() + GESTURE_WINDOW_MS
      const onGesture = () => {
        cleanup()
        if (Date.now() > until) return
        try {
          void sound.play()?.catch(() => {})
        } catch {
          // ovozsiz davom etamiz
        }
      }
      const timer = window.setTimeout(() => cleanup(), GESTURE_WINDOW_MS)
      const cleanup = () => {
        window.clearTimeout(timer)
        window.removeEventListener('pointerdown', onGesture, true)
        window.removeEventListener('keydown', onGesture, true)
        if (pendingCleanup === cleanup) pendingCleanup = null
      }
      pendingCleanup = cleanup
      window.addEventListener('pointerdown', onGesture, true)
      window.addEventListener('keydown', onGesture, true)
    })
  } catch {
    // ovozsiz davom etamiz
  }
}

/**
 * Mini app yopilmay fonga ketib, qayta ochilganda — yana chalinadi
 * (`isHome` — faqat asosiy sahifada). Qaytaradi: obunani bekor qilish.
 */
export function watchWelcomeReturns(isHome: () => boolean): () => void {
  let hiddenAt = 0
  const onVisibility = () => {
    try {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        audio?.pause()
        return
      }
      if (hiddenAt && isHome()) playWelcomeVoice()
      hiddenAt = 0
    } catch {
      // ovozsiz davom etamiz
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  return () => document.removeEventListener('visibilitychange', onVisibility)
}
