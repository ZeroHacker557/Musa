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
): Promise<SendResult> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }
    if (buttons?.length) {
      body.reply_markup = { inline_keyboard: buttons.map((b) => [b]) }
    }

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
