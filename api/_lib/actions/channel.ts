import { adminDb } from '../firebase-admin.js'
import { telegramCall, type AnyButton } from '../telegram.js'
import type { Staff } from '../admin-auth.js'
import {
  CAPTION_MAX, plain, plainLength, readButtons, readMedia, startAppParam, type BroadcastButton,
} from './people.js'

/**
 * Telegram kanaliga e'lon joylash.
 *
 * Kanal `settings/channel` da turadi (id, nom, @username). Bot kanalga
 * ADMIN qilib qo'shilgan bo'lishi va «Xabar joylash» huquqiga ega bo'lishi
 * kerak — holat har safar Telegram'dan jonli tekshiriladi, chunki huquqni
 * kanal egasi istalgan payt olib qo'yishi mumkin.
 *
 * Bot kanalga qo'shilganda (yoki chiqarilganda) bot/bot.py `bot_chats`
 * ga yozib qo'yadi — panel ularni «topilgan kanallar» sifatida ko'rsatadi,
 * shunda yopiq kanalni ham ID sini qidirmasdan bir bosishda ulash mumkin.
 */

type ChannelSettings = { chatId: number; title: string; username: string | null }
type TgChat = { id: number; type: string; title?: string; username?: string }
type TgMember = {
  status: string
  can_post_messages?: boolean
  can_edit_messages?: boolean
  can_delete_messages?: boolean
}
type TgMe = { id: number; username: string; has_main_web_app?: boolean }
type TgMessage = { message_id: number }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const SETTINGS_DOC = 'channel'
const HISTORY = 'channel_posts'

async function readChannel(): Promise<ChannelSettings | null> {
  const db = await adminDb()
  const snap = await db.collection('settings').doc(SETTINGS_DOC).get()
  const data = snap.data()
  const chatId = Number(data?.chatId)
  if (!snap.exists || !Number.isFinite(chatId) || !chatId) return null
  return { chatId, title: String(data?.title ?? ''), username: data?.username ? String(data.username) : null }
}

/** Telegram'ning inglizcha xatosini admin tushunadigan tilga o'giradi. */
function friendly(error: string): string {
  const e = error.toLowerCase()
  if (e.includes('chat not found')) {
    return 'Kanal topilmadi. Nomi to‘g‘ri yozilganini va bot kanalga qo‘shilganini tekshiring'
  }
  if (e.includes('not enough rights') || e.includes('have no rights') || e.includes('need administrator rights')) {
    return 'Botda yetarli huquq yo‘q — kanal sozlamasida botga «Xabar joylash» huquqini bering'
  }
  if (e.includes('bot is not a member') || e.includes('bot was kicked') || e.includes('forbidden')) {
    return 'Bot kanalda emas yoki chiqarib yuborilgan — botni kanalga admin qilib qo‘shing'
  }
  if (e.includes('wrong file identifier') || e.includes('failed to get http url content')) {
    return 'Telegram rasm/videoni yuklab ololmadi — faylni qayta yuklab ko‘ring'
  }
  if (e.includes("can't parse entities")) return 'Matndagi HTML teglar noto‘g‘ri yopilgan'
  if (e.includes('message to delete not found')) return 'Xabar kanalda allaqachon yo‘q'
  if (e.includes("message can't be deleted")) return 'Bu xabarni o‘chirib bo‘lmadi — botda «O‘chirish» huquqi yo‘q'
  return error
}

/**
 * Admin kiritgan qiymat → Telegram `chat_id`.
 * `@musa_uz`, `musa_uz`, `https://t.me/musa_uz` yoki `-100…` qabul qilinadi.
 */
function readChatRef(value: unknown): string | number {
  const raw = text(String(value ?? ''))
  if (/^-100\d{5,15}$/.test(raw)) return Number(raw)
  if (/t\.me\/(\+|joinchat\/)/i.test(raw)) {
    throw new Error('Yopiq kanal taklif havolasi ishlamaydi — pastdagi «Topilgan kanallar» dan tanlang yoki -100… ID ni kiriting')
  }
  const match = /^(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/)?@?([a-z]\w{4,31})\/?$/i.exec(raw)
  if (!match) throw new Error('Kanal manzilini @nom, t.me/nom yoki -100… ko‘rinishida kiriting')
  return `@${match[1]}`
}

let meCache: TgMe | null = null
async function botMe(): Promise<TgMe> {
  if (meCache) return meCache
  const me = await telegramCall<TgMe>('getMe')
  if (!me.ok) throw new Error(friendly(me.error))
  meCache = me.result
  return me.result
}

