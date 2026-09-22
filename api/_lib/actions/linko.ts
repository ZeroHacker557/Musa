import { adminDb } from '../firebase-admin.js'
import { LOW_STOCK_AT } from './orders.js'
import {
  linkoCount, linkoGet, linkoList, linkoToken, readLinkoSettings, tmOf,
} from '../linko.js'

/**
 * Linko (SFA) bilan katalog sinxroni: MAHSULOT, NARX va QOLDIQ
 * Linko'dan MUSA'ga bir tomonlama ko'chiriladi.
 *
 * Nega oraliq `linko_products` to'plami bor?
 *
 * Linko'dagi har pozitsiya avtomatik do'konga chiqib ketmasligi kerak —
 * u yerda sotuvga chiqarilmaydiganlari ham bor. Shuning uchun avval
 * Linko katalogining NUSXASI olinadi, admin esa kerakli pozitsiyani
 * mavjud MUSA mahsulotiga bog'laydi yoki undan yangi mahsulot yaratadi.
 * Narx va qoldiq faqat BOG'LANGANLARIGA tushadi.
 *
 * Rasm, tavsif, tarjima va kategoriya MUSA tomonida qoladi: Linko'da
 * ular yo'q, har sinxronda ustidan yozilsa admin mehnati yo'qolardi.
 */

type Result = Record<string, unknown>

const MIRROR = 'linko_products'

type LinkoProduct = {
  id: number
  name?: string
  code?: string | null
  vendor_code?: string | null
  service_id?: string | null
  type?: { id?: number; name?: string } | null
  measurement?: { name?: string } | null
  tm?: string | number
}

type LinkoPriceItem = {
  product_id: number
  price_list_id: number
  price?: string | number
  tm?: string | number
}

type LinkoBalance = {
  product?: { id?: number } | null
  stock?: { id?: number } | null
  balance?: string | number
  tm?: string | number
}

