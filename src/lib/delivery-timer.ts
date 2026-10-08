import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'

/**
 * «Yetkazib berish bepul» taymeri — marketing (admin → Sozlamalar → Marketing).
 *
 * Mijoz bosh sahifaga kirganda N daqiqalik sanoq boshlanadi. Shu vaqt
 * ichida berilgan buyurtmada yetkazish BEPUL — buni server ham tekshiradi
 * (api/orders.ts → deliveryTimerAt), ya'ni va'da haqiqiy: yetkazish narxi
 * keyinchalik qo'yilsa ham taymerdagi buyurtma bepul ketadi.
 *
 * Holat qurilmada (localStorage): qachon boshlangan va ishlatilganmi.
 * Sozlama har ochilishda bir marta o'qiladi (obuna emas — o'qish tejaladi).
 */

export type TimerConfig = {
  enabled: boolean
  /** Sanoq davomiyligi, daqiqa. */
  minutes: number
  /** `daily` — kuniga bir marta; `visit` — har kirishda (oldingisi tugagan bo'lsa). */
  repeat: 'daily' | 'visit'
}

type Saved = { start: number; minutes: number; used?: boolean }

const KEY = 'musa:delivery-timer'
const DEFAULT: TimerConfig = { enabled: true, minutes: 20, repeat: 'daily' }

export function readTimerConfig(data: unknown): TimerConfig {
  const raw = (data ?? {}) as Partial<TimerConfig>
  const minutes = Math.round(Number(raw.minutes))
  return {
    enabled: raw.enabled !== false,
    minutes: Number.isFinite(minutes) && minutes >= 1 && minutes <= 180 ? minutes : DEFAULT.minutes,
    repeat: raw.repeat === 'visit' ? 'visit' : 'daily',
  }
}

let config: TimerConfig | null = null
let saved: Saved | null = load()
/** Shu ochilishda taymer boshlanganmi (`visit` rejimi uchun). */
let startedThisVisit = false
let version = 0
const listeners = new Set<() => void>()

function load(): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as Saved | null
    return value && Number.isFinite(value.start) && Number.isFinite(value.minutes) ? value : null
  } catch {
    return null
  }
}

function store(next: Saved) {
  saved = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // saqlanmasa ham shu seansda ishlaydi
  }
  emit()
}

function emit() {
  version++
  listeners.forEach((listener) => listener())
}

export function subscribeTimer(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const timerVersion = () => version

/** Sozlama yuklangan va yoqilgan. */
export const timerEnabled = () => config?.enabled === true

let loading: Promise<void> | null = null
export function loadTimerConfig(): Promise<void> {
  loading ??= getDoc(doc(db, 'settings', 'marketing'))
    .then((snap) => {
      config = readTimerConfig(snap.exists() ? snap.data()?.deliveryTimer : null)
    })
    .catch(() => {
      // O'qib bo'lmasa — taymer ko'rsatilmaydi (va'da berilmaydi)
      config = { ...DEFAULT, enabled: false }
    })
    .finally(emit)
  return loading
}

/** Faqat dev: `?timerDemo` — serversiz, har ochilishda yangi sanoq. */
export function enableTimerDemo() {
  config = { ...DEFAULT }
  saved = null
  loading = Promise.resolve()
  emit()
}

/** Ishlayotgan taymer: boshlangan va tugash vaqti (ms). */
export function activeTimer(now = Date.now()): { start: number; end: number } | null {
  if (!config?.enabled || !saved || saved.used) return null
  const end = saved.start + saved.minutes * 60_000
  return now < end ? { start: saved.start, end } : null
}

const dayOf = (ms: number) => new Date(ms).toDateString()

/**
 * Bosh sahifada chaqiriladi: vaqti kelgan bo'lsa yangi sanoq boshlanadi.
 * `true` — hozir boshlandi (katta oyna ko'rsatiladi).
 */
export function startTimerIfDue(now = Date.now()): boolean {
  if (!config?.enabled || activeTimer(now)) return false
  if (saved) {
    if (config.repeat === 'daily' && dayOf(saved.start) === dayOf(now)) return false
    if (config.repeat === 'visit' && startedThisVisit) return false
  }
  startedThisVisit = true
  store({ start: now, minutes: config.minutes })
  return true
}

/** Buyurtma bilan serverga — taymer qachon boshlangan (ishlayotgan bo'lsa). */
export function timerStartedAt(): string | null {
  const timer = activeTimer()
  return timer ? new Date(timer.start).toISOString() : null
}

/** Buyurtma berildi — bu sanoq ishlatildi, banner yo'qoladi. */
export function markTimerUsed() {
  if (saved && activeTimer()) store({ ...saved, used: true })
}
