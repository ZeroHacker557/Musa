import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { auth } from './auth'

const storage = getStorage(auth.app)

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Mahsulot rasmini Firebase Storage'ga yuklaydi va URL qaytaradi.
 *
 * Yuklash serverdan emas, brauzerdan to'g'ridan-to'g'ri: serverless
 * funksiya tanasi ~4.5 MB bilan cheklangan va katta rasm o'tmaydi.
 * Ruxsat storage.rules da roli bo'yicha tekshiriladi.
 *
 * getDownloadURL() tokenli havola qaytaradi — u bucket ochiq bo'lmasa ham
 * ishlaydi, shuning uchun URL ni qo'lda yasashdan ko'ra ishonchliroq.
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Faqat rasm fayli')
  if (file.size > MAX_BYTES) throw new Error('Rasm 5 MB dan katta bo‘lmasin')

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`

  const snapshot = await uploadBytes(ref(storage, path), file, { contentType: file.type })
  return getDownloadURL(snapshot.ref)
}
