import { getTelegram } from './telegram'

/**
 * Onlayn to'lov (WLCM) — mijoz ilovasi, kuryer va admin uchun umumiy.
 * Server tomoni: api/_lib/actions/payments.ts.
 */

/** Onlayn to'lov kutilayotgan buyurtma holati — server bilan AYNAN bir xil. */
export const AWAITING_PAYMENT = 'To‘lov kutilmoqda' as const

export type PayProvider = 'click' | 'payme' | 'uzum' | 'paylov'

/** Ko'rinish tartibi va brend ranglari. */
export const PAY_PROVIDERS: { id: PayProvider; label: string; color: string }[] = [
  { id: 'payme', label: 'Payme', color: '#00c1c1' },
  { id: 'click', label: 'Click', color: '#0096ff' },
  { id: 'uzum', label: 'Uzum', color: '#7000ff' },
  { id: 'paylov', label: 'Paylov', color: '#ff6a2b' },
]

export function providerLabel(id?: string | null): string {
  return PAY_PROVIDERS.find((p) => p.id === id)?.label ?? ''
}

/**
 * Naqd to'lovmi — kuryer pulni qo'lda oladimi.
 *
 * Faqat «Naqd» (va eski yozuvlardagi bo'sh qiymat). «Karta» (o'tkazma)
 * va «Onlayn» — naqd EMAS: kuryer kassasida ko'rinmasligi kerak.
 */
export function isCashPayment(method?: string | null): boolean {
  return !method || method === 'Naqd'
}

/**
 * To'lov sahifasini ochadi. Telegram ichida — ilova yopilmaydi, sahifa
 * ustida ochiladi; mijoz qaytganda ilova buyurtmani jonli kuzatib turadi.
 */
export function openPayment(url: string) {
  const tg = getTelegram()
  if (tg?.openLink) tg.openLink(url)
  else window.open(url, '_blank', 'noopener')
}
