/*
 * Chek raqami KUNLIK: har kuni Toshkent vaqti bilan 00:00 da #0001 dan
 * qayta boshlanadi. Har kunning o'z hisoblagichi bor
 * (`counters/orders-2026-09-23`), shuning uchun kun almashganda hech
 * narsani «nolga tushirish» kerak emas — yangi sana yangi hujjat.
 *
 * Raqam kunlar orasida takrorlanadi, buyurtmaning haqiqiy kaliti esa
 * hujjat identifikatori. Qaysi kunniki ekanini `orderDay` aytadi.
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000

/** Toshkent bo'yicha sana: «2026-09-23». */
export function tashkentDay(date = new Date()): string {
  return new Date(date.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10)
}

/** 7 → «#0007». 9999 dan oshsa ham kesilmaydi: «#10000». */
export function formatDailyNumber(n: number): string {
  return `#${String(n).padStart(4, '0')}`
}

/**
 * Xabarlardagi buyurtma yorlig'i. Raqam har kuni takrorlanadi, shuning
 * uchun bugungi bo'lmagan buyurtmaga sana qo'shiladi: «#0005 (23.09)».
 * Aks holda admin kechagi #0005 ni bugungisi bilan adashtirardi.
 */
export function orderLabel(
  order: { orderNumber?: string | null; orderDay?: string | null },
  id: string,
  today = tashkentDay(),
): string {
  const number = order.orderNumber || `#${id.slice(0, 6)}`
  const day = order.orderDay
  if (!day || day === today || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return number
  return `${number} (${day.slice(8, 10)}.${day.slice(5, 7)})`
}
