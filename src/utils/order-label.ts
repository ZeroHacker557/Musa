/**
 * Chek raqami har kuni #0001 dan boshlanadi (api/_lib/order-number.ts),
 * shuning uchun bugungi bo'lmagan buyurtmaga sana qo'shiladi:
 * «#0005 · 23.09». Bugungisi — faqat raqam, ortiqcha shovqin bo'lmasin.
 */

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

/** Toshkent bo'yicha bugungi sana: «2026-09-24». */
export function tashkentToday(now = Date.now()): string {
  return new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, 10)
}

/** «2026-09-23» → «23.09». */
export function shortDay(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`
}

export function datedNumber(number: string, orderDay: string | null | undefined, today = tashkentToday()): string {
  if (!orderDay || orderDay === today || !/^\d{4}-\d{2}-\d{2}$/.test(orderDay)) return number
  return `${number} · ${shortDay(orderDay)}`
}
