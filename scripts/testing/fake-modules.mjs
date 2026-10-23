/**
 * Server testlari uchun yuklovchi: Firestore (firebase-admin.js) va
 * Telegram (telegram.js) xotiradagi soxta nusxa bilan almashtiriladi.
 *
 *   node --experimental-strip-types --no-warnings \
 *     --import ./scripts/testing/register.mjs ./scripts/testing/<test>.ts
 *
 * Holat: globalThis.__data — { 'orders/o1': {...}, 'users/5': {...} },
 * yuborilgan xabarlar — globalThis.__sent, so'rov uchun foydalanuvchi — __uid.
 * Loyiha importlari `.js` bilan yoziladi — haqiqiy fayl `.ts` ga yo'naltiriladi.
 */
const FIREBASE = String.raw`
  const store = () => (globalThis.__data ??= {})
  let seq = 0
  const newId = () => 'id' + (++seq).toString(36) + Math.random().toString(36).slice(2, 6)

  const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && v.constructor === Object
  const isInc = (v) => v && typeof v === 'object' && v.constructor?.name === 'NumericIncrementTransform'
  const isDel = (v) => v && typeof v === 'object' && v.constructor?.name === 'DeleteTransform'
  function merge(base, data) {
    const out = { ...base }
    for (const [k, v] of Object.entries(data)) {
      if (isDel(v)) delete out[k]
      else if (isInc(v)) out[k] = (Number(out[k]) || 0) + (v.operand ?? 0)
      else if (isPlain(v)) out[k] = merge(isPlain(out[k]) ? out[k] : {}, v)
      else out[k] = v
    }
    return out
  }
  function expandDots(data) {
    const out = {}
    for (const [k, v] of Object.entries(data)) {
      if (!k.includes('.')) { out[k] = v; continue }
      const parts = k.split('.')
      let cur = out
      for (const p of parts.slice(0, -1)) cur = cur[p] = isPlain(cur[p]) ? cur[p] : {}
      cur[parts[parts.length - 1]] = v
    }
    return out
  }
  const strip = (v) => (isInc(v) ? (v.operand ?? 0) : isPlain(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => !isDel(x)).map(([k, x]) => [k, strip(x)])) : v)

  const pathsIn = (coll) => Object.keys(store()).filter((p) => p.startsWith(coll + '/') && p.split('/').length === coll.split('/').length + 1)
  const get = (obj, field) => String(field).split('.').reduce((v, k) => v?.[k], obj)

  function snapOf(path) {
    const data = store()[path]
    return { id: path.split('/').pop(), ref: docRef(path), exists: path in store(), data: () => (data === undefined ? undefined : structuredClone(data)), get: (f) => get(data, f) }
  }
  const match = (data, [field, op, value]) => {
    const a = get(data, field)
    switch (op) {
      case '==': return a === value
      case '!=': return a !== value
      case 'in': return Array.isArray(value) && value.includes(a)
      case 'array-contains': return Array.isArray(a) && a.includes(value)
      case 'array-contains-any': return Array.isArray(a) && value.some((v) => a.includes(v))
      case '<': return a !== undefined && a < value
      case '<=': return a !== undefined && a <= value
      case '>': return a !== undefined && a > value
      case '>=': return a !== undefined && a >= value
      default: return true
    }
  }
  function query(coll, filters = [], max = Infinity, sorts = [], after = null) {
    const run = () => {
      let paths = pathsIn(coll).filter((p) => filters.every((f) => match(store()[p], f)))
      for (const [field, dir] of [...sorts].reverse()) {
        const key = (p) => (field === '__name__' ? p.split('/').pop() : get(store()[p], field))
        paths = paths.sort((x, y) => { const a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : 0) * (dir === 'desc' ? -1 : 1) })
      }
      if (after !== null && sorts.length) paths = paths.filter((p) => { const v = sorts[0][0] === '__name__' ? p.split('/').pop() : get(store()[p], sorts[0][0]); return sorts[0][1] === 'desc' ? v < after : v > after })
      return paths.slice(0, max)
    }
    return {
      where: (...f) => query(coll, [...filters, f], max, sorts, after),
      orderBy: (field, dir = 'asc') => query(coll, filters, max, [...sorts, [field, dir]], after),
      limit: (n) => query(coll, filters, n, sorts, after),
      startAfter: (v) => query(coll, filters, max, sorts, v?.id ?? v),
      select: () => query(coll, filters, max, sorts, after),
      count: () => ({ get: async () => ({ data: () => ({ count: run().length }) }) }),
      get: async () => {
        const docs = run().map(snapOf)
        globalThis.__reads = (globalThis.__reads || 0) + Math.max(1, docs.length)
        return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn) => docs.forEach(fn) }
      },
    }
  }
  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => { globalThis.__reads = (globalThis.__reads || 0) + 1; return snapOf(path) },
      set: async (data, opts) => { store()[path] = opts?.merge ? merge(store()[path] ?? {}, expandDots(data)) : strip(data) },
      update: async (data) => { if (!(path in store())) throw new Error('NOT_FOUND ' + path); store()[path] = merge(store()[path], expandDots(data)) },
      create: async (data) => { if (path in store()) throw new Error('ALREADY_EXISTS ' + path); store()[path] = strip(data) },
      delete: async () => { delete store()[path] },
      collection: (name) => collection(path + '/' + name),
    }
  }
  function collection(name) {
    return {
      ...query(name),
      id: name.split('/').pop(),
      doc: (id) => docRef(name + '/' + (id ?? newId())),
      add: async (data) => { const id = newId(); store()[name + '/' + id] = strip(data); globalThis.__adds?.push({ coll: name, id, data }); return docRef(name + '/' + id) },
    }
  }
  const getAll = async (...refs) => refs.map((r) => snapOf(r.path))
  const db = {
    collection,
    doc: (path) => docRef(path),
    getAll,
    runTransaction: async (fn) => {
      const tx = {
        get: async (refOrQuery) => (refOrQuery.path && refOrQuery.collection ? snapOf(refOrQuery.path) : refOrQuery.get()),
        getAll,
        set: (ref, data, opts) => { ref.set(data, opts) },
        update: (ref, data) => { ref.update(data) },
        create: (ref, data) => { ref.create(data) },
        delete: (ref) => { ref.delete() },
      }
      return fn(tx)
    },
    batch: () => {
      const ops = []
      const b = { set: (r, d, o) => (ops.push(() => r.set(d, o)), b), update: (r, d) => (ops.push(() => r.update(d)), b), delete: (r) => (ops.push(() => r.delete()), b), commit: async () => { for (const op of ops) await op() } }
      return b
    },
    listCollections: async () => [...new Set(Object.keys(store()).map((p) => p.split('/')[0]))].map((n) => ({ id: n })),
  }
  export async function adminDb() { return db }
  export async function adminAuth() {
    return {
      verifyIdToken: async () => ({ uid: globalThis.__uid || '555' }),
      createCustomToken: async (uid) => 'token-' + uid,
      getUser: async (uid) => ({ uid }),
    }
  }
  export async function adminBucket() {
    const file = (name) => ({ name, save: async () => {}, makePublic: async () => {}, delete: async () => {}, getSignedUrl: async () => ['https://example.test/' + name], publicUrl: () => 'https://example.test/' + name })
    return { name: 'test-bucket', file }
  }
`