/** Kanal ma'lumoti va botning shu kanaldagi huquqlari — jonli. */
async function inspect(chatRef: string | number) {
  const chat = await telegramCall<TgChat>('getChat', { chat_id: chatRef })
  if (!chat.ok) throw new Error(friendly(chat.error))
  if (chat.result.type !== 'channel') {
    throw new Error('Bu kanal emas (guruh yoki shaxsiy chat). E’lon faqat kanalga joylanadi')
  }
  const me = await botMe()
  const [member, count] = await Promise.all([
    telegramCall<TgMember>('getChatMember', { chat_id: chat.result.id, user_id: me.id }),
    telegramCall<number>('getChatMemberCount', { chat_id: chat.result.id }),
  ])
  const m = member.ok ? member.result : null
  const isAdmin = m?.status === 'administrator' || m?.status === 'creator'
  const rights = {
    isAdmin,
    canPost: isAdmin && m?.can_post_messages !== false,
    // Kanalda xabarni qadash «tahrirlash» huquqi bilan bo'ladi
    canEdit: isAdmin && Boolean(m?.can_edit_messages),
    canDelete: isAdmin && Boolean(m?.can_delete_messages),
  }
  return {
    chat: {
      chatId: chat.result.id,
      title: chat.result.title ?? '',
      username: chat.result.username ?? null,
      members: count.ok ? count.result : null,
      link: chat.result.username ? `https://t.me/${chat.result.username}` : null,
    },
    rights,
    problem: !rights.isAdmin
      ? 'Bot bu kanalda admin emas'
      : !rights.canPost
        ? 'Botda «Xabar joylash» huquqi yo‘q'
        : null,
    me,
  }
}

/** Bot qo'shilgan kanallar (bot/bot.py → my_chat_member). */
async function candidates() {
  const db = await adminDb()
  const snap = await db.collection('bot_chats').where('type', '==', 'channel').limit(20).get()
  return snap.docs
    .map((d) => d.data())
    .filter((c) => c.status === 'administrator')
    .map((c) => ({ chatId: Number(c.chatId), title: String(c.title ?? ''), username: c.username ? String(c.username) : null }))
}

