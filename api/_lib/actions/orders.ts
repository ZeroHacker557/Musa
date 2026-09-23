import { adminDb } from '../firebase-admin.js'
import {
  editMessage, escapeHtml, replaceButtons, sendMessage, sendRows, setKeyboard, type AnyButton,
} from '../telegram.js'
import { userLang, type Lang } from '../i18n.js'
import { restoreStock } from '../stock.js'
import { pushOrderSafe } from './linko-orders.js'
import type { Staff } from '../admin-auth.js'

const STATUSES = [
  'Yangi',
  'Qabul qilindi',
  'Yetkazilmoqda',
  'Yetkazildi',
  'Bekor qilingan',
  'Rad etildi',
] as const
export type Status = (typeof STATUSES)[number]

/** Kuryer faqat yetkazish bosqichlarini qo'ya oladi. */
const COURIER_ALLOWED: Status[] = ['Yetkazilmoqda', 'Yetkazildi']

/*
 * Mijozga boradigan matnlar — ikki tilda. Qaysi til kerakligini
 * `users/<id>.language` aytadi (botda tanlangan til ilovada ham ishlaydi).
 * Bot tomonidagi matnlar bilan bir xil: bot/i18n.py.
 */
const CUSTOMER_TEXT: Record<Lang, Record<Status, (n: string) => string>> = {
  uz: {
    'Yangi': (n) => `🆕 <b>${n}</b> buyurtmangiz qabul qilindi.`,
    'Qabul qilindi': (n) => `✅ <b>${n}</b> buyurtmangiz tasdiqlandi va tayyorlanmoqda.`,
    'Yetkazilmoqda': (n) => `🚚 <b>${n}</b> buyurtmangiz yo‘lga chiqdi. Kuryer tez orada bog‘lanadi.`,
    'Yetkazildi': (n) => `🎉 <b>${n}</b> buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!`,
    'Bekor qilingan': (n) => `❌ <b>${n}</b> buyurtmangiz bekor qilindi.`,
    'Rad etildi': (n) => `⛔️ <b>${n}</b> buyurtmangiz rad etildi. Batafsil ma’lumot uchun bog‘laning.`,
  },
  ru: {
    'Yangi': (n) => `🆕 Ваш заказ <b>${n}</b> принят.`,
    'Qabul qilindi': (n) => `✅ Ваш заказ <b>${n}</b> подтверждён и готовится.`,
    'Yetkazilmoqda': (n) => `🚚 Ваш заказ <b>${n}</b> в пути. Курьер скоро свяжется с вами.`,
    'Yetkazildi': (n) => `🎉 Ваш заказ <b>${n}</b> доставлен. Спасибо за покупку!`,
    'Bekor qilingan': (n) => `❌ Ваш заказ <b>${n}</b> отменён.`,
    'Rad etildi': (n) => `⛔️ Ваш заказ <b>${n}</b> отклонён. Свяжитесь с нами для подробностей.`,
  },
}

/** Ilova ichidagi bildirishnoma — `src/i18n/ru.ts` dagi «status.*» bilan bir xil. */
const STATUS_NAME: Record<Lang, Record<Status, string>> = {
  uz: {
    'Yangi': 'Yangi',
    'Qabul qilindi': 'Qabul qilindi',
    'Yetkazilmoqda': 'Yetkazilmoqda',
    'Yetkazildi': 'Yetkazildi',
    'Bekor qilingan': 'Bekor qilingan',
    'Rad etildi': 'Rad etildi',
  },
  ru: {
    'Yangi': 'Новый',
    'Qabul qilindi': 'Принят',
    'Yetkazilmoqda': 'Доставляется',
    'Yetkazildi': 'Доставлен',
    'Bekor qilingan': 'Отменён',
    'Rad etildi': 'Отклонён',
  },
}

const NOTIF_STATUS_TITLE: Record<Lang, string> = {
  uz: 'Buyurtma holati',
  ru: 'Статус заказа',
}

