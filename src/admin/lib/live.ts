import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './auth'
import type { Category, Order, Product, PromoCode, Section } from '../../types/domain'
import { readPromotion, type Promotion } from '../../utils/promotions'
import { EMPTY_AD, readSplashAd, type SplashAd } from '../../utils/splash-ad'
import {
  readMessage, readThread, type SupportMessage, type SupportThread,
} from '../../types/support'

/**
 * Firestore'dan jonli ma'lumot.
 *
 * Admin panel hamma narsani onSnapshot orqali oladi: buyurtma holati
 * o'zgarganda yoki yangi buyurtma tushganda ekran o'zi yangilanadi,
 * sahifani qayta yuklash shart emas.
 */

function parseTime(value: unknown): number {
  const time = Date.parse(String(value ?? ''))
  return Number.isNaN(time) ? 0 : time
}

export type AdminOrder = Order & {
  courierId?: string | null
  courierName?: string | null
  statusUpdatedAt?: string
  /** Naqd pul: kuryerda / topshirilgan / kassa qabul qilgan. */
  cashStatus?: 'held' | 'pending' | 'settled'
  /** Kuryer bosgan muammo tugmalari. */
  problems?: { code: string; at: string }[]
}

/**
 * Buyurtmalar. Kuryerga faqat o'ziga biriktirilganlari ko'rinadi —
 * bu Firestore Rules bilan ham takrorlanadi, bu yerdagi filtr esa
 * keraksiz ma'lumotni umuman yuklamaslik uchun.
 */
export function useOrders(courierId?: string) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ref = collection(db, 'orders')
    const q = courierId ? query(ref, where('courierId', '==', courierId)) : ref

    return onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            ...data,
            id: doc.id,
            orderNumber: data.orderNumber || `#${doc.id.slice(0, 6)}`,
            createdAt: data.createdAt || '',
          } as AdminOrder
        })
        rows.sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt))
        setOrders(rows)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('[admin] buyurtmalarni o‘qib bo‘lmadi:', err)
        setError('Buyurtmalarni yuklab bo‘lmadi. Firestore Rules tekshiring.')
        setLoading(false)
      },
    )
  }, [courierId])

  return { orders, loading, error }
}

/** Firestore hujjat identifikatori — tahrir va o'chirish shu bo'yicha. */
export type ProductRow = Product & { docId: string }

export function useProducts() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'products'),
        (snapshot) => {
          const rows = snapshot.docs.map((doc) => {
              const data = doc.data()
              return {
                ...data,
                id: typeof data.id === 'number' ? data.id : Number(data.id) || 0,
                docId: doc.id,
              } as ProductRow
          })
          // Admin belgilagan tartib (src/admin/lib/sort.ts)
          rows.sort(
            (a, b) =>
              (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
          )
          setProducts(rows)
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [],
  )

  return { products, loading }
}

export type CustomerRow = {
  id: string
  first_name?: string
  last_name?: string
  username?: string
  phone?: string
  lastActive?: string
}

export function useCustomers() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'users'),
        (snapshot) => {
          const rows = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as CustomerRow)
          rows.sort((a, b) => parseTime(b.lastActive) - parseTime(a.lastActive))
          setCustomers(rows)
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [],
  )

  return { customers, loading }
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'categories'),
        (snapshot) => {
          const rows = snapshot.docs.map(
            (d) => ({ ...d.data(), id: d.id }) as unknown as Category & { id: string },
          )
          // Admin belgilagan tartib; belgilanmaganlari nom bo'yicha
          rows.sort(
            (a, b) =>
              (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
              String(a.name).localeCompare(String(b.name)),
          )
          setCategories(rows as unknown as Category[])
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [],
  )

  return { categories, loading }
}

