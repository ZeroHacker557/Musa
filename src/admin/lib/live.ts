import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from './auth'
import type { Category, Order, Product, PromoCode } from '../../types/domain'

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
          setProducts(
            snapshot.docs.map((doc) => {
              const data = doc.data()
              return {
                ...data,
                id: typeof data.id === 'number' ? data.id : Number(data.id) || 0,
                docId: doc.id,
              } as ProductRow
            }),
          )
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
          rows.sort((a, b) => String(a.name).localeCompare(String(b.name)))
          setCategories(rows as unknown as Category[])
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [],
  )

  return { categories, loading }
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

export type AllSettings = {
  payment: { cardNumber: string; cardOwner: string }
  delivery: { fee: number; freeFrom: number }
  courier: CourierSettings
}

const SETTINGS_FALLBACK: AllSettings = {
  payment: { cardNumber: '', cardOwner: '' },
  delivery: { fee: 0, freeFrom: 0 },
  courier: { channel: 'couriers', groupChatId: null, notifyAdmins: true },
}

export function useSettings() {
  const [settings, setSettings] = useState<AllSettings>(SETTINGS_FALLBACK)

  useEffect(() => {
    const sections = ['payment', 'delivery', 'courier'] as const
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