const RATING_TEXT: Record<Lang, {
  ask: (label: string, scope: string) => string
  scope: (count: number) => string
  skip: string
}> = {
  uz: {
    ask: (label, scope) =>
      `⭐ <b>${label} buyurtmangiz qanday bo‘ldi?</b>\n\n` +
      scope +
      '<i>Bahoingiz ilovada boshqa xaridorlarga yordam beradi.</i>',
    scope: (count) => `Bitta baho — buyurtmadagi ${count} ta mahsulotning hammasiga qo‘yiladi.\n\n`,
    skip: 'O‘tkazib yuborish',
  },
  ru: {
    ask: (label, scope) =>
      `⭐ <b>Как вам заказ ${label}?</b>\n\n` +
      scope +
      '<i>Ваша оценка поможет другим покупателям в приложении.</i>',
    scope: (count) => `Одна оценка — сразу для всех ${count} товаров заказа.\n\n`,
    skip: 'Пропустить',
  },
}

type ChatMessage = { chatId: string; messageId: number }

/**
 * Kuryerlarga yuborilgan nusxa. `kind` — kimga ketgani:
 *   courier — kuryerning shaxsiy chati («Ilovada ochish» tugmasi bilan)
 *   group   — umumiy guruhdagi ma'lumot nusxasi (tugmasiz)
 * Eski yozuvlarda `kind` yo'q — ular kuryer nusxasi deb olinadi.
 */
type DispatchMessage = ChatMessage & { kind?: 'courier' | 'group' }

export type OrderDoc = {
  orderNumber?: string
  status?: string
  userId?: number
  courierId?: string | null
  courierName?: string | null
  total?: number
  paymentMethod?: string
  products?: { product?: { name?: string; price?: number }; quantity?: number; size?: string | null }[]
  dispatchMessages?: DispatchMessage[]
  dispatchText?: string
  groupText?: string
  customer?: {
    name?: string
    phone?: string
    address?: string
    comment?: string
    location?: { lat: number; lng: number } | null
    recipientName?: string
    recipientPhone?: string
  }
}

/**
 * Kuryer uchun marshrut havolasi.
 *
 * `dir/?api=1&destination=` — Google Maps'ni YO'NALISH rejimida ochadi:
 * telefonda ilova o'zi ishga tushib, navigatsiyani boshlaydi. Oddiy
 * `?q=` havolasi esa faqat nuqtani ko'rsatadi, marshrut qurmaydi.
 */
function routeButton(order: OrderDoc) {
  const location = order.customer?.location
  if (location?.lat == null || location?.lng == null) return null
  return {
    text: '🗺 Manzilga yo‘l olish',
    url: `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`,
  }
}

/**
 * «Admin paneldan ochish» havolasi — AYNAN shu buyurtmani ochadi.
 *
 * `#/orders/<id>` — admin panelning hash-routeri (src/admin/lib/router.ts)
 * ikkinchi bo'lakni `focusId` sifatida OrdersPage'ga beradi va oyna
 * darhol ochiladi. Hash ishlatiladi, chunki /admin bitta statik faylga
 * qayta yoziladi.
 */
export function panelUrl(hashPath: string): string | null {
  const base = process.env.ADMIN_PANEL_URL || ''
  if (!base) return null

  /*
   * ADMIN_PANEL_URL qo'lda sozlanadi, shuning uchun uchta ko'rinishga
   * ham tayyor bo'lamiz: `.../admin`, `.../admin/` va shunchaki domen.
   * Oxirgisida `/admin` o'zi qo'shiladi — aks holda havola mini
   * appni ochib qo'yardi.
   */
  const root = base.replace(/\/+$/, '')
  const panel = /\/admin$/.test(root) ? root : `${root}/admin`
  return `${panel}/#/${hashPath}`
}

function panelButtons(orderId: string) {
  const url = panelUrl(`orders/${orderId}`)
  return url ? [{ text: '🖥 Admin paneldan ochish', url }] : undefined
}

/**
 * Adminlarga yuborilgan «yangi buyurtma» xabarlarini yangilaydi.
 *
 * Buyurtma tasdiqlangandan keyin «✅ Qabul qilindi» tugmasi bosilib
 * turmasligi kerak — u holat yorlig'iga aylanadi. Panelga havola esa
 * qoladi: admin baribir buyurtmani ochib ko'rishi mumkin.
 *
 * Xato tashlamaydi — xabar tahrirlanmagani holat o'zgarishini bekor
 * qilmasligi kerak.
 */