/** Bo'limlar — kategoriya ichidagi guruhlar, tartibi bilan. */
export function useSections() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'sections'),
        (snapshot) => {
          const rows = snapshot.docs.map((d) => {
            const data = d.data()
            return {
              id: d.id,
              name: String(data.name || ''),
              nameRu: String(data.nameRu || ''),
              category: String(data.category || ''),
              order: typeof data.order === 'number' ? data.order : undefined,
            }
          })
          rows.sort(
            (a, b) =>
              (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
              a.name.localeCompare(b.name),
          )
          setSections(rows)
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [],
  )

  return { sections, loading }
}

/** Vaqtli aksiyalar — yangilari tepada. */
export function usePromotions() {
  const [promotions, setPromotions] = useState<(Promotion & { createdAt?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'promotions'),
        (snapshot) => {
          const rows = snapshot.docs.map((d) => ({ ...readPromotion(d.id, d.data()), createdAt: String(d.data().createdAt || '') }))
          rows.sort((a, b) => b.startsAt.localeCompare(a.startsAt))
          setPromotions(rows)
          setLoading(false)
          setError(null)
        },
        (err) => {
          // Ko'pincha sabab — Firestore qoidalarida `promotions` hali yo'q.
          // Jim qolsak admin «aksiya saqlanmadi» deb o'ylaydi.
          console.error('[admin] aksiyalarni o‘qib bo‘lmadi:', err)
          setError('code' in (err as object) && (err as { code?: string }).code === 'permission-denied' ? 'rules' : 'other')
          setLoading(false)
        },
      ),
    [],
  )

  return { promotions, loading, error }
}

/** Ochilish reklamasi (`ads/splash`). Hujjat hali yo'q bo'lsa — bo'sh, o'chirilgan reklama. */
export function useSplashAd() {
  const [ad, setAd] = useState<SplashAd>(EMPTY_AD)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'rules' | 'other' | null>(null)

  useEffect(
    () =>
      onSnapshot(
        doc(db, 'ads', 'splash'),
        (snapshot) => {
          setAd(snapshot.exists() ? readSplashAd(snapshot.data()) : EMPTY_AD)
          setLoading(false)
          setError(null)
        },
        (err) => {
          console.error('[admin] reklamani o‘qib bo‘lmadi:', err)
          setError((err as { code?: string }).code === 'permission-denied' ? 'rules' : 'other')
          setLoading(false)
        },
      ),
    [],
  )

  return { ad, loading, error }
}

export type PromoRow = PromoCode & { id: string; maxUses?: number; expiresAt?: string | null }

export function usePromocodes() {
  const [promocodes, setPromocodes] = useState<PromoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'promocodes'),
        (snapshot) => {
          setPromocodes(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as PromoRow))
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [],
  )

  return { promocodes, loading }
}

export type StaffRow = {
  uid: string
  email: string
  name: string
  role: 'owner' | 'admin' | 'courier'
  telegramId?: number | null
  phone?: string | null
  active: boolean
  /** Panelga kira oladimi. false — faqat Telegram orqali ishlaydigan kuryer. */
  webAccess?: boolean
  /** Ega/admin kuryer sifatida ham ishlaydi. */
  canDeliver?: boolean
  /** Smena: «Ishdaman» — yangi buyurtma xabarlari keladi. */
  onShift?: boolean
  /** Mijozlar bahosi yig'indisi va soni. */
  ratingSum?: number
  ratingCount?: number
}

/**
 * Xodimlar ro'yxati — faqat egaga ko'rinadi (Firestore Rules).
 * Boshqa rollarda so'rov rad etiladi va bo'sh ro'yxat qaytadi.
 */
export function useStaff(enabled: boolean) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ruxsat bo'lmasa obuna umuman ochilmaydi — Firestore so'rovni
    // rad etardi va konsolda keraksiz xato chiqardi.
    if (!enabled) return
    return onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => ({ ...d.data(), uid: d.id }) as StaffRow)
        const rank = { owner: 0, admin: 1, courier: 2 }
        rows.sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name))
        setStaff(rows)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [enabled])

  return { staff: enabled ? staff : [], loading: enabled ? loading : false }
}

