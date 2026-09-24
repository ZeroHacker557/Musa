import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './firebase'
import { distanceKm, type Point } from '../courier/route'

/**
 * «Kuryer qayerda» — mijoz o'z buyurtmasi bo'yicha kuryerning jonli joyi.
 *
 * `order_tracking/{orderId}` ni server faqat buyurtma «Yetkazilmoqda»
 * bo'lganda yozadi va yopilishi bilan o'chiradi; Rules uni faqat buyurtma
 * egasiga beradi (api/_lib/actions/location.ts).
 */
export type Tracking = {
  lat: number
  lng: number
  heading: number | null
  /** `live` — Telegram jonli joylashuvi, `app` — kuryerning ochiq ilovasi. */
  source: 'live' | 'app'
  at: string
  courierName: string
}

/** Shundan eski joylashuv «jonli» hisoblanmaydi. */
export const TRACKING_FRESH_MS = 3 * 60_000

export function useOrderTracking(orderId: string | null, destination: Point | null): Tracking | null {
  const [tracking, setTracking] = useState<Tracking | null>(null)

  useEffect(() => {
    if (!orderId) return

    // Faqat dev (`?deliveryDemo`): kuryer manzil tomon yurib keladi
    if (import.meta.env.DEV && orderId.startsWith('demo-')) {
      if (!destination) return
      const start = { lat: destination.lat + 0.018, lng: destination.lng + 0.022 }
      const began = Date.now()
      const step = () => {
        const k = Math.min(0.92, (Date.now() - began) / 90_000)
        setTracking({
          lat: start.lat + (destination.lat - start.lat) * k,
          lng: start.lng + (destination.lng - start.lng) * k,
          heading: 225,
          source: 'live',
          at: new Date().toISOString(),
          courierName: 'Komiljon',
        })
      }
      const first = setTimeout(step, 0)
      const timer = setInterval(step, 3000)
      return () => {
        clearTimeout(first)
        clearInterval(timer)
      }
    }

    return onSnapshot(
      doc(db, 'order_tracking', orderId),
      (snap) => {
        if (!snap.exists()) return setTracking(null)
        const d = snap.data()
        setTracking({
          lat: Number(d.lat),
          lng: Number(d.lng),
          heading: d.heading === null || d.heading === undefined ? null : Number(d.heading),
          source: d.source === 'live' ? 'live' : 'app',
          at: String(d.at || ''),
          courierName: String(d.courierName || ''),
        })
      },
      // Ruxsat yo'q yoki hujjat hali yo'q — kartochka vaqt bo'yicha ishlayveradi
      () => setTracking(null),
    )
  }, [orderId, destination])

  return orderId ? tracking : null
}

/**
 * Qolgan taxminiy vaqt, daqiqa — kuryerning HOZIRGI joyidan.
 *
 * Server formulasiga (api/_lib/actions/courier.ts → etaMinutes) yaqin:
 * to'g'ri chiziq × 1.4 / 25 km/soat, lekin qo'shimcha faqat 2 daqiqa
 * (mashina allaqachon yo'lda) va pastki chegara 1 daqiqa — yetib
 * kelayotganda «10 daqiqa» deb qotib qolmasin.
 */
export function liveMinutes(from: Point, to: Point): number {
  return Math.max(1, Math.round((distanceKm(from, to) * 1.4 * 60) / 25 + 2))
}
