import { adminDb } from '../firebase-admin.js'
import { escapeHtml, replaceButtons, sendMessage } from '../telegram.js'
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

const CUSTOMER_TEXT: Record<Status, (n: string) => string> = {
  'Yangi': (n) => `🆕 <b>${n}</b> buyurtmangiz qabul qilindi.`,
  'Qabul qilindi': (n) => `✅ <b>${n}</b> buyurtmangiz tasdiqlandi va tayyorlanmoqda.`,
  'Yetkazilmoqda': (n) => `🚚 <b>${n}</b> buyurtmangiz yo‘lga chiqdi. Kuryer tez orada bog‘lanadi.`,
  'Yetkazildi': (n) => `🎉 <b>${n}</b> buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!`,
  'Bekor qilingan': (n) => `❌ <b>${n}</b> buyurtmangiz bekor qilindi.`,
  'Rad etildi': (n) => `⛔️ <b>${n}</b> buyurtmangiz rad etildi. Batafsil ma’lumot uchun bog‘laning.`,
}

type OrderDoc = {
  orderNumber?: string
  status?: string
  userId?: number
  courierId?: string | null
  total?: number
  paymentMethod?: string
  products?: { product?: { name?: string; price?: number }; quantity?: number }[]
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
  await ref.set(
    {
      status,
      statusUpdatedAt: now,
      statusUpdatedBy: { uid: staff.uid, name: staff.name, role: staff.role },
    },
    { merge: true },
  )
  await ref.collection('history').add({
    at: now,
    from: order.status ?? null,
    to: status,
    by: { uid: staff.uid, name: staff.name, role: staff.role },
  })

  // «Qabul qilindi» — buyurtma shu zahoti kuryerga ketadi.
  // Bu yerda ataylab: admin alohida «yuborish» tugmasini bosishi shart
  // emas, tasdiqlash o'zi yuborish signali.
  if (status === 'Qabul qilindi') {
    await dispatchToCouriers(orderId, { ...order, status })
  } else if (status === 'Bekor qilingan' || status === 'Rad etildi') {
    // Kuryerlardagi «Oldim» tugmasi qolib ketmasin — buyurtma yopilgan
    await clearDispatchButtons(orderId, order, `❌ ${status}`)
  }

  const label = order.orderNumber || `#${orderId.slice(0, 6)}`
  let notified = false

  if (order.userId) {
    await db.collection('notifications').add({
      userId: order.userId,
      title: 'Buyurtma holati',
      body: `${label} — ${status}`,
      date: now,
      read: false,
      type: 'order',
    })
    const result = await sendMessage(order.userId, CUSTOMER_TEXT[status](escapeHtml(label)))
    notified = result.ok
  }

  return { ok: true, notified }
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
    // Qo'lda biriktirishda ham marshrut tugmasi bo'ladi. «Oldim» esa
    // faqat buyurtma tasdiqlangan bo'lsa — aks holda kuryer hali
    // tasdiqlanmagan buyurtmani yo'lga olib chiqib ketardi.
    const route = routeButton(order)
    const accepted = order.status === 'Qabul qilindi'

    const result = await sendMessage(
      courier.telegramId,
      `🛵 <b>Sizga buyurtma biriktirildi</b>\n\n${orderSummary(orderId, order)}` +
        (accepted ? '' : '\n\n<i>Tasdiqlangach yetkazishga chiqasiz.</i>'),
      route ? [route] : undefined,
      accepted ? [{ text: '✅ Oldim', callback_data: `crr:take:${orderId}` }] : undefined,
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

    const base = process.env.ADMIN_PANEL_URL || ''
    const buttons = base
      ? [{ text: '🖥 Admin paneldan ochish', url: `${base}#/orders/${orderId}` }]
      : undefined

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

    for (const target of targets) {
      await sendMessage(target, text, buttons)
      await new Promise((resolve) => setTimeout(resolve, 40))
    }

    if (targets.length) {
      // Bot endi bu buyurtmani qayta yubormasin
      await db.collection('orders').doc(orderId).set({ notified: true }, { merge: true })
    }
  } catch (error) {
    console.error('[orders] xabarnoma yuborilmadi:', error)
  }
}


/**
 * Buyurtmani kuryerlarga yetkazadi.
 *
 * Biriktirilgan kuryer bo'lsa — faqat unga. Bo'lmasa, sozlamaga qarab
 * barcha faol kuryerlarga va/yoki umumiy guruhga. Xabarda «Oldim»
 * tugmasi bo'ladi: kuryer bosganda buyurtma «Yetkazilmoqda» ga o'tadi.
 *
 * Xato tashlamaydi — xabar ketmagani holat o'zgarishini bekor qilmaydi.
 */
