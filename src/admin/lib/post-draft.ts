/**
 * Xabar qoralamasi — tugma turlari va tekshiruvlar.
 * Muharrir komponentlari: src/admin/components/PostComposer.tsx.
 */

/** Mini ilovada qayer ochiladi. */
export type Target = 'home' | 'catalog' | 'category' | 'section' | 'product' | 'orders' | 'favorites'
/** Telegram tugma rangi: '' — odatiy. */
export type ButtonColor = '' | 'success' | 'primary' | 'danger'

/** Inline tugma: havola yoki mini ilovaning kerakli joyini ochadi. */
export type ButtonDraft = {
  kind: 'url' | 'app'
  text: string
  textRu: string
  url: string
  target: Target
  /** Kategoriya nomi, bo'lim id'si yoki mahsulot id'si — `target` ga qarab. */
  value: string
  style: ButtonColor
}

export const TARGETS: { key: Target; label: string }[] = [
  { key: 'home', label: 'Bosh sahifa' },
  { key: 'catalog', label: 'Katalog' },
  { key: 'category', label: 'Kategoriya' },
  { key: 'section', label: 'Bo‘lim' },
  { key: 'product', label: 'Mahsulot' },
  { key: 'orders', label: 'Buyurtmalarim' },
  { key: 'favorites', label: 'Sevimlilar' },
]

export const COLORS: { key: ButtonColor; label: string; swatch: string }[] = [
  { key: '', label: 'Odatiy', swatch: '#8e99a4' },
  { key: 'success', label: 'Yashil', swatch: '#2fa84f' },
  { key: 'primary', label: 'Ko‘k', swatch: '#2f80ed' },
  { key: 'danger', label: 'Qizil', swatch: '#e5484d' },
]

/** Serverga ketadigan manzil: api/_lib/actions/people.ts → appQuery. */
function targetOf(b: ButtonDraft): string {
  if (b.target === 'category') return `cat:${b.value}`
  if (b.target === 'section') return `sec:${b.value}`
  if (b.target === 'product') return `product:${b.value}`
  return b.target
}

export const NEW_BUTTON: ButtonDraft = {
  kind: 'app', text: '', textRu: '', url: '', target: 'home', value: '', style: '',
}

/** Telegram izoh chegarasi — uzunroq matn rasmdan keyin alohida xabar bo'lib ketadi. */
export const CAPTION_MAX = 1024
export const MAX_BUTTONS = 4
export const plainLength = (value: string) => value.replace(/<[^>]+>/g, '').length

export function buttonError(b: ButtonDraft): string {
  if (!b.text.trim()) return 'Tugma matnini yozing'
  if (b.kind === 'url') return /^(https?:\/\/|tg:\/\/)\S+$/i.test(b.url.trim()) ? '' : 'Havola https:// bilan boshlansin'
  if (b.target === 'category' && !b.value) return 'Kategoriyani tanlang'
  if (b.target === 'section' && !b.value) return 'Bo‘limni tanlang'
  if (b.target === 'product' && !b.value) return 'Mahsulotni tanlang'
  return ''
}

/** Serverga ketadigan ko'rinish (people.ts → readButtons). */
export function cleanButtons(buttons: ButtonDraft[]) {
  return buttons.map((b) => ({
    kind: b.kind,
    text: b.text.trim(),
    textRu: b.textRu.trim(),
    url: b.url.trim(),
    target: b.kind === 'app' ? targetOf(b) : '',
    style: b.style,
  }))
}