export type CourierSettings = {
  /** Buyurtma qayerga tushadi: kuryerlarning shaxsiy chatiga yoki guruhga. */
  channel: 'couriers' | 'group'
  groupChatId: string | null
  notifyAdmins: boolean
  /** Eski sozlamalar bilan mos qolish uchun. */
  toGroup?: boolean
}

export type LinkoSettings = {
  baseUrl: string
  priceListId: number
  stockIds: number[]
  /** Buyurtmalar Linko'ga yuborilsinmi va kim nomidan. */
  sendOrders: boolean
  agentId: number
  deliveryManId: number
  orderStockId: number
  currencyId: number
  lastSyncAt: string | null
  lastReport: string | null
}

export type AllSettings = {
  payment: { cardNumber: string; cardOwner: string }
  delivery: { fee: number; freeFrom: number; minOrder: number }
  courier: CourierSettings
  linko: LinkoSettings
}

const SETTINGS_FALLBACK: AllSettings = {
  payment: { cardNumber: '', cardOwner: '' },
  delivery: { fee: 0, freeFrom: 0, minOrder: 0 },
  courier: { channel: 'couriers', groupChatId: null, notifyAdmins: true },
  linko: {
    baseUrl: '', priceListId: 0, stockIds: [],
    sendOrders: false, agentId: 0, deliveryManId: 0, orderStockId: 0, currencyId: 1,
    lastSyncAt: null, lastReport: null,
  },
}

/** Linko katalogining nusxasi — `linko_products` (server yozadi). */
export type LinkoRow = {
  linkoId: number
  name: string
  code?: string
  vendorCode?: string
  typeName?: string
  measurement?: string
  price: number
  stock: number
  /** Bog'langan do'kon mahsulotlari — bittadan ko'p bo'lishi mumkin. */
  productIds: string[]
  /** Narx shu pozitsiyadan olinadimi (bir mahsulotga bir nechtasi bog'lanadi). */
  primary?: boolean
  updatedAt?: string
}

export function useLinkoProducts() {
  const [rows, setRows] = useState<LinkoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'linko_products'),
        (snapshot) => {
          const list = snapshot.docs.map((d) => {
            const data = d.data()
            return {
              linkoId: Number(data.linkoId) || Number(d.id) || 0,
              name: String(data.name || ''),
              code: String(data.code || ''),
              vendorCode: String(data.vendorCode || ''),
              typeName: String(data.typeName || ''),
              measurement: String(data.measurement || ''),
              price: Number(data.price) || 0,
              stock: Number(data.stock) || 0,
              // Eski yozuvlarda bitta `productId` edi
              productIds: Array.isArray(data.productIds)
                ? data.productIds.map(String)
                : data.productId
                  ? [String(data.productId)]
                  : [],
              primary: data.primary === true,
              updatedAt: String(data.updatedAt || ''),
            }
          })
          list.sort((a, b) => a.name.localeCompare(b.name))
          setRows(list)
          setLoading(false)
        },
        // Ruxsat yo'q yoki hali sinxronlanmagan — sahifa bo'sh ro'yxat bilan ishlaydi
        () => setLoading(false),
      ),
    [],
  )

  return { rows, loading }
}


export function useSettings() {
  const [settings, setSettings] = useState<AllSettings>(SETTINGS_FALLBACK)

  useEffect(() => {
    const sections = ['payment', 'delivery', 'courier', 'linko'] as const
    const unsubs = sections.map((section) =>
      onSnapshot(
        doc(db, 'settings', section),
        (snap) => {
          if (!snap.exists()) return
          setSettings((current) => ({
            ...current,
            [section]: { ...current[section], ...snap.data() },
          }))
        },
        () => {},
      ),
    )
    return () => unsubs.forEach((unsub) => unsub())
  }, [])

  return settings
}

/**
 * Kuryerlarning qo'llab-quvvatlash murojaatlari — jonli.
 * Oxirgi yozilgani birinchi. `enabled` — faqat adminga (Rules ham shunday).
 */