export async function dispatchToCouriers(
  orderId: string,
  order: OrderDoc & { dispatchMessages?: { chatId: string; messageId: number }[] },
): Promise<void> {
  try {
    const db = await adminDb()

    const settingsSnap = await db.collection('settings').doc('courier').get()
    const settings = (settingsSnap.data() || {}) as {
      channel?: 'couriers' | 'group'
      toCouriers?: boolean
      toGroup?: boolean
      groupChatId?: string | null
    }

    /*
     * Kanal BITTA bo'ladi — shaxsiy xabar YOKI guruh.
     *
     * Ilgari ikkalasi mustaqil belgilanardi va ikkalasi yoqilganda
     * kuryer bir buyurtmani ikki marta olardi: shaxsiy chatda va
     * guruhda. Ikki nusxada esa «Oldim» tugmasi ham ikkita bo'lib,
     * qaysidir biri eskirib qolardi.
     *
     * Eski sozlamalar uchun: toGroup yoqilgan bo'lsa — guruh.
     */
    const channel =
      settings.channel ?? (settings.toGroup ? 'group' : 'couriers')

    const text = `🛵 <b>YETKAZISHGA TAYYOR</b>

${orderSummary(orderId, order)}`
    const targets: (number | string)[] = []

    if (channel === 'group') {
      if (settings.groupChatId) targets.push(settings.groupChatId)
    } else if (order.courierId) {
      const snap = await db.collection('staff').doc(order.courierId).get()
      const courier = snap.data() as { telegramId?: number; active?: boolean } | undefined
      if (courier?.telegramId && courier.active !== false) targets.push(courier.telegramId)
    } else {
      // Biriktirilmagan — barcha faol kuryerlarga. Kim birinchi «Oldim»
      // bossa, o'shanga tegadi; qolganlarining tugmasi o'chiriladi.
      const snap = await db.collection('staff').where('role', '==', 'courier').get()
      for (const doc of snap.docs) {
        const data = doc.data() as { telegramId?: number; active?: boolean }
        if (data.active !== false && data.telegramId) targets.push(data.telegramId)
      }
    }

    // Bir chatga ikki marta yuborilmasin
    const unique = [...new Set(targets.map(String))]

    // Kuryerga «Admin paneldan ochish» tugmasi ATAYLAB berilmaydi —
    // unda panelga kirish huquqi yo'q. O'rniga marshrut havolasi.
    const route = routeButton(order)

    /*
     * Yuborilgan xabarlar ro'yxati saqlanadi.
     *
     * Kuryer birortasida «Oldim» bosganda bot QOLGAN nusxalarning
     * tugmasini ham yangilaydi — aks holda boshqa chatdagi «Oldim»
     * eskirib turaverardi va qayta bosilishi mumkin edi.
     */
    // Qayta yuborilayotgan bo'lsa (masalan admin holatni qaytarib, yana
    // tasdiqlagan bo'lsa), eski xabarlardagi tugmalarni o'chiramiz.
    await clearDispatchButtons(
      orderId,
      order as OrderDoc & { dispatchMessages?: { chatId: string; messageId: number }[] },
      null,
    )

    const dispatchMessages: { chatId: string; messageId: number }[] = []

    for (const target of unique) {
      const result = await sendMessage(target, text, route ? [route] : undefined, [
        { text: '✅ Oldim', callback_data: `crr:take:${orderId}` },
      ])
      if (result.ok) dispatchMessages.push({ chatId: target, messageId: result.messageId })
      await new Promise((resolve) => setTimeout(resolve, 40))
    }

    /*
     * Matn ham saqlanadi.
     *
     * Kuryer «Oldim» bosganda bot BARCHA nusxalarning matniga «kim
     * oldi» qatorini qo'shadi. Bosilgan xabarning matnini Telegram
     * o'zi beradi, qolganlariniki esa bu yerdan olinadi — aks holda
     * guruhdagi xabar eski holida qolib ketardi.
     */
    await db.collection('orders').doc(orderId).set(
      { dispatchedAt: new Date().toISOString(), dispatchMessages, dispatchText: text },
      { merge: true },
    )
  } catch (error) {
    console.error('[orders] kuryerga yuborilmadi:', error)
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
