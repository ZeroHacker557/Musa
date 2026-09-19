import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { withMainLines } from '../config/categories'
import { subscribeToCategories, subscribeToProducts, subscribeToPromotions, subscribeToSections, subscribeToUserOrders, subscribeToUserProfile, subscribeToUserNotifications, markNotificationsAsRead, markOrderNotificationsAsRead } from '../lib/firebase'
import { ensureSignedIn, onAuthChanged, auth } from '../lib/auth'
import { apiPost, ApiError } from '../lib/api'
import { track } from '../lib/track'
import { searchProducts } from '../utils/search'
import { countUnseenOrders } from '../utils/notifications'
import { bestPromotion, isRunning, promoPrice, type Promotion } from '../utils/promotions'
import { useI18n } from '../i18n'
import type { AppPage, Category, Order, OrderForm, Product, Section, UserProfile, Notification } from '../types/domain'
import { hapticError, hapticFeedback, hapticSuccess, initTelegram } from '../utils/telegram'
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from '../utils/theme'
import { useT } from '../i18n'

/** Pastki menyudagi asosiy sahifalar — ularga o'tganda tarix tozalanadi. */
const ROOT_PAGES: AppPage[] = ['home', 'catalog', 'favorites', 'orders', 'profile']

const LIKES_KEY = 'musaShopLikes'
const CART_KEY = 'musaShopCart'
/** «Manzil qo'shasizmi?» taklifi ko'rsatilganmi (bir marta so'raladi). */
const ADDRESS_ASK_KEY = 'musaAddressAsked'
/** Ilova tayyor bo'lgach taklifgacha kutiladigan vaqt. */
const ADDRESS_ASK_DELAY = 2000

type CartItems = Record<string, { quantity: number; size?: string; color?: string }>

function loadLikes(): number[] {
  try {
    return JSON.parse(localStorage.getItem(LIKES_KEY) || '[]')
  } catch { return [] }
}

function saveLikes(ids: number[]) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(ids))
}

/** Savat saqlanadi: Telegram mini app'ni yopib-ochganda yo'qolmasligi uchun (F-14). */
/** Takroriy buyurtmani to'sish uchun noyob kalit. */
function newOrderKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function loadCart(): CartItems {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return raw as CartItems
  } catch { return {} }
}

/**
 * Havola bilan ochiladigan boshlang'ich sahifa: `?page=orders`.
 *
 * Botdagi «Buyurtmalarim» tugmasi mini appni shu ko'rinishda ochadi —
 * buyurtmalar botda emas, ilovada ko'riladi.
 *
 * Query ishlatiladi, hash emas: Telegram mini appni ochganda
 * fragmentga o'z parametrlarini (`tgWebAppData` va boshqalar) qo'shadi,
 * query esa o'zgarmay qoladi.
 */
function initialPage(): AppPage {
  try {
    const requested = new URLSearchParams(window.location.search).get('page')
    const allowed: AppPage[] = ['home', 'catalog', 'favorites', 'orders', 'profile']
    if (requested && (allowed as string[]).includes(requested)) return requested as AppPage
  } catch {
    // URL o'qilmasa — oddiy bosh sahifa
  }
  return 'home'
}

