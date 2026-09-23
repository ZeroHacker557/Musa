import { apiPost } from '../lib/api'

/** Server qaytaradigan buyurtma — api/_lib/actions/courier.ts → present(). */
export type CourierOrder = {
  id: string
  number: string
  status: string
  createdAt: string | null
  takenAt: string | null
  deliveredAt: string | null
  /** Admin aynan shu kuryerga biriktirgan. */
  assignedToMe: boolean
  customer: {
    name: string
    phone: string
    address: string
    comment: string
    recipientName: string
    recipientPhone: string
    location: { lat: number; lng: number } | null
  }
  /** `image` — kichik nusxa (~480px), faqat tafsilotlar oynasida ko'rinadi. */
  items: { name: string; quantity: number; price: number; size: string | null; image: string | null }[]
  total: number
  paymentMethod: string
}

export type CourierBucket = { delivered: number; cash: number; card: number }

export type CourierOverview = {
  profile: { name: string; phone: string | null; telegramId: number | null }
  available: CourierOrder[]
  active: CourierOrder[]
  done: CourierOrder[]
  recent: CourierOrder[]
  stats: { today: CourierBucket; week: CourierBucket; month: CourierBucket; total: number }
  serverTime: string
}

export type TakeOutcome = 'claimed' | 'already' | 'taken' | 'closed' | 'not_found'
export type DeliverOutcome = 'done' | 'already' | 'not_yours' | 'closed' | 'not_found'

/**
 * Faqat `vite dev` da: `?courierDemo` bilan kuryer sahifasini soxta
 * ma'lumot bilan ko'rish. Productionda bu shox butunlay kesib tashlanadi.
 */
export const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('courierDemo')

export async function fetchOverview(): Promise<CourierOverview> {
  if (DEMO) return (await import('./demo')).demoOverview()
  return apiPost<CourierOverview>('/api/courier', { action: 'overview' })
}

export async function takeOrder(orderId: string): Promise<{ outcome: TakeOutcome; courierName: string | null }> {
  if (DEMO) return (await import('./demo')).demoTake(orderId)
  return apiPost('/api/courier', { action: 'take', orderId })
}

export async function deliverOrder(orderId: string): Promise<{ outcome: DeliverOutcome }> {
  if (DEMO) return (await import('./demo')).demoDeliver(orderId)
  return apiPost('/api/courier', { action: 'deliver', orderId })
}
