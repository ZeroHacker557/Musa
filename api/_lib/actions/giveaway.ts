import { randomInt } from 'node:crypto'
import { adminDb } from '../firebase-admin.js'
import type { Staff } from '../admin-auth.js'
import { escapeHtml, sendMessage } from '../telegram.js'

/**
 * Konkurs (masalan, bloggerlar orqali «botga START bosing — 5 ta set
 * o'ynaladi»).
 *
 * Ishtirokchilar — konkurs oralig'ida botda /start bosganlar. Bot har
 * /start ni `start_events` ga yozadi (bot/firebase_db.py → record_start),
 * shuning uchun botni o'zgartirish shart emas.
 *
 * Do'st taklifi: shaxsiy havola `t.me/musauz_bot?start=ref_<telegram id>`.
 * Bot uni oddiy manba sifatida yozadi (source = «ref_123»). Taklif
 * hisoblanadi, agar do'st: botga BIRINCHI marta kirgan (isNewUser), o'zini
 * o'zi taklif qilmagan va mini app'ni kamida bir marta ochgan bo'lsa
 * (soxta akkauntlar ko'paymasin). Har bir taklif +1 imkoniyat, cheklovsiz.
 *
 * Tanlov serverda: `crypto.randomInt`, har imkoniyat teng ehtimol. Admin
 * panel baraban animatsiyasini faqat ko'rsatadi — natija oldindan shu yerda.
 */

const DOC = () => adminDb().then((db) => db.collection('giveaways').doc('current'))

export type GiveawayConfig = {
  title: string
  prize: string
  startAt: string | null
  endAt: string | null
  winners: number
  /** Do'st taklifi — cheklovsiz: har bir haqiqiy yangi do'st +1 imkoniyat (Abubakr, 2026-10-26). */
  referral: { enabled: boolean }
  messageUz: string
  messageRu: string
}

type Draw = { id: string; name: string; username: string | null; tickets: number; at: string; by: string }

