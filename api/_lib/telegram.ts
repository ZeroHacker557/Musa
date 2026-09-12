/**
 * Telegram Bot API — to'g'ridan-to'g'ri serverless funksiyadan.
 *
 * MUHIM: xabarlar lokal bot jarayoni orqali EMAS, shu yerdan yuboriladi.
 * Bot kompyuterda ishlaydi va o'chirilgan bo'lishi mumkin; admin panel esa
 * Vercel'da doim yoqiq. Shu tufayli buyurtma xabarnomasi, kuryerga yuborish
 * va ommaviy xabar botning holatiga bog'liq emas.
 */

const API = 'https://api.telegram.org/bot'

export type SendResult = { ok: true; messageId: number } | { ok: false; error: string }

type InlineButton = { text: string; url: string }
/** Bot ichida ishlov beriladigan tugma (bot/bot.py dagi cb_courier). */
type CallbackButton = { text: string; callback_data: string }

function token(): string {
  const value = process.env.BOT_TOKEN
  if (!value) throw new Error('BOT_TOKEN sozlanmagan')
  return value
}

/**
 * HTML rejimida xabar yuboradi.
 *
 * Xato tashlamaydi — natijani qaytaradi. Ommaviy yuborishda bitta
 * foydalanuvchi botni bloklagani butun jarayonni to'xtatmasligi kerak.
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  buttons?: InlineButton[],
  callbackButtons?: CallbackButton[],
): Promise<SendResult> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }
    const rows: unknown[][] = []
    if (callbackButtons?.length) rows.push(callbackButtons)
    if (buttons?.length) for (const button of buttons) rows.push([button])
    if (rows.length) body.reply_markup = { inline_keyboard: rows }

    const response = await fetch(`${API}${token()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await response.json()) as {
      ok: boolean
      result?: { message_id: number }
      description?: string
    }

    if (!json.ok) return { ok: false, error: json.description || 'Telegram rad etdi' }
    return { ok: true, messageId: json.result?.message_id ?? 0 }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Tarmoq xatosi' }
  }
}

/**
 * Yuborilgan xabarning klaviaturasini to'liq almashtiradi.
 *
 * `replaceButtons` faqat bitta yorliq qo'yadi; bu yerda esa qatorlar
 * o'zimizda — masalan admin xabarida «Qabul qilindi» tugmasi holat
 * yorlig'iga aylanadi, lekin «Admin paneldan ochish» havolasi qoladi.
 */
export async function setKeyboard(
  chatId: number | string,
  messageId: number,
  rows: (InlineButton | CallbackButton)[][],
): Promise<boolean> {
  try {
    const response = await fetch(`${API}${token()}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: rows },
      }),
    })
    const json = (await response.json()) as { ok: boolean }
    return json.ok
  } catch {
    return false
  }
}

/** HTML'ga xavfsiz qo'shish uchun matnni tozalaydi. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Ko'p qabul qiluvchiga ketma-ket yuboradi.
 *
 * Telegram soniyasiga ~30 xabarga ruxsat beradi; chegaradan oshsa 429
 * qaytaradi va bot vaqtincha cheklanadi. Shuning uchun har xabardan keyin
 * kichik pauza — 25 xabar/sekund tezlikda ishlaydi.
 */
export async function sendBulk(
  chatIds: (number | string)[],
  text: string,
  buttons?: InlineButton[],
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const chatId of chatIds) {
    const result = await sendMessage(chatId, text, buttons)
    if (result.ok) sent++
    else {
      failed++
      if (errors.length < 5) errors.push(`${chatId}: ${result.error}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 40))
  }

  return { sent, failed, errors }
}


/**
 * Yuborilgan xabarning tugmalarini almashtiradi.
 *
 * Buyurtma bekor qilinganda yoki qaytadan yuborilganda eski
 * xabarlardagi «Oldim» tugmasi qolib ketmasligi kerak — aks holda
 * kuryer allaqachon yopilgan buyurtmani olib qo'yardi.
 */
export async function replaceButtons(
  chatId: number | string,
  messageId: number,
  label: string | null,
): Promise<boolean> {
  try {
    const response = await fetch(`${API}${token()}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: label
          ? { inline_keyboard: [[{ text: label, callback_data: 'noop' }]] }
          : { inline_keyboard: [] },
      }),
    })
    const json = (await response.json()) as { ok: boolean }
    return json.ok
  } catch {
    return false
  }
}
