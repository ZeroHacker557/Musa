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
  /**
   * Katalogdagi chip uchun qisqa nom. `name` filtr kaliti bo'lgani uchun
   * o'zgarmaydi — bu faqat ko'rinish: uzun nom chipni cho'zib yuborardi.
   */
  short?: string
}

export const MAIN_LINES: MainLine[] = [
  {
    name: 'Yarim tayyor mahsulotlar',
    short: 'Yarim tayyorlar',
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

/** Chipda ko'rsatiladigan nom — yo'nalishning qisqa nomi bo'lsa o'sha. */
export function shortCategoryName(name: string): string {
  const line = MAIN_LINES.find((l) => l.name.toLowerCase() === name.trim().toLowerCase())
  return line?.short ?? name
}

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
  const byName = new Map(dbCategories.map((c) => [c.name.trim().toLowerCase(), c]))
  const lines: Category[] = MAIN_LINES.map((line, index) => ({
    id: -100 - index,
    name: line.name,
    icon: line.icon,
    // Bazadagi nusxaning tartibi — admin panelda belgilangani
    order: byName.get(line.name.toLowerCase())?.order,
  }))
  const all = [...lines, ...dbCategories.filter((c) => !isMainLine(c.name))]

  /*
   * Admin tartibi bo'yicha. Tartib belgilanmaganlar joyida qoladi:
   * yo'nalishlar oldinda, qolganlari keyin (stable sort).
   */
  return all
    .map((category, index) => ({ category, index }))
    .sort(
      (a, b) =>
        (a.category.order ?? 1e9 + a.index) - (b.category.order ?? 1e9 + b.index),
    )
    .map(({ category }) => category)
}