const DEFAULTS: GiveawayConfig = {
  title: 'MUSA konkursi',
  prize: 'Sog‘lom O‘quv Mavsumi seti',
  startAt: null,
  endAt: null,
  winners: 5,
  referral: { enabled: true },
  messageUz: '🎉 Tabriklaymiz, {name}!\n\nSiz MUSA konkursida g‘olib bo‘ldingiz va <b>{prize}</b> yutib oldingiz! 🎁\n\nSovg‘ani topshirish uchun tez orada operatorimiz siz bilan bog‘lanadi.',
  messageRu: '🎉 Поздравляем, {name}!\n\nВы стали победителем конкурса MUSA и выиграли <b>{prize}</b>! 🎁\n\nНаш оператор скоро свяжется с вами, чтобы передать подарок.',
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const iso = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

async function load() {
  const ref = await DOC()
  const snap = await ref.get()
  const data = snap.exists ? snap.data() ?? {} : {}
  const config: GiveawayConfig = { ...DEFAULTS, ...(data.config ?? {}), referral: { ...DEFAULTS.referral, ...(data.config?.referral ?? {}) } }
  return {
    ref,
    config,
    draws: (Array.isArray(data.draws) ? data.draws : []) as Draw[],
    excluded: (Array.isArray(data.excluded) ? data.excluded.map(String) : []) as string[],
    confirmedAt: (data.confirmedAt as string | undefined) ?? null,
    sent: (data.sent ?? null) as { ok: number; failed: number } | null,
  }
}

export type Participant = {
  id: string
  name: string
  username: string | null
  starts: number
  firstAt: string
  isNew: boolean
  refs: number
  tickets: number
  excluded: boolean
}

const displayName = (u: FirebaseFirestore.DocumentData | undefined, id: string) =>
  text(u?.contactName, 60) || [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() || (u?.username ? `@${u.username}` : `ID ${id}`)

/** Ishtirokchilar va imkoniyatlari (konkurs oralig'i bo'yicha). */
async function participants(state: Awaited<ReturnType<typeof load>>): Promise<Participant[]> {
  const { config, excluded } = state
  if (!config.startAt) return []
  const db = await adminDb()
  let q = db.collection('start_events').where('createdAt', '>=', config.startAt)
  if (config.endAt) q = q.where('createdAt', '<', config.endAt)
  const events = (await q.get()).docs.map((d) => d.data())
  // Botdagi «🎁 Konkurs» tugmasini bosganlar ham ishtirokchi (START bosmagan eski mijozlar)
  let jq = db.collection('giveaway_entries').where('createdAt', '>=', config.startAt)
  if (config.endAt) jq = jq.where('createdAt', '<', config.endAt)
  for (const d of (await jq.get()).docs) {
    const e = d.data()
    events.push({ telegramUserId: e.telegramUserId, createdAt: e.createdAt, source: 'konkurs_button', isNewUser: false })
  }

  const byUser = new Map<string, { starts: number; firstAt: string; isNew: boolean }>()
  const refPairs: { from: string; to: string }[] = []
  for (const e of events) {
    const id = String(e.telegramUserId ?? '')
    if (!id) continue
    const at = String(e.createdAt ?? '')
    const row = byUser.get(id) ?? { starts: 0, firstAt: at, isNew: false }
    row.starts++
    if (at < row.firstAt) row.firstAt = at
    if (e.isNewUser) row.isNew = true
    byUser.set(id, row)
    const m = /^ref_(\d{3,20})$/.exec(String(e.source ?? ''))
    if (m && e.isNewUser && m[1] !== id) refPairs.push({ from: m[1], to: id })
  }

  const ids = [...byUser.keys()]
  const users = new Map<string, FirebaseFirestore.DocumentData>()
  for (let i = 0; i < ids.length; i += 300) {
    const snaps = await db.getAll(...ids.slice(i, i + 300).map((id) => db.collection('users').doc(id)))
    for (const s of snaps) if (s.exists) users.set(s.id, s.data() ?? {})
  }

  // Taklif: do'st ham ishtirokchi va mini app'ni ochgan bo'lishi kerak
  const refs = new Map<string, Set<string>>()
  if (config.referral.enabled) {
    for (const { from, to } of refPairs) {
      if (!byUser.has(from)) continue
      const friend = users.get(to)
      if (!friend?.lastActive && !Number(friend?.visitCount)) continue
      const set = refs.get(from) ?? new Set<string>()
      set.add(to)
      refs.set(from, set)
    }
  }

  return ids
    .map((id) => {
      const u = users.get(id)
      const row = byUser.get(id)!
      const r = refs.get(id)?.size ?? 0
      return {
        id,
        name: displayName(u, id),
        username: u?.username ? String(u.username) : null,
        starts: row.starts,
        firstAt: row.firstAt,
        isNew: row.isNew,
        refs: r,
        tickets: 1 + (config.referral.enabled ? r : 0),
        excluded: excluded.includes(id),
      }
    })
    .sort((a, b) => b.tickets - a.tickets || a.firstAt.localeCompare(b.firstAt))
}

/** Mini app uchun ochiq qismi (settings/giveaway — kirgan har kim o'qiydi). */
async function publish(config: GiveawayConfig, confirmed: boolean) {
  const db = await adminDb()
  await db.collection('settings').doc('giveaway').set({
    title: config.title,
    prize: config.prize,
    startAt: config.startAt,
    endAt: config.endAt,
    winners: config.winners,
    referral: config.referral.enabled,
    finished: confirmed,
  })
}

export async function giveawayGet() {
  const state = await load()
  const list = await participants(state)
  const pool = list.filter((p) => !p.excluded)
  return {
    config: state.config,
    draws: state.draws,
    confirmedAt: state.confirmedAt,
    sent: state.sent,
    participants: list,
    stats: {
      people: pool.length,
      tickets: pool.reduce((s, p) => s + p.tickets, 0),
      newUsers: pool.filter((p) => p.isNew).length,
      refs: pool.reduce((s, p) => s + p.refs, 0),
    },
  }
}

export async function giveawaySave(actor: Staff, body: Record<string, unknown>) {
  const state = await load()
  if (state.confirmedAt) throw new Error('Konkurs yakunlangan — yangi konkurs uchun «Yangi konkurs» ni bosing')
  const winners = Math.round(Number(body.winners))
  const config: GiveawayConfig = {
    title: text(body.title, 120) || DEFAULTS.title,
    prize: text(body.prize, 120) || DEFAULTS.prize,
    startAt: iso(body.startAt),
    endAt: iso(body.endAt),
    winners: Number.isFinite(winners) && winners >= 1 && winners <= 50 ? winners : 5,
    referral: {
      enabled: (body.referral as { enabled?: unknown } | undefined)?.enabled !== false,
    },
    messageUz: text(body.messageUz, 1500) || DEFAULTS.messageUz,
    messageRu: text(body.messageRu, 1500) || DEFAULTS.messageRu,
  }
  if (!config.startAt) throw new Error('Boshlanish vaqtini kiriting')
  if (config.endAt && config.endAt <= config.startAt) throw new Error('Tugash vaqti boshlanishidan keyin bo‘lishi kerak')
  await state.ref.set({ config, board: null, updatedAt: new Date().toISOString(), updatedBy: actor.name || actor.email }, { merge: true })
  await publish(config, false)
  return { ok: true }
}

/** Ishtirokchini chiqarish/qaytarish (masalan, xodim yoki test akkaunt). */
export async function giveawayExclude(_actor: Staff, body: Record<string, unknown>) {
  const id = text(body.id, 20)
  if (!/^\d+$/.test(id)) throw new Error('Ishtirokchi topilmadi')
  const state = await load()
  if (state.confirmedAt) throw new Error('Konkurs yakunlangan')
  if (state.draws.some((d) => d.id === id)) throw new Error('G‘olibni chiqarib bo‘lmaydi — avval uni bekor qiling')
  const set = new Set(state.excluded)
  if (body.excluded === false) set.delete(id)
  else set.add(id)
  await state.ref.set({ excluded: [...set], board: null }, { merge: true })
  return { ok: true }
}

/** Navbatdagi g'olib: imkoniyatlar soniga mutanosib tasodifiy tanlov. */
export async function giveawayDraw(actor: Staff) {
  const state = await load()
  if (state.confirmedAt) throw new Error('Konkurs yakunlangan')
  if (state.draws.length >= state.config.winners) throw new Error(`${state.config.winners} ta g‘olib aniqlandi`)
  const drawn = new Set(state.draws.map((d) => d.id))
  const pool = (await participants(state)).filter((p) => !p.excluded && !drawn.has(p.id))
  if (!pool.length) throw new Error('Tanlash uchun ishtirokchi qolmadi')

  const total = pool.reduce((s, p) => s + p.tickets, 0)
  let ticket = randomInt(total)
  let winner = pool[0]
  for (const p of pool) {
    if (ticket < p.tickets) { winner = p; break }
    ticket -= p.tickets
  }
  const draw: Draw = { id: winner.id, name: winner.name, username: winner.username, tickets: winner.tickets, at: new Date().toISOString(), by: actor.name || actor.email }
  await state.ref.set({ draws: [...state.draws, draw] }, { merge: true })

  // Baraban uchun: g'olib + tasodifiy boshqa ismlar (ko'rinish uchun)
  const others = pool.filter((p) => p.id !== winner.id)
  for (let i = others.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[others[i], others[j]] = [others[j], others[i]]
  }
  const wheel = [winner, ...others.slice(0, 15)].map((p) => ({ id: p.id, name: p.name, username: p.username }))
  return { ok: true, winner: draw, wheel, number: state.draws.length + 1 }
}

/** Oxirgi aniqlangan g'olibni bekor qilish (tasdiqlashdan oldin). */
export async function giveawayUndo() {
  const state = await load()
  if (state.confirmedAt) throw new Error('Konkurs yakunlangan')
  await state.ref.set({ draws: state.draws.slice(0, -1) }, { merge: true })
  return { ok: true }
}

/** Tasdiqlash: g'oliblarga bot orqali xabar. Bir marta. */
export async function giveawayConfirm(actor: Staff) {
  const db = await adminDb()
  const state = await load()
  if (state.confirmedAt) throw new Error('G‘oliblarga xabar allaqachon yuborilgan')
  if (!state.draws.length) throw new Error('Avval g‘oliblarni aniqlang')
  const now = new Date().toISOString()
  // Avval belgilanadi — ikki marta bosilsa ham xabar ikki marta ketmasin
  await state.ref.set({ confirmedAt: now, confirmedBy: actor.name || actor.email }, { merge: true })

  let ok = 0
  let failed = 0
  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const d of state.draws) {
    const user = (await db.collection('users').doc(d.id).get()).data()
    const ru = user?.language === 'ru'
    const template = ru ? state.config.messageRu : state.config.messageUz
    const firstName = text(user?.first_name, 60) || d.name
    const message = template
      .replace(/\{name\}/g, escapeHtml(firstName))
      .replace(/\{prize\}/g, escapeHtml(state.config.prize))
    const res = await sendMessage(Number(d.id), message)
    if (res.ok) ok++
    else failed++
    results.push({ id: d.id, ok: res.ok, ...(res.ok ? {} : { error: res.error }) })
  }
  await state.ref.set({ sent: { ok, failed, results } }, { merge: true })
  await publish(state.config, true)
  return { ok: true, sent: ok, failed }
}

/** Yangi konkurs: oldingisi tarixga ko'chiriladi. */
export async function giveawayReset(actor: Staff) {
  const db = await adminDb()
  const state = await load()
  const snap = await state.ref.get()
  if (snap.exists) await db.collection('giveaways').add({ ...snap.data(), archivedAt: new Date().toISOString(), archivedBy: actor.name || actor.email })
  await state.ref.delete()
  await db.collection('settings').doc('giveaway').delete()
  return { ok: true }
}

// ─── Bot uchun: ochko, reyting, ishtirok (api/linko-cron.ts ?giveaway=1) ───

/** Hozir konkurs davom etyaptimi. */
const isActive = (c: GiveawayConfig, done: boolean, now = Date.now()) =>
  !done && !!c.startAt && Date.parse(c.startAt) <= now && (!c.endAt || Date.parse(c.endAt) > now)

/** Reytingda to'liq ism emas: «Aziza», username bo'lsa — qisman yashirin. */
function publicName(p: Participant): string {
  const first = p.name.startsWith('@') || p.name.startsWith('ID ') ? '' : p.name.split(/\s+/)[0]
  if (first) return first.slice(0, 18)
  if (p.username) return `@${p.username.slice(0, 3)}***`
  return 'Ishtirokchi'
}

const BOARD_TTL_MS = 3 * 60 * 1000

/**
 * Ochko = imkoniyatlar soni (1 + taklif qilgan yangi do'stlar, cheklovsiz).
 * Ro'yxat 3 daqiqa keshlanadi — har tugma bosishda butun jurnal o'qilmasin.
 */
export async function giveawayBoard(userId: string, join = false) {
  const state = await load()
  const { config } = state
  const done = !!state.confirmedAt
  const active = isActive(config, done)
  const db = await adminDb()

  // Ishtirok: konkurs davomida tugma bosilsa — birinchi marta yoziladi
  let joinedNow = false
  if (join && active && /^\d{3,20}$/.test(userId)) {
    const ref = db.collection('giveaway_entries').doc(userId)
    const snap = await ref.get()
    const fresh = !snap.exists || !config.startAt || String(snap.data()?.createdAt ?? '') < config.startAt
    if (fresh) {
      await ref.set({ telegramUserId: Number(userId), createdAt: new Date().toISOString() })
      joinedNow = true
    }
  }

  const cached = (await state.ref.get()).data()?.board as { at: string; rows: { id: string; name: string; points: number; refs: number }[] } | undefined
  let rows = cached?.rows ?? []
  if (!cached || joinedNow || Date.now() - Date.parse(cached.at) > BOARD_TTL_MS) {
    const list = (await participants(state)).filter((p) => !p.excluded)
    rows = list
      .map((p) => ({ id: p.id, name: publicName(p), points: p.tickets, refs: p.refs }))
      .sort((a, b) => b.points - a.points || b.refs - a.refs)
    await state.ref.set({ board: { at: new Date().toISOString(), rows } }, { merge: true })
  }

  const index = rows.findIndex((r) => r.id === userId)
  const me = index >= 0 ? rows[index] : null
  return {
    exists: !!config.startAt,
    active,
    finished: done,
    title: config.title,
    prize: config.prize,
    startAt: config.startAt,
    endAt: config.endAt,
    winners: config.winners,
    referral: config.referral.enabled,
    participants: rows.length,
    me: me ? { points: me.points, refs: me.refs, rank: index + 1 } : null,
    top: rows.slice(0, 10).map((r) => ({ name: r.name, points: r.points, refs: r.refs })),
    winnersList: done ? state.draws.map((d) => ({ name: publicName({ name: d.name, username: d.username } as Participant) })) : [],
  }
}
