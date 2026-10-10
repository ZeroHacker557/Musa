import { FPS } from '../anim'
import VOICES from './voices.json'

/**
 * «Botdan qanday buyurtma beriladi» — qo'llanma video (≈73 s).
 *
 * Vaqtlar diktor ovozidan olingan (public/audio/guide-voice.wav):
 * pauzalar ffmpeg silencedetect bilan, so'zlar faster-whisper (tr) bilan
 * o'lchandi. Sahna va subtitr shu soniyalarga bog'langan — ovoz
 * almashtirilsa shu fayl yangilanadi.
 */

export const GUIDE_DURATION = 2190 // 73 s

/** Diktor: `?voice=sardor` (sukut — zilola). Vaqtlar Zilola bo'yicha yozilgan. */
export const VOICE = (new URLSearchParams(location.search).get('voice') || 'zilola') as keyof typeof VOICES
const ANCHORS = ((VOICES[VOICE] ?? VOICES.zilola) as { anchors: number[][] }).anchors

/** Zilola soniyasi → joriy diktor soniyasi (gaplar chegarasi bo'yicha chiziqli). */
export function warp(x: number): number {
  if (!ANCHORS.length) return x
  if (x <= ANCHORS[0][0]) return x + ANCHORS[0][1] - ANCHORS[0][0]
  for (let i = 1; i < ANCHORS.length; i++) {
    const [a0, b0] = ANCHORS[i - 1]
    const [a1, b1] = ANCHORS[i]
    if (x <= a1) return a1 === a0 ? b1 : b0 + ((x - a0) * (b1 - b0)) / (a1 - a0)
  }
  const [al, bl] = ANCHORS[ANCHORS.length - 1]
  return x + bl - al
}

const s = (sec: number) => Math.round(warp(sec) * FPS)

/** Sahnalar (global kadr). */
export const SCENES = {
  hook: [0, s(4.85)],
  search: [s(4.85), s(8.6)],
  lang: [s(8.6), s(10.4)],
  catalog: [s(10.4), s(15.8)],
  home: [s(15.8), s(23.33)],
  product: [s(23.33), s(29.1)],
  cart: [s(29.1), s(33.33)],
  form: [s(33.33), s(37.8)],
  address: [s(37.8), s(44.8)],
  payment: [s(44.8), s(50.05)],
  success: [s(50.05), s(53.85)],
  tracking: [s(53.85), s(60.0)],
  delivered: [s(60.0), s(65.9)],
  cta: [s(65.9), GUIDE_DURATION],
} as const

export type SceneKey = keyof typeof SCENES

/** Tepadagi qadam yorlig'i. */
export const STEPS: { from: SceneKey; label: string; icon: string }[] = [
  { from: 'search', label: 'Botni oching', icon: '🤖' },
  { from: 'lang', label: 'Tilni tanlang', icon: '🌐' },
  { from: 'catalog', label: 'Katalogni oching', icon: '🥟' },
  { from: 'home', label: 'Bosh sahifa', icon: '🏠' },
  { from: 'product', label: 'Mahsulot tanlang', icon: '🛒' },
  { from: 'cart', label: 'Savat', icon: '🧺' },
  { from: 'form', label: 'Ism va telefon', icon: '👤' },
  { from: 'address', label: 'Manzil', icon: '📍' },
  { from: 'payment', label: 'To‘lov', icon: '💳' },
  { from: 'success', label: 'Buyurtma berildi', icon: '✅' },
  { from: 'tracking', label: 'Kuzatish', icon: '🚚' },
  { from: 'delivered', label: 'Yetkazildi', icon: '🎉' },
]

/** Subtitr bo'laklari: matn va soniyalar (boshlanish, tugash). */
const RAW: [string, number, number][] = [
  ['Muzlatkichingiz bo‘shab qoldimi?', 0.0, 1.6],
  ['MUSA’dan buyurtma berish —', 2.0, 3.27],
  ['bir necha bosishda!', 3.4, 4.42],
  ['Telegram’da @musauz_bot ni toping', 4.84, 6.75],
  ['va «Start» tugmasini bosing.', 6.78, 8.3],
  ['O‘zingizga qulay tilni tanlang.', 8.6, 10.06],
  ['Yashil «Katalogni ochish» tugmasini bosing —', 10.4, 12.73],
  ['do‘kon shu yerning o‘zida,', 13.0, 14.29],
  ['Telegram ichida ochiladi.', 14.45, 15.54],
  ['Bosh sahifada yo‘nalishlar,', 15.88, 17.6],
  ['aksiyadagi setlar', 17.7, 18.6],
  ['va eng sevimli mahsulotlar.', 18.62, 20.38],
  ['Qidiruv orqali keraklisini', 20.68, 21.9],
  ['bir zumda topasiz.', 21.96, 23.16],
  ['Mahsulotni tanlang va', 23.48, 24.6],
  ['«Savatchaga qo‘shish»ni bosing.', 24.68, 26.25],
  ['Miqdorni plyus va minus bilan', 26.52, 28.1],
  ['o‘zgartirasiz.', 28.18, 29.05],
  ['Tanlaganlaringiz savatda jamlanadi.', 29.27, 31.13],
  ['Tayyor bo‘lsa — «Buyurtma berish».', 31.39, 33.18],
  ['Ismingiz va telefon raqamingizni yozing.', 33.4, 35.46],
  ['Keyingi safar ular o‘zi to‘ldiriladi.', 35.7, 37.58],
  ['Manzilni qo‘shing:', 37.86, 38.66],
  ['«Men turgan joy»ni bossangiz,', 38.97, 40.4],
  ['joylashuvingiz xaritadan o‘zi olinadi.', 40.5, 42.59],
  ['Yoki xaritada o‘zingiz belgilang.', 42.82, 44.63],
  ['To‘lov usulini tanlang:', 44.9, 45.99],
  ['naqd — kuryerga,', 46.31, 47.5],
  ['yoki kartaga o‘tkazib, chekni yuklaysiz.', 47.6, 49.85],
  ['«Buyurtma berish»ni bosing — tayyor!', 50.09, 52.02],
  ['Buyurtmangiz qabul qilindi.', 52.24, 53.64],
  ['Har bosqich haqida bot o‘zi xabar beradi.', 53.89, 56.07],
  ['Kuryer yo‘lga chiqqach,', 56.3, 57.6],
  ['uning qayerdaligini xaritada kuzatib turasiz.', 57.6, 59.81],
  ['Kuryer eshigingiz oldida —', 60.03, 61.42],
  ['mahsulotlar muzdek holda yetib keldi!', 61.71, 63.9],
  ['Kuryerni baholashni unutmang.', 64.17, 65.66],
  ['MUSA — sifatli muzlatilgan mahsulotlar', 65.96, 68.4],
  ['uyingizgacha.', 68.5, 69.36],
  ['Hoziroq @musauz_bot ga kiring!', 69.66, 71.3],
]

export type Word = { text: string; from: number; to: number }
export type Line = { from: number; to: number; words: Word[] }

/** Har bo'lak — so'zlar uzunligiga mutanosib vaqt bilan (karaoke ajratish). */
export const LINES: Line[] = RAW.map(([text, a, b]) => {
  const parts = text.split(' ')
  const weights = parts.map((p) => Math.max(2, p.replace(/[«»—,.:!?]/g, '').length))
  const total = weights.reduce((x, y) => x + y, 0)
  let t = a
  const words = parts.map((p, i) => {
    const d = ((b - a) * weights[i]) / total
    const w = { text: p, from: s(t), to: s(t + d) }
    t += d
    return w
  })
  return { from: s(a), to: s(b), words }
})

export const sec = s
