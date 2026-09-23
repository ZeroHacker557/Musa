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
