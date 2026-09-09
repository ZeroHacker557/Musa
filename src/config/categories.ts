import yarimTayyor from '../images/cat-yarim-tayyor.webp'
import muzqaymoq from '../images/cat-muzqaymoq.webp'
import sirok from '../images/cat-sirok.webp'
import type { Category } from '../types/domain'

/**
 * MUSA ning uchta asosiy yo'nalishi.
 *
 * Bular Firestore'dan emas, shu yerdan keladi — bozorga chiqish
 * yo'nalishlari kamdan-kam o'zgaradi va katalog bo'sh bo'lganda ham
 * ko'rinib turishi kerak. Bot admin paneli orqali qo'shiladigan mayda
 * kategoriyalar (Chuchvara, Manti, Plombir...) esa bazadan keladi va
 * shularning yoniga qo'shiladi.
 *
 * ⚠️ `name` — mahsulotning Firestore'dagi `category` maydoni bilan
 * AYNAN mos bo'lishi shart. Bot admin panelida mahsulot qo'shganda
 * kategoriya nomi shu ro'yxatdan yozilsa, filtr ishlaydi. Nomni
 * o'zgartirsangiz, bazadagi mahsulotlarnikini ham o'zgartiring.
 */
export type MainLine = {
  name: string
  /** category-icons.ts dagi kalit. */
  icon: string
  /** Karta foni — logotipdagi uch rangdan. */
  gradient: string
  /**
   * Foto — gradient o'rniga ko'rinadi. Rasmning nisbati karta bilan
   * bir xil bo'lsin, aks holda `cover` uni qirqadi: keng karta 2.2:1
   * (1320x600), yarim kartalar 1.27:1 (990x780).
   */
  image?: string
}

export const MAIN_LINES: MainLine[] = [
  {
    name: 'Yarim tayyor mahsulotlar',
    icon: 'chuchvara',
    gradient: 'linear-gradient(135deg, #0f8a48 0%, #04331c 100%)',
    image: yarimTayyor,
  },
  {
    name: 'Muzqaymoqlar',
    icon: 'muzqaymoq',
    gradient: 'linear-gradient(135deg, #2f5ed6 0%, #101f5e 100%)',
    image: muzqaymoq,
  },
  {
    name: 'Siroklar',
    icon: 'sirok',
    gradient: 'linear-gradient(135deg, #d9a52a 0%, #7a5406 100%)',
    image: sirok,
  },
]

const MAIN_NAMES = new Set(MAIN_LINES.map((line) => line.name.toLowerCase()))

/** Yo'nalish nomimi? Bosh sahifadagi lentada takrorlanmasligi uchun. */
export function isMainLine(name: string): boolean {
  return MAIN_NAMES.has(name.trim().toLowerCase())
}

/**
 * Yo'nalishlarni bazadagi kategoriyalar bilan birlashtiradi.
 *
 * Yo'nalishlar oldinda turadi; bazada shu nomli kategoriya bo'lsa
 * ikki marta chiqmaydi. Identifikatorlar manfiy — bazadagi musbat
 * id'lar bilan to'qnashmaydi.
 */
export function withMainLines(dbCategories: Category[]): Category[] {
  const lines: Category[] = MAIN_LINES.map((line, index) => ({
    id: -100 - index,
    name: line.name,
    icon: line.icon,
  }))
  return [...lines, ...dbCategories.filter((c) => !isMainLine(c.name))]
}
