import { useEffect, useState, useSyncExternalStore } from 'react'
import { activeTimer, subscribeTimer, timerEnabled, timerVersion } from '../lib/delivery-timer'

/** Taymer sozlamasi yuklanib, yoqilganmi (App — har soniya qayta chizilmasin). */
export function useTimerEnabled(): boolean {
  useSyncExternalStore(subscribeTimer, timerVersion)
  return timerEnabled()
}

/**
 * «Yetkazib berish bepul» sanog'i — qolgan vaqt har soniyada yangilanadi.
 * Faqat taymer ishlayotganda soat yuradi.
 */
export function useDeliveryTimer() {
  useSyncExternalStore(subscribeTimer, timerVersion)
  const [now, setNow] = useState(() => Date.now())
  const timer = activeTimer(now)
  const running = timer !== null

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  if (!timer) return { active: false as const, remainingMs: 0, totalMs: 0, progress: 0 }
  const totalMs = timer.end - timer.start
  // `now` taymer boshlanishidan oldingi bo'lishi mumkin (boshlangan zahoti)
  const remainingMs = Math.min(Math.max(timer.end - now, 0), totalMs)
  return { active: true as const, remainingMs, totalMs, progress: totalMs ? remainingMs / totalMs : 0 }
}

/** 19:42 */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