type MirrorDoc = {
  linkoId: number
  name: string
  code: string
  vendorCode: string
  typeName: string
  measurement: string
  price: number
  balances: Record<string, number>
  stock: number
  productId: string | null
  /**
   * Shu pozitsiya do'kondagi mahsulotning NARXINI beradimi.
   *
   * Bitta mahsulotga bir nechta pozitsiya bog'lanishi mumkin (masalan
   * bir mahsulotning to'rt xil ta'mi Linko'da to'rt qator). Qoldiq
   * hammasining yig'indisi bo'ladi, narx esa bittasidan olinadi — aks
   * holda qaysi ta'mning narxi chiqishi tasodifga bog'liq bo'lardi.
   */
  primary: boolean
  updatedAt: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function newNumericId(): string {
  return String(Math.floor(Math.random() * 900000) + 100000)
}

/** Nom bo'yicha solishtirish uchun — registr va ortiqcha bo'shliqlarsiz. */
function key(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Firestore bitta batch'da 500 tadan ko'p yozuvni qabul qilmaydi. */
const BATCH_LIMIT = 400

type Write = { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }

async function commitAll(writes: Write[]): Promise<void> {
  if (!writes.length) return
  const db = await adminDb()
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    for (const item of writes.slice(i, i + BATCH_LIMIT)) {
      batch.set(item.ref, item.data, { merge: true })
    }
    await batch.commit()
  }
}

/**
 * Do'kondagi mahsulotning narx va qoldig'ini unga bog'langan HAMMA
 * Linko pozitsiyasidan qayta hisoblaydi.
 *
 * Qoldiq — yig'indi: to'rt xil ta'mning qoldig'i qo'shilib, mijoz
 * «bor» deb ko'radi. Narx — «asosiy» pozitsiyadan; u belgilanmagan
 * bo'lsa eng qimmatidan olinadi, chunki arzonini ko'rsatib qimmatini
 * sotish mijozni aldash bo'lardi.
 */
async function applyToProduct(
  productId: string,
  rows: { price: number; stock: number; primary?: boolean }[],
  now: string,
): Promise<Write | null> {
  /*
   * Bitta ham bog'langan pozitsiya qolmasa mahsulotga TEGILMAYDI:
   * narx va qoldiq oxirgi sinxrondagi holatida qoladi va endi ularni
   * admin o'zi boshqaradi. Qoldiqni nolga tushirish xavfli bo'lardi —
   * tasodifan uzib qo'yilgan mahsulot do'kondan yo'qolib qolardi.
   */
  if (!productId || !rows.length) return null

  const db = await adminDb()
  const stock = Math.max(0, Math.round(rows.reduce((sum, row) => sum + num(row.stock), 0)))
  const priced = rows.filter((row) => num(row.price) > 0)
  const primary = priced.find((row) => row.primary)
  const price = primary
    ? num(primary.price)
    : priced.reduce((max, row) => Math.max(max, num(row.price)), 0)

  return {
    ref: db.collection('products').doc(productId),
    data: {
      ...(price > 0 ? { price } : {}),
      stock,
      // Qoldiq to'ldirilgan bo'lsa ombor signali qaytadan yoqiladi
      lowStockAlerted: stock <= LOW_STOCK_AT,
      updatedAt: now,
    },
  }
}

/** Nusxadagi hamma qatorni mahsulot bo'yicha guruhlaydi. */
async function linkedRows(): Promise<Map<string, MirrorDoc[]>> {
  const db = await adminDb()
  const snap = await db.collection(MIRROR).get()
  const map = new Map<string, MirrorDoc[]>()
  for (const doc of snap.docs) {
    const data = doc.data() as MirrorDoc
    const id = text(data.productId)
    if (!id) continue
    map.set(id, [...(map.get(id) ?? []), data])
  }
  return map
}

/**
 * Ulanishni tekshiradi va admin panel uchun ma'lumotnoma qaytaradi:
 * narxlar ro'yxatlari, skladlar, Linko'da nechta mahsulot bor va
 * nechtasi MUSA bilan bog'langan.
 */
export async function linkoStatus(): Promise<Result> {
  const settings = await readLinkoSettings()
  const hasToken = Boolean(linkoToken())

  if (!settings.baseUrl || !hasToken) {
    return { connected: false, hasToken, settings, reason: hasToken ? 'baseUrl' : 'token' }
  }

  const [products, priceLists, stocks] = await Promise.all([
    linkoCount('products', settings),
    linkoList<{ id: number; name?: string }>('price_lists/', {}, settings),
    linkoList<{ id: number; name?: string }>('stocks/', {}, settings),
  ])

  const db = await adminDb()
  const mirror = await db.collection(MIRROR).get()
  const linked = mirror.docs.filter((doc) => doc.data().productId).length

  return {
    connected: true,
    hasToken,
    settings,
    products,
    priceLists: priceLists.map((p) => ({ id: p.id, name: text(p.name) || `#${p.id}` })),
    stocks: stocks.map((s) => ({ id: s.id, name: text(s.name) || `#${s.id}` })),
    mirror: { total: mirror.size, linked },
  }
}

export async function linkoSettingsSave(
  _staff: unknown,
  body: Record<string, unknown>,
): Promise<Result> {
  const baseUrl = text(body.baseUrl).replace(/\/+$/, '')
  if (baseUrl && !/^https?:\/\/[^\s/]+$/i.test(baseUrl)) {
    throw new Error('Manzil `https://nom.linko.uz` ko‘rinishida bo‘lsin')
  }

  const stockIds = Array.isArray(body.stockIds)
    ? [...new Set(body.stockIds.map((v) => Math.round(num(v))).filter((v) => v > 0))]
    : []

  const db = await adminDb()
  await db.collection('settings').doc('linko').set(
    { baseUrl, priceListId: Math.round(num(body.priceListId)), stockIds },
    { merge: true },
  )
  return { ok: true }
}

/**
 * Linko'dan mahsulot, narx va qoldiqni tortadi.
 *
 * Odatda ORTTIRMA: oxirgi sinxrondagi `tm` dan keyin o'zgarganlari
 * olinadi (Linko hujjati shuni tavsiya qiladi). `full: true` bilan
 * hammasi qaytadan o'qiladi — masalan narxlar ro'yxati almashtirilganda.
 *
 * Ikki narsa amalda shunday ekani tekshirildi (sfademo):
 *   • `last_tm` INKLYUZIV — chegaradagi yozuv keyingi safar ham keladi.
 *     Zarari yo'q: yozuv `merge` bilan ustiga yoziladi, natija o'zgarmaydi.
 *   • Narx yozuvlarida `tm` bo'sh bo'lishi mumkin. Unda kursor siljimaydi
 *     va o'sha narxlar ro'yxati har safar to'liq o'qiladi — bu ataylab:
 *     narx o'zgarishini o'tkazib yuborgandan ko'ra qayta o'qigan yaxshi.
 */
export async function linkoPull(
  _staff: unknown,
  body: Record<string, unknown> = {},
): Promise<Result> {
  const settings = await readLinkoSettings()
  const full = body.full === true
  const db = await adminDb()

  const productParams: Record<string, string | number> = {}
  if (!full && settings.lastProductTm) productParams.last_tm = settings.lastProductTm
  const products = await linkoList<LinkoProduct>('products/', productParams, settings)

  const priceParams: Record<string, string | number> = {}
  if (settings.priceListId) priceParams.price_list = settings.priceListId
  if (!full && settings.lastPriceTm) priceParams.last_tm = settings.lastPriceTm
  const prices = settings.priceListId
    ? await linkoList<LinkoPriceItem>('price_list_items/', priceParams, settings)
    : []

  const balanceParams: Record<string, string | number> = {}
  if (!full && settings.lastBalanceTm) balanceParams.last_tm = settings.lastBalanceTm
  const balances = await linkoList<LinkoBalance>('product_balances/', balanceParams, settings)

  // ── O'zgargan pozitsiyalarni bitta ro'yxatga yig'amiz ──
  const touched = new Set<number>()
  const infoById = new Map<number, LinkoProduct>()
  for (const product of products) {
    if (!product?.id) continue
    infoById.set(product.id, product)
    touched.add(product.id)
  }

  const priceById = new Map<number, number>()
  for (const item of prices) {
    if (!item?.product_id) continue
    if (settings.priceListId && item.price_list_id !== settings.priceListId) continue
    priceById.set(item.product_id, Math.round(num(item.price)))
    touched.add(item.product_id)
  }

  const balanceById = new Map<number, Record<string, number>>()
  for (const row of balances) {
    const productId = Number(row?.product?.id)
    const stockId = Number(row?.stock?.id)
    if (!Number.isFinite(productId) || !Number.isFinite(stockId)) continue
    const current = balanceById.get(productId) ?? {}
    current[String(stockId)] = num(row.balance)
    balanceById.set(productId, current)
    touched.add(productId)
  }

  const now = new Date().toISOString()

  if (!touched.size) {
    const report = 'O‘zgarish yo‘q'
    await db.collection('settings').doc('linko').set(
      { lastSyncAt: now, lastReport: report },
      { merge: true },
    )
    return { ok: true, changed: 0, products: 0, prices: 0, balances: 0, updatedProducts: 0, report }
  }

  // ── Nusxadagi eski holat: bog'lanish va boshqa skladlar qoldig'i ──
  const ids = [...touched]
  const mirrorSnaps = await db.getAll(...ids.map((id) => db.collection(MIRROR).doc(String(id))))
  const existing = new Map<number, Partial<MirrorDoc>>()
  mirrorSnaps.forEach((snap, index) => {
    if (snap.exists) existing.set(ids[index], snap.data() as Partial<MirrorDoc>)
  })

  const mirrorWrites: Write[] = []
  // Shu sinxronda tegilgan mahsulotlar — keyin ularning hammasi
  // bog'langan pozitsiyalar bo'yicha qayta hisoblanadi
  const affected = new Set<string>()

  for (const id of ids) {
    const old = existing.get(id) ?? {}
    const info = infoById.get(id)

    /*
     * Qoldiq skladlar kesimida saqlanadi. Orttirma sinxronda faqat
     * O'ZGARGAN sklad keladi, jami esa hamma sklad bo'yicha hisoblanadi —
     * shuning uchun eskisi o'chirilmaydi, ustiga yoziladi.
     */
    const stockMap = { ...(old.balances ?? {}), ...(balanceById.get(id) ?? {}) }
    const selected = settings.stockIds.length ? settings.stockIds.map(String) : Object.keys(stockMap)
    const stock = Math.max(
      0,
      Math.round(selected.reduce((sum, stockId) => sum + num(stockMap[stockId]), 0)),
    )

    const price = priceById.has(id) ? (priceById.get(id) as number) : num(old.price)
    const productId = text(old.productId) || null

    mirrorWrites.push({
      ref: db.collection(MIRROR).doc(String(id)),
      data: {
        linkoId: id,
        name: text(info?.name) || text(old.name),
        code: text(info?.code) || text(old.code),
        vendorCode: text(info?.vendor_code) || text(old.vendorCode),
        typeName: text(info?.type?.name) || text(old.typeName),
        measurement: text(info?.measurement?.name) || text(old.measurement),
        price,
        balances: stockMap,
        stock,
        productId,
        updatedAt: now,
      },
    })

    if (productId) affected.add(productId)
  }

  // Avval nusxa yangilanadi, keyin do'kon mahsulotlari — hisob yangi
  // qiymatlar bo'yicha ketishi uchun
  await commitAll(mirrorWrites)

  const grouped = await linkedRows()
  const productWrites: Write[] = []
  for (const productId of affected) {
    const write = await applyToProduct(productId, grouped.get(productId) ?? [], now)
    if (write) productWrites.push(write)
  }
  await commitAll(productWrites)

  // ── Kursorlar: keyingi safar faqat yangisi keladi ──
  const maxTm = (rows: { tm?: string | number }[], current: number) =>
    rows.reduce((max, row) => Math.max(max, tmOf(row?.tm)), full ? 0 : current)

  const report =
    `${products.length} mahsulot, ${prices.length} narx, ${balances.length} qoldiq o‘qildi; ` +
    `${productWrites.length} ta do‘kon mahsuloti yangilandi`

  await db.collection('settings').doc('linko').set(
    {
      lastProductTm: maxTm(products, settings.lastProductTm),
      lastPriceTm: maxTm(prices, settings.lastPriceTm),
      lastBalanceTm: maxTm(balances, settings.lastBalanceTm),
      lastSyncAt: now,
      lastReport: report,
    },
    { merge: true },
  )

  return {
    ok: true,
    changed: touched.size,
    products: products.length,
    prices: prices.length,
    balances: balances.length,
    updatedProducts: productWrites.length,
    report,
  }
}

/**
 * Linko pozitsiyasini do'kondagi mahsulotga bog'laydi, bog'lanishni
 * uzadi yoki undan yangi mahsulot yaratadi.
 *
 * BITTA mahsulotga ISTAGANCHA pozitsiya bog'lanadi: do'konda bir
 * mahsulot bo'lib turgan narsaning Linko'da to'rt xil ta'mi alohida
 * qator bo'lishi mumkin. Unda qoldiq hammasining yig'indisi bo'ladi,
 * narx esa «asosiy» deb belgilangan pozitsiyadan olinadi.
 *
 * `makePrimary: true` — shu pozitsiyani asosiy qiladi.
 */
export async function linkoLink(_staff: unknown, body: Record<string, unknown>): Promise<Result> {
  const linkoId = Math.round(num(body.linkoId))
  if (!linkoId) throw new Error('linkoId kerak')

  const db = await adminDb()
  const mirrorRef = db.collection(MIRROR).doc(String(linkoId))
  const mirrorSnap = await mirrorRef.get()
  if (!mirrorSnap.exists) throw new Error('Bu pozitsiya nusxada yo‘q — avval sinxronlang')
  const mirror = mirrorSnap.data() as MirrorDoc

  const now = new Date().toISOString()

  if (body.unlink === true) {
    const was = text(mirror.productId)
    await mirrorRef.set({ productId: null, primary: false, updatedAt: now }, { merge: true })

    if (was) {
      /*
       * Asosiy pozitsiya uzildi — narx manbasiz qolmasligi uchun
       * qolganlardan biri asosiy bo'ladi va mahsulot qayta hisoblanadi.
       */
      const rest = await db.collection(MIRROR).where('productId', '==', was).get()
      if (mirror.primary && rest.docs.length) {
        await rest.docs[0].ref.set({ primary: true }, { merge: true })
      }
      const grouped = await linkedRows()
      const write = await applyToProduct(was, grouped.get(was) ?? [], now)
      if (write) await commitAll([write])
    }
    return { ok: true, unlinked: true }
  }

  let productId = text(body.productId)
  const created = !productId

  if (created) {
    const category = text(body.category)
    if (!category) throw new Error('Kategoriya tanlanmagan')
    const categories = await db.collection('categories').where('name', '==', category).limit(1).get()
    if (categories.empty) throw new Error(`«${category}» kategoriyasi yo‘q`)
    if (!mirror.price) throw new Error('Narx yo‘q — avval narxlar ro‘yxatini tanlab sinxronlang')

    productId = newNumericId()
    await db.collection('products').doc(productId).set({
      id: Number(productId),
      name: text(body.name) || mirror.name,
      price: mirror.price,
      oldPrice: null,
      category,
      sectionId: null,
      // Rasm va tavsif MUSA tomonida qo'shiladi — Linko'da ular yo'q
      images: [],
      thumbs: [],
      optimized: [],
      variantSources: [],
      description: '',
      stock: mirror.stock,
      lowStockAlerted: mirror.stock <= LOW_STOCK_AT,
      popular: false,
      // Narx va qoldiq pastda hamma bog'langan pozitsiya bo'yicha
      // qayta hisoblanadi — bu faqat boshlang'ich qiymat
      rating: 5,
      reviews: 0,
      linkoId,
      createdAt: now,
      updatedAt: now,
    })
  } else {
    const product = await db.collection('products').doc(productId).get()
    if (!product.exists) throw new Error('Mahsulot topilmadi')
  }

  /*
   * Shu mahsulotga bog'langan boshqa pozitsiyalar. Birinchi bog'langani
   * o'z-o'zidan asosiy bo'ladi — aks holda narx umuman kelmasdi.
   */
  const siblings = await db.collection(MIRROR).where('productId', '==', productId).get()
  const others = siblings.docs.filter((doc) => doc.id !== String(linkoId))
  const primary = body.makePrimary === true || others.every((doc) => !doc.data().primary)

  if (primary) {
    for (const doc of others) {
      if (doc.data().primary) await doc.ref.set({ primary: false }, { merge: true })
    }
  }

  await mirrorRef.set({ productId, primary, updatedAt: now }, { merge: true })

  // Narx va qoldiq — hamma bog'langan pozitsiya bo'yicha
  const grouped = await linkedRows()
  const write = await applyToProduct(productId, grouped.get(productId) ?? [], now)
  if (write) await commitAll([write])

  return { ok: true, productId, created, primary, linkedCount: others.length + 1 }
}

/**
 * Nomi aynan mos tushadiganlarni o'zi bog'laydi.
 *
 * Bir nechta mahsulot bir xil nomga ega bo'lsa — tegilmaydi: qaysi
 * biri kerakligini admin o'zi aytsin.
 */
export async function linkoAutoLink(): Promise<Result> {
  const db = await adminDb()
  const [mirrorSnap, productSnap] = await Promise.all([
    db.collection(MIRROR).get(),
    db.collection('products').get(),
  ])

  const byName = new Map<string, string[]>()
  for (const doc of productSnap.docs) {
    const name = key(String(doc.data().name || ''))
    if (!name) continue
    byName.set(name, [...(byName.get(name) ?? []), doc.id])
  }

  const taken = new Set(mirrorSnap.docs.map((doc) => text(doc.data().productId)).filter(Boolean))

  const writes: Write[] = []
  const now = new Date().toISOString()
  let linked = 0

  for (const doc of mirrorSnap.docs) {
    const data = doc.data() as MirrorDoc
    if (data.productId) continue
    const matches = byName.get(key(String(data.name || '')))
    if (!matches || matches.length !== 1) continue
    const productId = matches[0]
    if (taken.has(productId)) continue

    taken.add(productId)
    linked++
    // Nomi aynan mos tushgan yagona pozitsiya — o'zi asosiy bo'ladi
    writes.push({ ref: doc.ref, data: { productId, primary: true, updatedAt: now } })
    writes.push({
      ref: db.collection('products').doc(productId),
      data: {
        ...(num(data.price) > 0 ? { price: num(data.price) } : {}),
        stock: num(data.stock),
        lowStockAlerted: num(data.stock) <= LOW_STOCK_AT,
        updatedAt: now,
      },
    })
  }

  await commitAll(writes)
  return { ok: true, linked }
}

/** Ulanish tekshiruvi — bitta yengil so'rov. */
export async function linkoPing(): Promise<Result> {
  const settings = await readLinkoSettings()
  const body = await linkoGet<{ count?: number }>('products_count/', {}, settings)
  return { ok: true, products: Number(body?.count) || 0 }
}