export async function refreshAdminMessages(
  orderId: string,
  label: string,
): Promise<void> {
  const db = await adminDb()
  const snap = await db.collection('dispatch').doc(orderId).get()
  const messages = ((snap.data() || {}).adminMessages || []) as ChatMessage[]
  if (!messages.length) return

  const rows: ({ text: string; url: string } | { text: string; callback_data: string })[][] = [
    [{ text: label, callback_data: 'noop' }],
  ]
  for (const button of panelButtons(orderId) || []) rows.push([button])

  for (const item of messages) {
    if (!item?.chatId || !item?.messageId) continue
    await setKeyboard(item.chatId, item.messageId, rows)
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
}

/** Qoldiq shu songa tushsa adminlar ogohlantiriladi. */
export const LOW_STOCK_AT = 5

/**
 * Adminlarning Telegram ID lari — xabarnomalar shu ro'yxatga boradi.
 *
 * Faqat faol xodimlar va faqat `telegramId` si borlari: panelga email
 * bilan kiradigan admin Telegram'ga ulanmagan bo'lishi mumkin.
 */
export async function adminTargets(): Promise<number[]> {
  const db = await adminDb()
  const snap = await db.collection('staff').where('role', 'in', ['owner', 'admin']).get()
  const targets: number[] = []
  for (const doc of snap.docs) {
    const data = doc.data() as { telegramId?: number; active?: boolean }
    if (data.active !== false && data.telegramId) targets.push(data.telegramId)
  }
  return targets
}

/**
 * Ombor qoldig'i tugab qolgani haqida adminlarga xabar.
 *
 * Bir mahsulot uchun BIR MARTA: mahsulotga `lowStockAlerted` bayrog'i
 * qo'yiladi va u faqat admin qoldiqni chegaradan yuqori qilib
 * to'ldirganda tozalanadi (actions/catalog.ts). Aks holda har
 * buyurtmada bir xil xabar kelaverardi.
 */
export async function notifyLowStock(
  items: { id: string; name: string; stock: number }[],
): Promise<void> {
  if (!items.length) return
  try {
    const db = await adminDb()
    const fresh: typeof items = []

    for (const item of items) {
      const ref = db.collection('products').doc(item.id)
      const snap = await ref.get()
      if (!snap.exists || snap.data()?.lowStockAlerted === true) continue
      await ref.set({ lowStockAlerted: true }, { merge: true })
      fresh.push(item)
    }
    if (!fresh.length) return

    const lines = fresh.map((item) =>
      item.stock <= 0
        ? `🔴 <b>${escapeHtml(item.name)}</b> — tugadi`
        : `🟡 <b>${escapeHtml(item.name)}</b> — ${item.stock} ta qoldi`,
    )
    const text = `📦 <b>OMBOR</b>\n\n${lines.join('\n')}\n\nQoldiqni admin panel → Mahsulotlar bo'limidan to'ldiring.`

    for (const target of await adminTargets()) {
      await sendMessage(target, text)
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
  } catch (error) {
    console.error('[orders] ombor signali yuborilmadi:', error)
  }
}

/** Kuryerga va guruhga yuboriladigan to'liq tavsilot. */
export function orderSummary(id: string, order: OrderDoc): string {
  const lines = (order.products || [])
    .map((p) => `• ${escapeHtml(p.product?.name)} × ${p.quantity ?? 1}`)
    .join('\n')

  return (
    `📦 <b>${escapeHtml(order.orderNumber || id)}</b>\n\n` +
    `👤 ${escapeHtml(order.customer?.name)}\n` +
    `📞 ${escapeHtml(order.customer?.phone)}\n` +
    `📍 ${escapeHtml(order.customer?.address)}\n` +
    // Buyurtmani boshqa odam oladigan bo'lsa — kuryer kimga topshirishini
    // va kim bilan bog'lanishini bilishi kerak
    (order.customer?.recipientName || order.customer?.recipientPhone
      ? `🤝 <b>Qabul qiladi:</b> ${escapeHtml(order.customer.recipientName)} ` +
        `${escapeHtml(order.customer.recipientPhone)}\n`
      : '') +
    (order.customer?.comment ? `💬 ${escapeHtml(order.customer.comment)}\n` : '') +
    `\n${lines}\n\n` +
    `💰 <b>${Number(order.total || 0).toLocaleString('ru-RU')} so‘m</b> — ${escapeHtml(order.paymentMethod || 'Naqd')}`
  )
}

/** Holat yorliqlari uchun belgi. */
function statusIcon(status: Status): string {
  const icons: Record<Status, string> = {
    'Yangi': '🆕',
    'Qabul qilindi': '✅',
    'Yetkazilmoqda': '🚚',
    'Yetkazildi': '🎉',
    'Bekor qilingan': '❌',
    'Rad etildi': '⛔',
  }
  return icons[status]
}

export async function orderStatus(staff: Staff, body: Record<string, unknown>) {
  const orderId = String(body.orderId || '').trim()
  const status = body.status as Status
  if (!orderId) throw new Error('orderId kerak')
  if (!STATUSES.includes(status)) throw new Error('Holat noto‘g‘ri')

  const db = await adminDb()
  const ref = db.collection('orders').doc(orderId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Buyurtma topilmadi')
  const order = snap.data() as OrderDoc

  if (staff.role === 'courier') {
    if (order.courierId !== staff.uid) throw new Error('Bu buyurtma sizga biriktirilmagan')
    if (!COURIER_ALLOWED.includes(status)) {
      throw new Error('Kuryer faqat «Yetkazilmoqda» va «Yetkazildi» holatini qo‘ya oladi')
    }
  }

  if (order.status === status) return { ok: true, notified: false, unchanged: true }

  const now = new Date().toISOString()
  const by = { uid: staff.uid, name: staff.name, role: staff.role }
  await ref.set({ status, statusUpdatedAt: now, statusUpdatedBy: by }, { merge: true })

  const { notified } = await applyStatusEffects(orderId, order, status, by, now)
  return { ok: true, notified }
}

type Actor = { uid: string; name: string; role: string }

/**
 * Holat o'zgargandan KEYINGI hamma ish — bitta joyda.
 *
 * Holatni uch yo'l o'zgartiradi: admin panel, kuryerning mini app'i va
 * botdagi eski tugmalar. Ilgari har biri bu ishlarni o'zicha qilardi va
 * bittasi Linko'ni unutib qo'ygan edi. Endi hammasi shu funksiyani
 * chaqiradi: tarix, kuryer va admin xabarlari, mijozga xabar, baho
 * so'rovi va Linko.
 *
 * `order` — o'zgarishdan OLDINGI holat (tarixdagi «qaysidan» uchun).
 * Holatning o'zi bazaga chaqiruvchi tomonidan allaqachon yozilgan.
 */
export async function applyStatusEffects(
  orderId: string,
  order: OrderDoc,
  status: Status,
  by: Actor,
  now: string,
): Promise<{ notified: boolean }> {
  const db = await adminDb()
  const ref = db.collection('orders').doc(orderId)

  await ref.collection('history').add({ at: now, from: order.status ?? null, to: status, by })

  // «Qabul qilindi» — buyurtma shu zahoti kuryerga ketadi.
  // Bu yerda ataylab: admin alohida «yuborish» tugmasini bosishi shart
  // emas, tasdiqlash o'zi yuborish signali.
  if (status === 'Qabul qilindi') {
    await dispatchToCouriers(orderId, { ...order, status })
  } else if (status === 'Bekor qilingan' || status === 'Rad etildi') {
    // Kuryerlardagi «Oldim» tugmasi qolib ketmasin — buyurtma yopilgan
    await clearDispatchButtons(orderId, order, `❌ ${status}`)
    // Buyurtma yopildi — band qilingan miqdor omborga qaytadi
    await restoreStock(orderId)
  } else if (status === 'Yetkazilmoqda' || status === 'Yetkazildi') {
    // Boshqa kuryerlardagi nusxa «… oldi» ga aylanadi va tugmasi o'chadi
    await updateCourierMessages(orderId, order, status)
  }

  /*
   * Adminlarning «yangi buyurtma» xabaridagi «Qabul qilindi» tugmasi
   * endi kerak emas — holat yorlig'iga aylanadi. Bu panelda ham, botda
   * ham bir xil ishlaydi: tasdiqlash qaysi yo'ldan bo'lganidan qat'i
   * nazar boshqa adminlarda tugma eskirib qolmaydi.
   */
  await refreshAdminMessages(orderId, `${statusIcon(status)} ${status} — ${by.name}`)

  const label = order.orderNumber || `#${orderId.slice(0, 6)}`
  let notified = false

  if (order.userId) {
    const lang = await userLang(order.userId)
    await db.collection('notifications').add({
      userId: order.userId,
      title: NOTIF_STATUS_TITLE[lang],
      body: `${label} — ${STATUS_NAME[lang][status]}`,
      date: now,
      read: false,
      type: 'order',
      // Ilova «Buyurtmalar» nishonida bitta buyurtmaning bir necha holatini
      // bir marta sanaydi (src/hooks/use-shop-store.ts)
      orderId,
    })
    const result = await sendMessage(order.userId, CUSTOMER_TEXT[lang][status](escapeHtml(label)))
    notified = result.ok

    // Yetkazildi — mahsulotlarni baholashni so'raymiz (javobni bot qabul qiladi)
    if (status === 'Yetkazildi') await sendRatingPrompt(orderId, order)
  }

  // Linko'dagi buyurtma holati ham yangilanadi (sozlamada yoqilgan bo'lsa)
  await pushOrderSafe(orderId, { ...order, status })

  return { notified }
}

/**
 * Buyurtmani kuryerga biriktiradi va unga Telegram xabarini yuboradi.
 *
 * `courierId` bo'sh bo'lsa — biriktirish bekor qilinadi.
 */
export async function orderAssign(staff: Staff, body: Record<string, unknown>) {
  if (staff.role === 'courier') throw new Error('Kuryer buyurtma biriktira olmaydi')

  const orderId = String(body.orderId || '').trim()
  const courierId = String(body.courierId || '').trim()
  if (!orderId) throw new Error('orderId kerak')

  const db = await adminDb()
  const ref = db.collection('orders').doc(orderId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Buyurtma topilmadi')
  const order = snap.data() as OrderDoc

  if (!courierId) {
    await ref.set({ courierId: null, courierName: null }, { merge: true })
    return { ok: true, assigned: false, notified: false }
  }

  const courierSnap = await db.collection('staff').doc(courierId).get()
  if (!courierSnap.exists) throw new Error('Kuryer topilmadi')
  const courier = courierSnap.data() as { name?: string; telegramId?: number; active?: boolean }
  if (courier.active === false) throw new Error('Bu kuryer bloklangan')

  await ref.set(
    { courierId, courierName: courier.name ?? null, assignedAt: new Date().toISOString() },
    { merge: true },
  )

  let notified = false
  if (courier.telegramId) {
    // Tugma faqat tasdiqlangan buyurtmada — aks holda kuryer hali
    // tasdiqlanmagan buyurtmani ilovada qidirib yurardi
    const accepted = order.status === 'Qabul qilindi'
    const open = openInAppButton(orderId)

    const result = await sendRows(
      courier.telegramId,
      `🛵 <b>Sizga buyurtma biriktirildi</b>\n\n${orderSummary(orderId, order)}` +
        (accepted ? '' : '\n\n<i>Tasdiqlangach yetkazishga chiqasiz.</i>'),
      accepted && open ? [[open]] : [],
    )
    notified = result.ok
  }

  return { ok: true, assigned: true, notified, courierName: courier.name }
}


/**
 * Yangi buyurtma haqida xodimlarga xabar beradi.
 *
 * Ilgari buni lokal bot qilardi: u Firestore'ni so'rab turib, `notified`
 * bayrog'i false bo'lgan buyurtmalarni topardi. Endi xabar buyurtma
 * yaratilgan zahoti shu yerdan ketadi — kompyuter o'chiq bo'lsa ham
 * admin darhol biladi.
 *
 * Xato tashlamaydi: xabar ketmagani buyurtmani bekor qilmasligi kerak.
 */
export async function notifyNewOrder(orderId: string, order: OrderDoc): Promise<void> {
  try {
    const db = await adminDb()

    const settingsSnap = await db.collection('settings').doc('courier').get()
    const settings = (settingsSnap.data() || {}) as { notifyAdmins?: boolean }

    const buttons = panelButtons(orderId)

    const text = `🔔 <b>YANGI BUYURTMA</b>

${orderSummary(orderId, order)}`

    const targets: (number | string)[] = []

    if (settings.notifyAdmins !== false) {
      const staffSnap = await db
        .collection('staff')
        .where('role', 'in', ['owner', 'admin'])
        .get()
      for (const doc of staffSnap.docs) {
        const data = doc.data() as { telegramId?: number; active?: boolean }
        if (data.active !== false && data.telegramId) targets.push(data.telegramId)
      }
    }

    // Guruhga bu yerda YUBORILMAYDI. Guruh — kuryerlar uchun ish oqimi,
    // u buyurtma «Qabul qilindi» bo'lgandan keyin xabar oladi
    // (dispatchToCouriers). Aks holda guruhda hali tasdiqlanmagan
    // buyurtmalar ham paydo bo'lib, kuryerlarni chalg'itardi.

    /*
     * Admin xabarida IKKI yo'l bo'ladi:
     *   «✅ Qabul qilindi» — to'g'ridan-to'g'ri botdan tasdiqlash
     *   «🖥 Admin paneldan ochish» — aynan shu buyurtmani panelda ochadi
     *
     * Birinchisi bot jarayoni orqali ishlaydi (bot/bot.py → cb_admin),
     * ikkinchisi esa botga umuman bog'liq emas.
     */
    const accept = [{ text: '✅ Qabul qilindi', callback_data: `adm:acc:${orderId}` }]

    const adminMessages: ChatMessage[] = []
    for (const target of targets) {
      const result = await sendMessage(target, text, buttons, accept)
      if (result.ok) adminMessages.push({ chatId: String(target), messageId: result.messageId })
      await new Promise((resolve) => setTimeout(resolve, 40))
    }

    if (targets.length) {
      await db.collection('orders').doc(orderId).set({ notified: true }, { merge: true })

      /*
       * `adminMessages` saqlanadi: buyurtma tasdiqlangach (panelda yoki
       * botda) BARCHA adminlarning xabaridagi tugma yangilanadi, aks
       * holda boshqa adminda «Qabul qilindi» eskirib turaverardi.
       *
       * ATAYLAB alohida `dispatch/{orderId}` hujjatida, buyurtma ichida
       * emas: mijoz o'z buyurtmasini Firestore'dan bevosita o'qiydi
       * (Rules shunga ruxsat beradi), ya'ni buyurtma ichidagi hamma
       * narsa unga ko'rinadi. Adminlarning Telegram ID si esa mijozga
       * kerak emas — `dispatch` to'plami faqat xodimga ochiq.
       */
      await db.collection('dispatch').doc(orderId).set(
        { adminMessages, updatedAt: new Date().toISOString() },
        { merge: true },
      )
    }
  } catch (error) {
    console.error('[orders] xabarnoma yuborilmadi:', error)
  }
}


/**
 * Mini app manzili — kuryer xabaridagi «Ilovada ochish» tugmasi uchun.
 *
 * `MINI_APP_URL` bo'lmasa admin panel manzilidan olinadi: ikkalasi bitta
 * domenda turadi (`.../admin` → `...`).
 */
export function miniAppUrl(): string | null {
  const direct = process.env.MINI_APP_URL
  if (direct) return direct.replace(/\/+$/, '')
  const panel = process.env.ADMIN_PANEL_URL
  if (!panel) return null
  try {
    return new URL(panel).origin
  } catch {
    return null
  }
}

/** Kuryer sahifasini aynan shu buyurtmada ochadigan tugma. */
function openInAppButton(orderId: string): AnyButton | null {
  const base = miniAppUrl()
  if (!base) return null
  return { text: '📱 Ilovada ochish', web_app: { url: `${base}/?courier=${encodeURIComponent(orderId)}` } }
}

/**
 * Buyurtmani kuryerlarga yetkazadi.
 *
 * Har bir kuryerga SHAXSAN yoziladi: «Sizni #1042-buyurtma kutmoqda» va
 * tagida mini app'ni ochadigan tugma. Buyurtmani olish va yetkazish
 * endi ilova ichida — bot faqat xabar beradi.
 *
 * Biriktirilgan kuryer bo'lsa — faqat unga, bo'lmasa barcha faol
 * kuryerlarga. Kim birinchi olsa, o'shaniki bo'ladi; qolganlardagi
 * xabar «… oldi» ga aylanadi (updateCourierMessages).
 *
 * Sozlamada guruh tanlangan bo'lsa, guruhga ham ma'lumot nusxasi
 * ketadi — tugmasiz, chunki mini app tugmasi guruhda ishlamaydi.
 *
 * Xato tashlamaydi — xabar ketmagani holat o'zgarishini bekor qilmaydi.
 */
export async function dispatchToCouriers(orderId: string, order: OrderDoc): Promise<void> {
  try {
    const db = await adminDb()

    const settingsSnap = await db.collection('settings').doc('courier').get()
    const settings = (settingsSnap.data() || {}) as {
      channel?: 'couriers' | 'group'
      toGroup?: boolean
      groupChatId?: string | null
    }
    const channel = settings.channel ?? (settings.toGroup ? 'group' : 'couriers')

    const label = escapeHtml(order.orderNumber || `#${orderId.slice(0, 6)}`)
    const summary = orderSummary(orderId, order)
    const courierText = `🛵 <b>Sizni ${label}-buyurtma kutmoqda</b>\n\n${summary}`
    const groupText = `🛵 <b>YETKAZISHGA TAYYOR</b>\n\n${summary}`

    // Qayta yuborilayotgan bo'lsa (admin holatni qaytarib, yana
    // tasdiqlagan bo'lsa), eski xabarlardagi tugmalarni o'chiramiz.
    await clearDispatchButtons(orderId, order, null)

    const couriers: number[] = []
    if (order.courierId) {
      const snap = await db.collection('staff').doc(order.courierId).get()
      const courier = snap.data() as { telegramId?: number; active?: boolean } | undefined
      if (courier?.telegramId && courier.active !== false) couriers.push(courier.telegramId)
    } else {
      // Kuryerlar va «kuryer sifatida ham ishlaydi» belgili ega/adminlar
      const [byRole, byFlag] = await Promise.all([
        db.collection('staff').where('role', '==', 'courier').get(),
        db.collection('staff').where('canDeliver', '==', true).get(),
      ])
      for (const doc of [...byRole.docs, ...byFlag.docs]) {
        const data = doc.data() as { telegramId?: number; active?: boolean }
        if (data.active !== false && data.telegramId) couriers.push(data.telegramId)
      }
    }

    const open = openInAppButton(orderId)
    const dispatchMessages: DispatchMessage[] = []

    // Bir chatga ikki marta yuborilmasin
    for (const target of [...new Set(couriers.map(String))]) {
      const result = await sendRows(target, courierText, open ? [[open]] : [])
      if (result.ok) dispatchMessages.push({ chatId: target, messageId: result.messageId, kind: 'courier' })
      await new Promise((resolve) => setTimeout(resolve, 40))
    }

    if (channel === 'group' && settings.groupChatId) {
      const route = routeButton(order)
      const result = await sendMessage(settings.groupChatId, groupText, route ? [route] : undefined)
      if (result.ok) {
        dispatchMessages.push({ chatId: String(settings.groupChatId), messageId: result.messageId, kind: 'group' })
      }
    }

    /*
     * Xabarlar va ularning matni saqlanadi: kuryer buyurtmani olganda
     * yoki yetkazganda BARCHA nusxalar yangilanadi (updateCourierMessages).
     */
    await db.collection('orders').doc(orderId).set(
      { dispatchedAt: new Date().toISOString(), dispatchMessages, dispatchText: courierText, groupText },
      { merge: true },
    )
  } catch (error) {
    console.error('[orders] kuryerga yuborilmadi:', error)
  }
}

/**
 * Kuryerlarga ketgan barcha nusxalarni yangilaydi.
 *
 *   Yetkazilmoqda — «🛵 Ali oldi». Olgan kuryerning xabarida «Ilovada
 *                   ochish» qoladi, boshqalarida tugma o'chadi.
 *   Yetkazildi    — «✅ Ali yetkazdi», tugmalar yo'q.
 *
 * Xato tashlamaydi.
 */
export async function updateCourierMessages(
  orderId: string,
  order: OrderDoc,
  status: 'Yetkazilmoqda' | 'Yetkazildi',
): Promise<void> {
  try {
    const messages = order.dispatchMessages || []
    if (!messages.length) return

    const db = await adminDb()
    let who = order.courierName || 'Kuryer'
    let takerChat: string | null = null
    if (order.courierId) {
      const snap = await db.collection('staff').doc(order.courierId).get()
      const courier = snap.data() as { name?: string; telegramId?: number } | undefined
      if (courier?.name) who = courier.name
      if (courier?.telegramId) takerChat = String(courier.telegramId)
    }

    const suffix =
      status === 'Yetkazildi'
        ? `\n\n✅ <b>${escapeHtml(who)} yetkazdi</b>`
        : `\n\n🛵 <b>${escapeHtml(who)} oldi</b>`
    const open = openInAppButton(orderId)

    for (const item of messages) {
      if (!item?.chatId || !item?.messageId) continue
      const base = (item.kind === 'group' ? order.groupText : order.dispatchText) || ''
      const rows: AnyButton[][] =
        status === 'Yetkazilmoqda' && item.kind !== 'group' && String(item.chatId) === takerChat && open
          ? [[open]]
          : []

      if (base) await editMessage(item.chatId, item.messageId, base + suffix, rows)
      else await setKeyboard(item.chatId, item.messageId, rows)
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
  } catch (error) {
    console.error('[orders] kuryer xabarlari yangilanmadi:', error)
  }
}


/**
 * Kuryerlarga yuborilgan xabarlardagi tugmalarni o'chiradi.
 *
 * Buyurtma bekor qilinganda yoki qayta yuborilayotganda chaqiriladi:
 * eski nusxalar shunchaki matn bo'lib qoladi, ulardagi «Oldim» bosilmaydi.
 */
export async function clearDispatchButtons(
  orderId: string,
  order: OrderDoc & { dispatchMessages?: { chatId: string; messageId: number }[] },
  label: string | null,
): Promise<void> {
  const messages = order.dispatchMessages || []
  for (const item of messages) {
    if (!item?.chatId || !item?.messageId) continue
    await replaceButtons(item.chatId, item.messageId, label)
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
}


/**
 * Yetkazilgandan keyin baho so'rovi — birinchi mahsulot uchun.
 *
 * Mijoz ⭐ bosganda bot (bot/bot.py → cb_review) sharhni mijoz nomidan
 * saqlaydi, mahsulot reytingini qayta hisoblaydi va xabarni keyingi
 * mahsulotga almashtiradi. Matn va tugmalar botdagi bilan bir xil.
 *
 * Xato tashlamaydi — baho so'rovi yetmagani holat o'zgarishini buzmasin.
 */
export async function sendRatingPrompt(orderId: string, order: OrderDoc): Promise<void> {
  try {
    if (!order.userId) return
    const seen = new Set<string>()
    const items = (order.products || []).filter((p) => {
      const id = String((p.product as { id?: unknown } | undefined)?.id ?? '')
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
    if (!items.length) return

    const label = escapeHtml(order.orderNumber || `#${orderId.slice(0, 6)}`)
    // Bitta baho — hamma mahsulotga. Har mahsulotni alohida so'rash mijozni
    // charchatardi va ko'pchilik yarim yo'lda tashlab ketardi.
    const text = RATING_TEXT[await userLang(order.userId)]
    const scope = items.length > 1 ? text.scope(items.length) : ''
    await sendRows(
      order.userId,
      text.ask(label, scope),
      [
        [1, 2, 3, 4, 5].map((n) => ({ text: `${n}⭐`, callback_data: `rv:${orderId}:all:${n}` })),
        [{ text: text.skip, callback_data: `rv:${orderId}:all:0` }],
      ],
    )
  } catch (error) {
    console.error('[orders] baho so‘rovi yuborilmadi:', error)
  }
}