const TELEGRAM = String.raw`
  const sent = () => (globalThis.__sent ??= [])
  let mid = 1000
  export function escapeHtml(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
  export async function sendMessage(chatId, text, buttons, callbackButtons) {
    if (globalThis.__blocked?.includes(Number(chatId))) return { ok: false, error: 'Forbidden: bot was blocked by the user' }
    sent().push({ kind: 'message', chatId, text, buttons, callbackButtons })
    return { ok: true, messageId: ++mid }
  }
  export async function sendRows(chatId, text, rows) { sent().push({ kind: 'rows', chatId, text, rows }); return { ok: true, messageId: ++mid } }
  export async function sendMedia(chatId, kind, file, caption, rows) { sent().push({ kind: 'media', chatId, file, caption, rows }); return { ok: true, messageId: ++mid } }
  export async function editMessage(chatId, messageId, text, rows) { sent().push({ kind: 'edit', chatId, messageId, text, rows }); return true }
  export async function replaceButtons(chatId, messageId, label) { sent().push({ kind: 'replace', chatId, messageId, label }); return true }
  export async function deleteMessage(chatId, messageId) { sent().push({ kind: 'delete', chatId, messageId }); return true }
  export async function setKeyboard(chatId, messageId, rows) { sent().push({ kind: 'keyboard', chatId, messageId, rows }); return true }
  export async function sendBulk(ids, text) { for (const id of ids) sent().push({ kind: 'bulk', chatId: id, text }); return { sent: ids.length, failed: 0 } }
  export async function telegramCall(method, body) { sent().push({ kind: 'call', method, body }); return { ok: true, result: {} } }
`

export async function resolve(specifier, context, next) {
  const stub = specifier.endsWith('firebase-admin.js') ? FIREBASE : specifier.endsWith('/telegram.js') || specifier === './telegram.js' ? TELEGRAM : null
  if (stub) return { url: 'data:text/javascript,' + encodeURIComponent(stub), shortCircuit: true }
  if (specifier.startsWith('.') && specifier.endsWith('.js') && !String(context.parentURL || '').includes('node_modules')) {
    return next(specifier.replace(/\.js$/, '.ts'), context)
  }
  return next(specifier, context)
}
