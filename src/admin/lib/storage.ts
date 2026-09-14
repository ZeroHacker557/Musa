import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { auth } from './auth'

const storage = getStorage(auth.app)

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Brauzer rasmni keshda bir yil saqlasin.
 *
 * Firebase sukut bo'yicha `private, max-age=0` beradi — mijoz ilovani har
 * ochganda har bir rasm qaytadan so'raladi. Fayl nomi har safar noyob
 * (vaqt + tasodifiy), ya'ni bir manzildagi rasm hech qachon o'zgarmaydi,
 * shuning uchun `immutable` xavfsiz.
 */
const CACHE = 'public, max-age=31536000, immutable'

/** Siqilgan nusxalar o'lchami va sifati. */
const VARIANTS = {
  /** Katalog kartochkasi ekranda ~170px — retina uchun ~3 baravar. */
  thumb: { maxSide: 480, quality: 0.8 },
  /** Mahsulot sahifasi — telefonda to'liq enida ham tiniq. */
  optimized: { maxSide: 1200, quality: 0.86 },
} as const

export type UploadedImage = {
  /** Asl fayl — kattalashtirish uchun, sifati to'liq. */
  url: string
  optimized: string
  thumb: string
}

/**
 * Rasmni WebP ga siqadi, kerak bo'lsa kichraytiradi.
 *
 * Kattalashtirilmaydi: kichik rasm kichikligicha qoladi. WebP shaffoflikni
 * saqlaydi. Brauzer WebP yarata olmasa (eski Safari) — JPEG, oq fon bilan:
 * ilovada rasm baribir oq quti ichida ko'rinadi.
 */
async function compress(file: File, maxSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Rasmni qayta ishlab bo‘lmadi')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

  const webp = await encode('image/webp')
  if (webp && webp.type === 'image/webp') return webp

  // WebP qo'llab-quvvatlanmaydi — shaffof joylarni oq bilan to'ldirib JPEG
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  const jpeg = await encode('image/jpeg')
  if (!jpeg) throw new Error('Rasmni siqib bo‘lmadi')
  return jpeg
}

async function put(path: string, data: Blob, contentType: string): Promise<string> {
  const snapshot = await uploadBytes(ref(storage, path), data, { contentType, cacheControl: CACHE })
  return getDownloadURL(snapshot.ref)
}

/**
 * Mahsulot rasmini Firebase Storage'ga yuklaydi: asl fayl + ikki siqilgan nusxa.
 *
 * Yuklash serverdan emas, brauzerdan to'g'ridan-to'g'ri: serverless
 * funksiya tanasi ~4.5 MB bilan cheklangan va katta rasm o'tmaydi.
 * Siqish ham shu yerda — serverda rasm kutubxonasi yo'q.
 *
 * Fayllar `products/` ichida BIR darajada: storage.rules shu yo'lga
 * yozishga ruxsat beradi, ichki papkalarga emas.
 */
export async function uploadProductImage(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Faqat rasm fayli')
  if (file.size > MAX_BYTES) throw new Error('Rasm 5 MB dan katta bo‘lmasin')

  const base = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

  const [thumbBlob, optimizedBlob] = await Promise.all([
    compress(file, VARIANTS.thumb.maxSide, VARIANTS.thumb.quality),
    compress(file, VARIANTS.optimized.maxSide, VARIANTS.optimized.quality),
  ])
  const ext = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')

  const [url, optimized, thumb] = await Promise.all([
    put(`${base}_${safe}`, file, file.type),
    put(`${base}_opt.${ext(optimizedBlob)}`, optimizedBlob, optimizedBlob.type),
    put(`${base}_thumb.${ext(thumbBlob)}`, thumbBlob, thumbBlob.type),
  ])

  return { url, optimized, thumb }
}
