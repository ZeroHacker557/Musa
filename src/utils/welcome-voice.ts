/**
 * Kirish ovozi: mini app ochilib, intro (ochilish reklamasi) tugagach
 * asosiy sahifada BIR MARTA chalinadi (har ochilishda — sahifa yuklanishiga).
 *
 * Telefon brauzerlari (ayniqsa iOS / Telegram) foydalanuvchi ekranga
 * tegmaguncha ovozni bloklaydi. Shuning uchun:
 *   1) introdagi «O'tkazib yuborish» bosilganda — o'sha bosish ichida chalinadi;
 *   2) bloklansa — foydalanuvchining birinchi tegishida (bir necha soniya
 *      ichida) chalinadi; kech qolsa umuman chalinmaydi, kutilmaganda
 *      gapirib yubormasin.
 */

const SRC = '/sounds/welcome.mp3'
/** Bloklangan ovozni birinchi tegishda chalish uchun kutish muddati. */
const GESTURE_WINDOW_MS = 8000

let audio: HTMLAudioElement | null = null
let played = false

/** Faylni oldindan yuklab qo'yadi — chalish kerak bo'lganda kechikmasin. */
export function prepareWelcomeVoice() {
  if (audio || typeof Audio === 'undefined') return
  audio = new Audio(SRC)
  audio.preload = 'auto'
  audio.volume = 0.9
}

export function playWelcomeVoice() {
  if (played) return
  prepareWelcomeVoice()
  if (!audio) return
  played = true
  const sound = audio

  const attempt = sound.play()
  if (!attempt) return
  attempt.catch(() => {
    // Bloklandi — birinchi tegishda (muddat ichida) qayta urinamiz
    const until = Date.now() + GESTURE_WINDOW_MS
    const onGesture = () => {
      cleanup()
      if (Date.now() <= until) void sound.play().catch(() => {})
    }
    const cleanup = () => {
      window.removeEventListener('pointerdown', onGesture, true)
      window.removeEventListener('keydown', onGesture, true)
    }
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
    window.setTimeout(cleanup, GESTURE_WINDOW_MS)
  })
}