export function useSupportThreads(enabled: boolean) {
  const [threads, setThreads] = useState<SupportThread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      collection(db, 'support_threads'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => readThread(d.id, d.data()))
        list.sort((a, b) => b.lastAt.localeCompare(a.lastAt))
        setThreads(list)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [enabled])

  return { threads: enabled ? threads : [], loading: enabled ? loading : false }
}

/** Bitta murojaatning xabarlari — jonli, vaqt bo'yicha. */
export function useSupportMessages(threadId: string | null) {
  const [messages, setMessages] = useState<SupportMessage[]>([])

  useEffect(() => {
    if (!threadId) return
    return onSnapshot(
      query(collection(db, 'support_threads', threadId, 'messages'), orderBy('at')),
      (snapshot) => setMessages(snapshot.docs.map((d) => readMessage(d.id, d.data()))),
    )
  }, [threadId])

  return threadId ? messages : []
}

/** Kuryerlar kassasi — naqd pulni topshirishlar (api/_lib/actions/cash.ts). */
export type CashHandoverRow = {
  id: string
  courierUid: string
  courierName: string
  orderIds: string[]
  orderNumbers: string[]
  amount: number
  status: 'pending' | 'confirmed' | 'rejected'
  createdAt: string
  decidedAt: string | null
  decidedBy: string | null
  note: string | null
}

/** `enabled` — faqat adminga: Rules kassani boshqa rolga bermaydi. */
export function useCashHandovers(enabled = true) {
  const [handovers, setHandovers] = useState<CashHandoverRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      collection(db, 'cash_handovers'),
      (snapshot) => {
        const rows = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            courierUid: String(data.courierUid || ''),
            courierName: String(data.courierName || 'Kuryer'),
            orderIds: Array.isArray(data.orderIds) ? data.orderIds.map(String) : [],
            orderNumbers: Array.isArray(data.orderNumbers) ? data.orderNumbers.map(String) : [],
            amount: Number(data.amount) || 0,
            status: data.status === 'confirmed' || data.status === 'rejected' ? data.status : 'pending',
            createdAt: String(data.createdAt || ''),
            decidedAt: data.decidedAt ? String(data.decidedAt) : null,
            decidedBy: data.decidedBy ? String(data.decidedBy) : null,
            note: data.note ? String(data.note) : null,
          } as CashHandoverRow
        })
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setHandovers(rows)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [enabled])

  return { handovers: enabled ? handovers : [], loading: enabled ? loading : false }
}

/** Kuryerlarning oxirgi joylashuvi — admin xaritasi (api/_lib/actions/location.ts). */
export type CourierLocationRow = {
  uid: string
  name: string
  lat: number
  lng: number
  heading: number | null
  accuracy: number | null
  /** `live` — Telegram jonli ulashishi (ilova yopiq bo'lsa ham), `app` — ochiq ilova. */
  source: 'live' | 'app'
  at: string
  liveUntil: string | null
}

export function useCourierLocations(enabled = true) {
  const [rows, setRows] = useState<CourierLocationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enabled) return
    return onSnapshot(
      collection(db, 'courier_locations'),
      (snapshot) => {
        setRows(
          snapshot.docs
            .map((d) => {
              const data = d.data()
              return {
                uid: d.id,
                name: String(data.name || 'Kuryer'),
                lat: Number(data.lat),
                lng: Number(data.lng),
                heading: Number.isFinite(Number(data.heading)) && data.heading !== null ? Number(data.heading) : null,
                accuracy: Number.isFinite(Number(data.accuracy)) && data.accuracy !== null ? Number(data.accuracy) : null,
                source: data.source === 'live' ? 'live' : 'app',
                at: String(data.at || ''),
                liveUntil: data.liveUntil ? String(data.liveUntil) : null,
              } as CourierLocationRow
            })
            .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [enabled])

  return { rows: enabled ? rows : [], loading: enabled ? loading : false }
}
