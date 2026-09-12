export type AppPage =
  | 'home' | 'catalog' | 'favorites' | 'orders' | 'profile'
  | 'detail' | 'checkout' | 'addresses' | 'profile_edit'
  | 'reviews' | 'notifications' | 'language' | 'support'

export type Product = {
  id: number
  name: string
  price: number
  oldPrice?: number
  category: string
  color?: string
  colors?: string[]
  rating: number
  reviews: number
  images: string[]
  description?: string
  discount?: string
  sizes?: string[]
  /** Ombordagi qoldiq. undefined — hisob yuritilmaydi (eski mahsulotlar). */
  stock?: number
  /** Ro'yxatdagi tartib — admin panelda belgilanadi. Kichik raqam oldinda. */
  order?: number
}

export type Category = {
  id: number
  name: string
  icon: string
  image?: string
  /** Ro'yxatdagi tartib — admin panelda belgilanadi. */
  order?: number
}

export type OrderStatus = 'Yangi' | 'Qabul qilindi' | 'Yetkazilmoqda' | 'Yetkazildi' | 'Bekor qilingan' | 'Rad etildi'

export type Order = {
  /** Firestore hujjat identifikatori — barcha texnik havolalar shu bo'yicha. */
  id: string
  /** Foydalanuvchiga ko'rsatiladigan ketma-ket raqam, masalan "#1042". */
  orderNumber: string
  /** ISO 8601. Saralash va sana ko'rsatish shu maydondan. */
  createdAt: string
  products: { product: Product; quantity: number; size?: string; color?: string; cartKey?: string }[]
  /** Mahsulotlar jami (chegirmasiz, yetkazishsiz). */
  subtotal?: number
  discount?: number
  discountPercent?: number
  promoCode?: string | null
  deliveryFee?: number
  /** Yakuniy summa: subtotal - discount + deliveryFee. */
  total: number
  status: OrderStatus
  paymentMethod?: 'Naqd' | 'Karta'
  paymentStatus?: 'Tolangan' | 'Kutilmoqda' | 'Rad etildi'
  customer: OrderForm
  userId?: number
  username?: string
  /** Bot bu buyurtmani adminga yuborganmi (F-21). */
  notified?: boolean
  /** Eski yozuvlarda formatlangan sana matni bo'lishi mumkin. */
  date?: string
}

/** Firestore'ga yozishdan oldingi buyurtma — id va raqam server tomonda beriladi. */
export type NewOrder = Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'notified'>

export type PaymentSettings = {
  cardNumber: string
  cardOwner: string
}

export type DeliverySettings = {
  /** Yetkazib berish narxi, so'mda. */
  fee: number
  /** Shu summadan yuqori buyurtmalar bepul yetkaziladi. 0 — bepul yetkazish yo'q. */
  freeFrom: number
}

export type OrderForm = {
  name: string
  phone: string
  address: string
  location: { lat: number; lng: number } | null
  comment: string
  paymentMethod: 'Naqd' | 'Karta'
  promoCode?: string
  /**
   * Buyurtmani boshqa odam oladigan bo'lsa — uning ismi va raqami.
   *
   * Ko'pincha buyurtmani uydagilar yoki qo'shni qabul qiladi. Kuryer
   * kimga topshirishini va kim bilan bog'lanishini bilishi kerak.
   */
  recipientName?: string
  recipientPhone?: string
}

export type ProductActions = {
  onOpen: (product: Product) => void
  onAddToCart: (product: Product, size?: string, color?: string) => void
  likedIds: number[]
  onToggleLike: (id: number) => void
}

export type CartItem = {
  productId: number
  quantity: number
}

export type Address = {
  id: string
  name: string
  address: string
  location: { lat: number; lng: number }
}

export type UserProfile = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  phone?: string
  addresses: Address[]
  /** Tanlangan til — qurilmalar orasida sinxron bo'lishi uchun. */
  language?: 'uz' | 'ru'
}

export type Review = {
  id: string
  productId: number
  userId: number
  userName: string
  rating: number // 1 to 5
  comment: string
  date: string
}

export type Notification = {
  id: string
  userId: number
  title: string
  body: string
  date: string
  read: boolean
  type: 'order' | 'system' | 'promo'
}

export type PromoCode = {
  id: string
  code: string
  discountPercent: number
  active: boolean
  usageCount: number
}