async function recentPosts() {
  const db = await adminDb()
  const snap = await db.collection(HISTORY).orderBy('at', 'desc').limit(15).get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

function postLink(chat: ChannelSettings, messageId: number): string {
  return chat.username
    ? `https://t.me/${chat.username}/${messageId}`
    : `https://t.me/c/${String(chat.chatId).replace(/^-100/, '')}/${messageId}`
}

// ─── Amallar ──────────────────────────────────────────────────

export async function channelStatus() {
  const [channel, found, posts] = await Promise.all([readChannel(), candidates(), recentPosts()])
  const me = await botMe().catch(() => null)
  const base = {
    bot: me ? { username: me.username, appLinks: Boolean(me.has_main_web_app) } : null,
    candidates: found.filter((c) => c.chatId !== channel?.chatId),
    posts,
  }
  if (!channel) return { ...base, connected: false, channel: null, rights: null, problem: null }
  try {
    const live = await inspect(channel.chatId)
    // Kanal nomi yoki @username o'zgargan bo'lsa — saqlanganini yangilaymiz
    if (live.chat.title !== channel.title || live.chat.username !== channel.username) {
      const db = await adminDb()
      await db.collection('settings').doc(SETTINGS_DOC).set(
        { title: live.chat.title, username: live.chat.username },
        { merge: true },
      )
    }
    return { ...base, connected: true, channel: live.chat, rights: live.rights, problem: live.problem }
  } catch (error) {
    return {
      ...base,
      connected: true,
      channel: { ...channel, members: null, link: channel.username ? `https://t.me/${channel.username}` : null },
      rights: null,
      problem: error instanceof Error ? error.message : 'Kanalni tekshirib bo‘lmadi',
    }
  }
}

export async function channelConnect(actor: Staff, body: Record<string, unknown>) {
  const live = await inspect(readChatRef(body.chat))
  if (live.problem) throw new Error(live.problem)
  const db = await adminDb()
  await db.collection('settings').doc(SETTINGS_DOC).set({
    chatId: live.chat.chatId,
    title: live.chat.title,
    username: live.chat.username,
    connectedAt: new Date().toISOString(),
    connectedBy: actor.name || actor.email,
  })
  return channelStatus()
}

export async function channelDisconnect() {
  const db = await adminDb()
  await db.collection('settings').doc(SETTINGS_DOC).delete()
  return channelStatus()
}

/**
 * Kanalga e'lon: rasm/video + matn + tugmalar.
 *
 * Tugmalar: «Havola» — o'zi; «Ilovada ochish» — `t.me/<bot>?startapp=…`
 * (kanalda `web_app` tugmasi ishlamaydi). Matn 1024 belgidan uzun va
 * rasm bo'lsa — avval rasm, keyin matn tugmalar bilan (bot DM'dagi kabi).
 */
export async function channelPost(actor: Staff, body: Record<string, unknown>) {
  const channel = await readChannel()
  if (!channel) throw new Error('Kanal ulanmagan')

  const media = readMedia(body.media)
  const buttons = readButtons(body.buttons)
  const uz = text(body.text)
  const ru = text(body.textRu)
  // Ikki tilda: bitta postda ketma-ket
  const message = body.bilingual === true && ru && uz ? `🇺🇿 ${uz}\n\n🇷🇺 ${ru}` : uz || ru
  if (!message && !media) throw new Error('E’lon matni bo‘sh')
  if (plainLength(message) > 4000) throw new Error('E’lon juda uzun (4000 belgigacha)')

  const me = await botMe()
  const appUrl = (b: BroadcastButton) =>
    me.has_main_web_app
      ? `https://t.me/${me.username}?startapp=${startAppParam(b.target)}`
      : `https://t.me/${me.username}?start=channel`
  const rows: AnyButton[][] = buttons.map((b) => {
    const button: AnyButton = { text: b.text, url: b.kind === 'app' ? appUrl(b) : b.url }
    return [b.style ? { ...button, style: b.style } : button]
  })

  const common: Record<string, unknown> = {
    chat_id: channel.chatId,
    ...(body.silent === true ? { disable_notification: true } : {}),
    ...(body.protect === true ? { protect_content: true } : {}),
  }
  const markup = rows.length ? { reply_markup: { inline_keyboard: rows } } : {}
  const sendText = (value: string) =>
    telegramCall<TgMessage>('sendMessage', {
      ...common,
      text: value,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: body.preview !== true },
      ...markup,
    })

  const ids: number[] = []
  if (media) {
    const fits = plainLength(message) <= CAPTION_MAX
    const sent = await telegramCall<TgMessage>(media.kind === 'photo' ? 'sendPhoto' : 'sendVideo', {
      ...common,
      [media.kind]: media.fileId ?? media.url,
      ...(fits && message ? { caption: message, parse_mode: 'HTML' } : {}),
      ...(media.kind === 'video' ? { supports_streaming: true } : {}),
      ...(fits || !message ? markup : {}),
    })
    if (!sent.ok) throw new Error(friendly(sent.error))
    ids.push(sent.result.message_id)
    if (!fits && message) {
      const rest = await sendText(message)
      if (!rest.ok) throw new Error(`Rasm joylandi, matn esa yo‘q: ${friendly(rest.error)}`)
      ids.push(rest.result.message_id)
    }
  } else {
    const sent = await sendText(message)
    if (!sent.ok) throw new Error(friendly(sent.error))
    ids.push(sent.result.message_id)
  }

  // Qadash — matn va tugmalar turgan xabar (oxirgisi)
  let pinned = false
  let pinError: string | null = null
  if (body.pin === true) {
    const pin = await telegramCall<boolean>('pinChatMessage', {
      chat_id: channel.chatId,
      message_id: ids[ids.length - 1],
      disable_notification: body.silent === true,
    })
    pinned = pin.ok
    if (!pin.ok) pinError = friendly(pin.error)
  }

  const link = postLink(channel, ids[0])
  const db = await adminDb()
  const ref = await db.collection(HISTORY).add({
    chatId: channel.chatId,
    channelTitle: channel.title,
    messageIds: ids,
    link,
    snippet: plain(message).slice(0, 160),
    // «Takrorlash» uchun — muharrirga qayta yuklanadi
    draft: { text: uz, textRu: ru, bilingual: body.bilingual === true, buttons },
    media: media ? { type: media.kind === 'photo' ? 'image' : 'video', url: media.url } : null,
    buttons: buttons.length,
    pinned,
    silent: body.silent === true,
    protect: body.protect === true,
    customers: Math.max(0, Math.round(Number(body.customers) || 0)),
    by: actor.name || actor.email,
    at: new Date().toISOString(),
    deleted: false,
  })
  return { ok: true, id: ref.id, link, messageIds: ids, pinned, pinError }
}

/** Kanaldagi e'lonni o'chiradi (tarixda «o'chirilgan» bo'lib qoladi). */
export async function channelDelete(_actor: Staff, body: Record<string, unknown>) {
  const id = text(body.id)
  if (!/^[\w-]{1,40}$/.test(id)) throw new Error('E’lon topilmadi')
  const db = await adminDb()
  const ref = db.collection(HISTORY).doc(id)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('E’lon topilmadi')
  const data = snap.data() as { chatId: number; messageIds: number[]; deleted?: boolean }
  if (data.deleted) return { ok: true }

  const errors: string[] = []
  for (const messageId of data.messageIds ?? []) {
    const result = await telegramCall<boolean>('deleteMessage', { chat_id: data.chatId, message_id: messageId })
    // Kanalda qo'lda o'chirilgan bo'lsa ham tarixda belgilab qo'yamiz
    if (!result.ok && !/message to delete not found/i.test(result.error)) errors.push(friendly(result.error))
  }
  if (errors.length) throw new Error(errors[0])
  await ref.update({ deleted: true, deletedAt: new Date().toISOString() })
  return { ok: true }
}