export function useShopStore() {
  const t = useT()
  const { lang } = useI18n()
  const [page, setPage] = useState<AppPage>(initialPage)
  // Telegram BackButton shu tarix bo'yicha ishlaydi (D-03)
  const [history, setHistory] = useState<AppPage[]>([])
  // Bosh sahifadan tanlangan kategoriya katalogga uzatiladi (F-16)
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null)
  /** Katalog ochilganda shu bo'limga surib boriladi (reklama tugmasidan). */
  const [catalogSection, setCatalogSection] = useState<string | null>(null)
  /** Firestore'dagi xom mahsulotlar. Ekranda — pastdagi `products` (til va aksiya qo'llangan). */
  const [rawProducts, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  // Aksiya o'zi boshlanib-tugashi uchun vaqt har 30 soniyada yangilanadi
  const [clock, setClock] = useState(() => Date.now())
  const [categories, setCategories] = useState<Category[]>(() => withMainLines([]))
  const [sections, setSections] = useState<Section[]>([])

  /*
   * Ekrandagi mahsulotlar:
   *   - nomi va tavsifi tanlangan tilda (tarjima bo'lmasa — o'zbekcha);
   *   - vaqtli aksiya bo'lsa narxi chegirmali, eski narxi chizilgan.
   * Narxni baribir server qayta hisoblaydi (api/_lib/promotions.ts) —
   * bu yerda faqat mijozga to'g'ri ko'rsatish uchun.
   */
  const products = useMemo(() => rawProducts.map((p) => {
    const localized = lang === 'ru'
      ? { name: p.nameRu || p.name, description: p.descriptionRu || p.description }
      : {}
    const promo = bestPromotion(
      promotions,
      { id: String(p.id), category: p.category, sectionId: p.sectionId },
      clock,
    )
    if (!promo) return { ...p, ...localized, promotion: null }
    return {
      ...p,
      ...localized,
      price: promoPrice(p.price, promo.percent),
      oldPrice: p.price,
      discount: `-${promo.percent}%`,
      promotion: { id: promo.id, title: promo.title, percent: promo.percent, endsAt: promo.endsAt },
    }
  }), [rawProducts, promotions, clock, lang])

  /** Hozir ishlayotgan aksiyalar — bosh sahifadagi banner uchun. */
  const runningPromotions = useMemo(
    () => promotions.filter((promo) => isRunning(promo, clock)).sort((a, b) => b.percent - a.percent),
    [promotions, clock],
  )
  const [loading, setLoading] = useState(true)
  const [likedIds, setLikedIds] = useState<number[]>(loadLikes)
  const [cartItems, setCartItems] = useState<CartItems>(loadCart)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [isCartOpen, setCartOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  /**
   * Savatga qo'shilgandan keyingi so'rov: «Rasmiylashtirasizmi?».
   *
   * Oddiy bildirishnomadan ajratilgan — chunki bu javob kutadi va
   * o'zi yo'qolib ketmasligi kerak (uzoqroq turadi).
   */
  const [cartPrompt, setCartPrompt] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const [myOrders, setMyOrders] = useState<Order[]>([])
  /**
   * Buyurtmalarning BIRINCHI javobi keldimi.
   *
   * `authReady` yetarli emas: kirish tugagach sahifa ochiladi, buyurtmalar
   * esa Firestore'dan bir lahzadan keyin keladi. Shu oraliqda mijoz
   * «0 ta buyurtma» va «buyurtma yo'q» ni ko'rib qolardi. Bu bayroq
   * kelguncha skelet ko'rsatiladi.
   */
  const [ordersReady, setOrdersReady] = useState(false)
  const [checkoutDone, setCheckoutDone] = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme)
  // Bitta rasmiylashtirish uchun bitta kalit. Xato bo'lsa saqlanadi —
  // qayta urinishda server yangi buyurtma yaratmaydi.
  const orderKeyRef = useRef<string | null>(null)
  const [isAuthenticated, setAuthenticated] = useState(false)
  const [orderForm, setOrderForm] = useState<OrderForm>({
    name: '', phone: '', address: '', location: null, comment: '', paymentMethod: 'Naqd',
    recipientName: '', recipientPhone: '',
  })
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  /**
   * Profilning BIRINCHI javobi keldimi.
   *
   * «Manzil qo'shasizmi?» taklifi shu bayroqqa bog'liq: profil
   * o'qilmasidan ko'rsatilsa, manzili bor mijozga ham chiqib qolardi.
   */
  const [profileReady, setProfileReady] = useState(false)
  /** Taklif uchun 2 soniyalik kutish tugadimi. */
  const [addressAskDue, setAddressAskDue] = useState(false)
  const [addressAsked, setAddressAsked] = useState(() => {
    try { return localStorage.getItem(ADDRESS_ASK_KEY) === '1' } catch { return true }
  })
  /**
   * Manzil sahifasi qaysi ko'rinishda ochilsin: taklifdagi «shu yer» yoki
   * «boshqa joy» tanlovi shu yerda saqlanadi.
   */
  const [addressIntent, setAddressIntent] = useState<'here' | 'other' | null>(null)
  /** Manzillar sahifasi shu manzilni darhol tahrirga ochadi (rasmiylashtirishdan). */
  const [editAddressId, setEditAddressId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)

  // «Buyurtmalar» nishoni — holati o'zgargan, hali ko'rilmagan buyurtmalar
  const unseenOrdersCount = useMemo(() => countUnseenOrders(notifications), [notifications])

  // Ochiq ma'lumot: katalog. Auth kutilmaydi — Rules'da o'qish ochiq.
  useEffect(() => {
    initTelegram()

    const unsubProds = subscribeToProducts(
      (fbProducts) => {
        setProducts(fbProducts)
        setLoading(false)
      },
      () => setLoading(false),
    )

    const unsubCats = subscribeToCategories(
      // Uchta asosiy yo'nalish doim ro'yxat boshida turadi — katalog
      // bo'sh bo'lganda ham menyu bo'sh qolmasin (src/config/categories.ts).
      (fbCats) => setCategories(withMainLines(fbCats)),
      () => {},
    )

    const unsubSections = subscribeToSections(setSections)
    const unsubPromotions = subscribeToPromotions(setPromotions)
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)

    return () => {
      unsubProds()
      unsubCats()
      unsubSections()
      unsubPromotions()
      window.clearInterval(timer)
    }
  }, [])

  // Shaxsiy ma'lumot: faqat Telegram imzosi tekshirilgandan keyin (F-02).
  // Tizimga kirmagan holatda Rules bu kolleksiyalarni bermaydi, shuning
  // uchun umuman obuna bo'lmaymiz.
  useEffect(() => {
    ensureSignedIn()

    let unsubOrders: (() => void) | undefined
    let unsubProfile: (() => void) | undefined
    let unsubNotifications: (() => void) | undefined

    const stopAll = () => {
      unsubOrders?.()
      unsubProfile?.()
      unsubNotifications?.()
      unsubOrders = undefined
      unsubProfile = undefined
      unsubNotifications = undefined
    }

    const unsubAuth = onAuthChanged((user) => {
      stopAll()

      if (!user) {
        setAuthReady(true)
        setAuthenticated(false)
        setProfileReady(false)
        setUserProfile(null)
        setMyOrders([])
        setOrdersReady(true)
        setNotifications([])
        setUnreadNotificationsCount(0)
        return
      }

      const userId = Number(user.uid)
      setAuthReady(true)
      setAuthenticated(true)

      setOrdersReady(false)
      unsubOrders = subscribeToUserOrders(userId, (list) => {
        setMyOrders(list)
        setOrdersReady(true)
      })
      unsubProfile = subscribeToUserProfile(userId, (profile) => {
        if (profile) setUserProfile(profile as UserProfile)
        setProfileReady(true)
      })
      unsubNotifications = subscribeToUserNotifications(userId, (notifs) => {
        setNotifications(notifs)
        setUnreadNotificationsCount(notifs.filter((n: Notification) => !n.read).length)
      })
    })

    return () => {
      unsubAuth()
      stopAll()
    }
  }, [])

  // «Buyurtmalar» ochiq — yangilanishlar ko'rildi. Mijoz shu bo'limda turganda
  // kelgan yangi holat ham darhol ko'rilgan hisoblanadi: nishon chiqib o'tirmaydi.
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (page === 'orders' && unseenOrdersCount > 0 && uid) void markOrderNotificationsAsRead(Number(uid))
  }, [page, unseenOrdersCount])

  // Savat har o'zgarganda saqlanadi (F-14)
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cartItems))
    } catch (error) {
      console.warn("[Savat] saqlab bo'lmadi:", error)
    }
  }, [cartItems])

  const cartCount = Object.values(cartItems).reduce((total, item) => total + item.quantity, 0)

  const cartTotal = useMemo(() => {
    return Object.entries(cartItems).reduce((sum, [key, item]) => {
      const pId = Number(key.split('_')[0])
      const p = products.find((pr) => String(pr.id) === String(pId))
      return sum + (p ? p.price * item.quantity : 0)
    }, 0)
  }, [cartItems, products])

  const cartProducts = useMemo(() => {
    return Object.entries(cartItems)
      .map(([key, item]) => {
        const pId = Number(key.split('_')[0])
        const p = products.find((pr) => String(pr.id) === String(pId))
        return p ? { product: p, quantity: item.quantity, size: item.size, color: item.color, cartKey: key } : null
      })
      .filter(Boolean) as { product: Product; quantity: number; size?: string; color?: string; cartKey: string }[]
  }, [cartItems, products])

  const searchResults = useMemo(
    () => searchProducts(products, query),
    [query, products],
  )

  /*
   * Yangi mijoz uchun «Manzilingiz shu yermi?» taklifi.
   *
   * Ilova ochilishi bilan emas: mijoz avval do'konni ko'rib ulgursin,
   * shundan keyin — 2 soniyadan so'ng — xotirjam taklif chiqadi.
   * Bir marta: rad etilsa yoki manzil qo'shilsa qaytib bezovta qilmaydi.
   */
  useEffect(() => {
    if (addressAsked || !authReady || !isAuthenticated || !profileReady || loading) return
    const timer = window.setTimeout(() => setAddressAskDue(true), ADDRESS_ASK_DELAY)
    return () => window.clearTimeout(timer)
  }, [addressAsked, authReady, isAuthenticated, profileReady, loading])

  const dismissAddressPrompt = useCallback(() => {
    setAddressAsked(true)
    setAddressAskDue(false)
    try { localStorage.setItem(ADDRESS_ASK_KEY, '1') } catch { /* xotira yopiq */ }
  }, [])

  /*
   * ── Sahifa qayerdan boshlanadi ──
   *
   * Brauzer sahifa almashganda surilish joyini SAQLAB qoladi. Shuning uchun
   * katalogni pastga surib mahsulot ochilganda, mahsulot sahifasi ham o'sha
   * balandlikdan ochilardi: rasm tepada qolib, mijoz uni ko'rish uchun
   * yuqoriga surishga majbur bo'lardi.
   *
   * Endi yangi sahifa doim tepadan boshlanadi, «orqaga» bilan qaytilganda
   * esa ro'yxat mijoz qolgan joyidan ochiladi. `behavior: 'instant'` —
   * silliq surilish yarim yo'lda uzilib qolardi (sahifa allaqachon
   * almashgan bo'lardi), bu yerda esa sakrash ko'rinmaydi.
   */
  const scrollMemory = useRef<Record<string, number>>({})
  const restoreScroll = useRef<number | null>(null)

  const rememberScroll = useCallback((from: AppPage) => {
    scrollMemory.current[from] = window.scrollY
  }, [])

  useLayoutEffect(() => {
    const target = restoreScroll.current ?? 0
    restoreScroll.current = null
    // Yangi sahifa chizilib bo'lgach — aks holda sahifa hali past bo'ladi
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior })
    })
    return () => cancelAnimationFrame(frame)
  }, [page, selectedProduct?.id])

  const navigate = useCallback((nextPage: AppPage) => {
    const uid = auth.currentUser?.uid
    if (nextPage === 'notifications' && uid) {
      markNotificationsAsRead(Number(uid))
    }

    setPage((current) => {
      if (current === nextPage) return current
      // Asosiy bo'limga o'tilsa tarix tozalanadi, ichki sahifada esa
      // qayerdan kelganimiz eslab qolinadi.
      setHistory((h) =>
        ROOT_PAGES.includes(nextPage) ? [] : [...h.slice(-19), current],
      )
      return nextPage
    })

    setCartOpen(false)
    setSearchOpen(false)
    // Menyudan kirilgan katalog reklamadagi bo'limga qayta surilmasin
    // («orqaga» bilan qaytilganda esa bo'lim eslab qolinadi — goBack tegmaydi)
    setCatalogSection(null)
    // Manzil sahifasiga odatdagicha kirilsa ro'yxat ochiladi; taklifdan
    // kelingan tanlov `openAddresses` ichida shundan keyin qo'yiladi
    setAddressIntent(null)
    setEditAddressId(null)
    rememberScroll(page)
  }, [page, rememberScroll])

  /**
   * Manzil sahifasini kerakli ko'rinishda ochadi.
   *
   * `intent` — bosh sahifadagi takliftan; `addressId` berilsa o'sha manzil
   * darhol TAHRIR holatida ochiladi (rasmiylashtirishdagi manzil bosilganda).
   */
  const openAddresses = useCallback(
    (intent: 'here' | 'other' | null = null, addressId: string | null = null) => {
      navigate('addresses')
      // navigate tanlovni tozalaydi — shuning uchun keyin qo'yiladi
      setAddressIntent(intent)
      setEditAddressId(addressId)
    },
    [navigate],
  )

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    storeTheme(mode)
    applyTheme(mode)
    hapticFeedback('light')
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
      storeTheme(next)
      applyTheme(next)
      return next
    })
    hapticFeedback('light')
  }, [])

  /**
   * Katalogni kategoriya bo'yicha ochadi. Bo'sh kategoriya — «Barchasi».
   * `sectionId` berilsa, katalog o'sha bo'limga surib boriladi.
   */
  const openCategory = useCallback((category: string, sectionId: string | null = null) => {
    setCatalogCategory(category)
    setCatalogSection(sectionId)
    setPage((current) => {
      setHistory(() => (current === 'catalog' ? [] : []))
      return 'catalog'
    })
    setCartOpen(false)
    setSearchOpen(false)
    rememberScroll(page)
    hapticFeedback('light')
  }, [page, rememberScroll])

  /**
   * Orqaga: avval ochiq oyna yopiladi, keyin sahifa tarixi.
   *
   * Ildiz sahifalarda (katalog, sevimlilar, buyurtmalar) tarix ataylab
   * tozalanadi — aks holda pastdagi menyudan yurganda tarix cheksiz
   * o'sib ketardi. Lekin tarix bo'sh bo'lgani orqaga tugmasi ishlamasligi
   * degani emas: bunday holatda bosh sahifaga qaytamiz.
   */
  const goBack = useCallback(() => {
    if (isSearchOpen) {
      setSearchOpen(false)
      return
    }
    if (isCartOpen) {
      setCartOpen(false)
      return
    }
    scrollMemory.current[page] = window.scrollY
    setHistory((h) => {
      // Qaytilgan sahifa mijoz qolgan joyidan ochiladi
      const target = h.length === 0 ? 'home' : h[h.length - 1]
      restoreScroll.current = scrollMemory.current[target] ?? 0
      if (h.length === 0) {
        setPage((current) => (current === 'home' ? current : 'home'))
        return h
      }
      setPage(target)
      return h.slice(0, -1)
    })
  }, [isSearchOpen, isCartOpen, page])

  const openProduct = useCallback((product: Product) => {
    setSelectedProduct(product)
    setCartOpen(false)
    setPage((current) => {
      setHistory((h) => [...h.slice(-19), current])
      return 'detail'
    })
    // Katalogdagi joy eslab qolinadi, mahsulot esa rasmdan — tepadan — ochiladi
    rememberScroll(page)
    hapticFeedback('light')
  }, [page, rememberScroll])

  const toggleLike = useCallback((id: number) => {
    setLikedIds((current) => {
      const next = current.includes(id) ? current.filter((i) => i !== id) : [...current, id]
      saveLikes(next)
      hapticFeedback('light')
      return next
    })
  }, [])

  const notify = useCallback((message: string) => {
    // Eski taymer bekor qilinadi — aks holda oldingi xabarning
    // taymeri yangisini vaqtidan oldin o'chirib yuborardi.
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const clearToast = useCallback(() => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const addToCart = useCallback((product: Product, size?: string, color?: string) => {
    const s = size || product.sizes?.[0] || 'nosize'
    const c = color || product.color || 'nocolor'
    const key = `${product.id}_${s}_${c}`
    setCartItems((current) => ({
      ...current,
      [key]: {
        quantity: (current[key]?.quantity ?? 0) + 1,
        size: size || product.sizes?.[0],
        color: color || product.color
      }
    }))
    // Bildirishnoma o'rniga so'rov: mijoz savat qayerdaligini
    // qidirib yurmasin, to'g'ridan-to'g'ri rasmiylashtirishga o'ta olsin.
    setCartPrompt(product.name)
    hapticFeedback('medium')
    track('cart_add', product.id)
  }, [])

  /**
   * Kartochkadagi «−/+» ishlaydigan savat kaliti.
   *
   * Kartochkada o'lcham tanlanmaydi, shuning uchun `addToCart` bilan
   * BIR XIL kalit: birinchi o'lcham va asosiy tur. Aks holda «+» boshqa
   * qatorga tushib, kartochkada son o'zgarmay qolardi.
   */
  const defaultCartKey = (product: Product) =>
    `${product.id}_${product.sizes?.[0] || 'nosize'}_${product.color || 'nocolor'}`

  const cartQtyOf = useCallback(
    (product: Product) => cartItems[defaultCartKey(product)]?.quantity ?? 0,
    [cartItems],
  )

  /** Kartochkadan sonni o'zgartirish. 0 ga tushsa mahsulot savatdan chiqadi. */
  const changeCartQty = useCallback((product: Product, delta: number) => {
    const key = defaultCartKey(product)
    setCartItems((current) => {
      const quantity = (current[key]?.quantity ?? 0) + delta
      const next = { ...current }
      if (quantity <= 0) delete next[key]
      else next[key] = { quantity, size: product.sizes?.[0], color: product.color }
      return next
    })
    hapticFeedback('light')
  }, [])

  const updateCartQuantity = useCallback((cartKey: string, nextQuantity: number) => {
    setCartItems((current) => {
      const next = { ...current }
      if (nextQuantity <= 0) delete next[cartKey]
      else next[cartKey] = { ...next[cartKey], quantity: nextQuantity }
      return next
    })
    hapticFeedback('light')
  }, [])

  /**
   * «Rasmiylashtirasizmi?» taklifini yopish.
   *
   * useCallback SHART: CartPrompt 5 soniyalik o'zi-yopilish taymerini shu
   * funksiyaga bog'laydi. Har renderda yangi funksiya bo'lsa, taymer har
   * safar boshidan boshlanib, taklif ekranda uzoq qolib ketardi.
   */
  const dismissCartPrompt = useCallback(() => setCartPrompt(null), [])

  // Savat ochildi — unda o'z «Buyurtma berish» tugmasi bor, taklif endi ortiqcha
  const openCart = useCallback(() => {
    setCartOpen(true)
    setCartPrompt(null)
  }, [])
  const closeCart = useCallback(() => setCartOpen(false), [])

  const goToCheckout = useCallback(() => {
    track('checkout_start')
    setCartOpen(false)
    rememberScroll(page)
    // Rasmiylashtirishga o'tildi — taklif vazifasini bajardi, buyurtma sahifasida qolmasin
    setCartPrompt(null)
    setPage((current) => {
      setHistory((h) => [...h.slice(-19), current])
      return 'checkout'
    })
  }, [page, rememberScroll])

  const updateOrderForm = useCallback((field: keyof OrderForm, value: unknown) => {
    setOrderForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  /**
   * Buyurtmani SERVER yaratadi (F-04). Bu yerdan faqat "nimadan nechta"
   * yuboriladi — narx, chegirma va jami serverda qayta hisoblanadi,
   * shuning uchun finalTotal parametri endi kerak emas.
   */
  const submitOrder = useCallback(async () => {
    if (isSubmitting) return false

    if (!orderForm.name.trim() || !orderForm.phone.trim() || !orderForm.address.trim()) {
      notify(t('checkout.fillAll'))
      return false
    }

    if (cartProducts.length === 0) {
      notify(t('checkout.cartEmpty'))
      return false
    }

    if (!orderKeyRef.current) orderKeyRef.current = newOrderKey()

    setSubmitting(true)
    try {
      await apiPost<{ id: string; orderNumber: string; total: number }>('/api/orders', {
        clientOrderId: orderKeyRef.current,
        items: cartProducts.map(({ product, quantity, size, color }) => ({
          productId: product.id,
          quantity,
          size,
          color,
        })),
        customer: {
          name: orderForm.name.trim(),
          phone: orderForm.phone.trim(),
          address: orderForm.address.trim(),
          location: orderForm.location,
          comment: orderForm.comment,
          paymentMethod: orderForm.paymentMethod,
          // Buyurtmani boshqa odam oladigan bo'lsa
          recipientName: orderForm.recipientName?.trim() || '',
          recipientPhone: orderForm.recipientPhone?.trim() || '',
        },
        promoCode: orderForm.promoCode,
      })
    } catch (error) {
      // Buyurtma yaratilmadi — savat SAQLANIB qoladi (F-05)
      console.error('[Buyurtma] yuborilmadi:', error)
      hapticError()
      notify(error instanceof ApiError ? error.message : t('checkout.failed'))
      return false
    } finally {
      setSubmitting(false)
    }

    orderKeyRef.current = null
    setCartItems({})
    setOrderForm({ name: '', phone: '', address: '', location: null, comment: '', paymentMethod: 'Naqd' })
    setCheckoutDone(true)
    hapticSuccess()
    notify(t('checkout.success'))
    setTimeout(() => setCheckoutDone(false), 4000)

    return true
  }, [isSubmitting, orderForm, cartProducts, notify, t])

  /*
   * Taklif faqat bosh sahifada va boshqa oyna ochiq bo'lmaganda
   * ko'rsatiladi — savat yoki qidiruv ustidan chiqib xalaqit bermasin.
   */
  const askAddress =
    addressAskDue
    && !addressAsked
    && (userProfile?.addresses?.length ?? 0) === 0
    && page === 'home'
    && !isCartOpen
    && !isSearchOpen
    && !checkoutDone

  return {
    page, history,
    // Bosh sahifadan boshqa har qanday sahifada orqaga qaytish mumkin —
    // shuning uchun Telegram'ning o'z orqaga tugmasi ham ko'rinib turadi.
    canGoBack: page !== 'home' || history.length > 0 || isCartOpen || isSearchOpen,
    products, categories, sections, loading, runningPromotions, clock,
    cartItems, cartCount, cartTotal, cartProducts,
    likedIds, selectedProduct,
    isSearchOpen, isCartOpen, query, searchResults, toast, cartPrompt,
    myOrders, ordersReady, checkoutDone, isSubmitting, authReady, isAuthenticated, orderForm, userProfile,
    notifications, unreadNotificationsCount, unseenOrdersCount,
    catalogCategory, catalogSection, openCategory,
    theme, setTheme, toggleTheme,
    navigate, goBack, openProduct, toggleLike,
    askAddress, dismissAddressPrompt, openAddresses, addressIntent, editAddressId,
    setSearchOpen, setQuery,
    addToCart, updateCartQuantity, cartQtyOf, changeCartQty,
    openCart, closeCart, goToCheckout,
    updateOrderForm, submitOrder,
    notify, clearToast,
    dismissCartPrompt,
  }
}
