/**
 * Sana ko'rinishi. Brauzerning `uz-UZ` formati bir xil emas («2026 M09 28»,
 * «09-29»), shuning uchun o'zimiz yozamiz.
 */
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const two = (n: number) => String(n).padStart(2, '0')

/** «29.09 21:18» */
export function shortDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`
}

/** «28-sentabr 2026, 18:19» */
export function longDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()}-${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${two(d.getHours())}:${two(d.getMinutes())}`
}
