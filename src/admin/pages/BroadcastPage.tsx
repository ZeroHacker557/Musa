import { CheckCircle2, Megaphone, Search, Send, Users, XCircle } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { apiPost } from '../lib/api'
import { useCategories, useCustomers, useOrders, useProducts, type CustomerRow } from '../lib/live'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'

/**
 * Kimga yuboriladi.
 *
 * Qabul qiluvchilar ro'yxati shu yerda — admin panelda — hisoblanadi:
 * mijozlar va buyurtmalar allaqachon jonli yuklangan, shuning uchun
 * «nechta odamga boradi» yuborishdan OLDIN aniq ko'rinadi. Serverga
 * tayyor identifikatorlar bo'laklab ketadi, server esa ular bazada
 * borligini tekshiradi.
 */
type Audience = 'all' | 'buyers' | 'never' | 'category' | 'product' | 'lapsed' | 'active' | 'manual'

const AUDIENCES: { key: Audience; label: string; hint: string }[] = [
  { key: 'all', label: 'Hamma', hint: 'Botni ishga tushirgan barcha foydalanuvchilar' },
  { key: 'buyers', label: 'Xarid qilganlar', hint: 'Kamida bitta buyurtma bergan mijozlar' },
  { key: 'never', label: 'Hali xarid qilmaganlar', hint: 'Botga kirgan, lekin buyurtma bermaganlar — birinchi xaridga undash uchun' },
  { key: 'category', label: 'Kategoriya bo‘yicha', hint: 'Tanlangan kategoriyadan xarid qilganlar' },
  { key: 'product', label: 'Mahsulot bo‘yicha', hint: 'Aniq mahsulotni olganlar — masalan yangi ta’mi chiqqanda' },
  { key: 'lapsed', label: 'Uzoq vaqt buyurtma bermaganlar', hint: 'Avval olgan, lekin so‘nggi kunlarda qaytmaganlar — «sizni sog‘indik»' },
  { key: 'active', label: 'Yaqinda ilovaga kirganlar', hint: 'So‘nggi kunlarda ilovani ochganlar' },
  { key: 'manual', label: 'Qo‘lda tanlash', hint: 'Ro‘yxatdan kerakli mijozlarni belgilang' },
]

type Progress = { sent: number; failed: number; skipped: number; processed: number }

const DAY = 24 * 60 * 60 * 1000
const CHUNK = 25
const displayName = (c: CustomerRow) =>
  [c.first_name, c.last_name].filter(Boolean).join(' ') || (c.username ? `@${c.username}` : `ID ${c.id}`)

export function BroadcastPage() {
  const { customers } = useCustomers()
  const { orders } = useOrders()
  const { products } = useProducts()
  const { categories } = useCategories()
  const { show, node: toast } = useToast()

  const [text, setText] = useState('')
  /** Ruscha matn — bo'sh qolsa ruschada ham o'zbekchasi ketadi. */
  const [textRu, setTextRu] = useState('')
  const [audience, setAudience] = useState<Audience>('all')
  const [pickedCategories, setPickedCategories] = useState<string[]>([])
  const [pickedProducts, setPickedProducts] = useState<string[]>([])
  const [manual, setManual] = useState<string[]>([])
  const [days, setDays] = useState('30')
  const [search, setSearch] = useState('')

  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const cancelled = useRef(false)
  // «Necha kun» hisobi uchun sahifa ochilgan vaqt — sahifada kun almashishi muhim emas
  const [now] = useState(() => Date.now())

  // Mijoz → uning (bekor qilinmagan) buyurtmalari
  const history = useMemo(() => {
    const map = new Map<string, { last: number; categories: Set<string>; products: Set<string> }>()
    for (const o of orders) {
      if (o.status === 'Bekor qilingan' || o.status === 'Rad etildi' || !o.userId) continue
      const key = String(o.userId)
      const entry = map.get(key) ?? { last: 0, categories: new Set(), products: new Set() }
      entry.last = Math.max(entry.last, Date.parse(String(o.createdAt)) || 0)
      for (const item of o.products || []) {
        if (item.product?.category) entry.categories.add(item.product.category)
        if (item.product?.id !== undefined) entry.products.add(String(item.product.id))
      }
      map.set(key, entry)
    }
    return map
  }, [orders])

  const recipients = useMemo(() => {
    const period = Math.max(1, Number(days) || 30) * DAY
    return customers.filter((c) => {
      const h = history.get(c.id)
      switch (audience) {
        case 'buyers': return Boolean(h)
        case 'never': return !h
        case 'category': return Boolean(h) && pickedCategories.some((name) => h!.categories.has(name))
        case 'product': return Boolean(h) && pickedProducts.some((id) => h!.products.has(id))
        case 'lapsed': return Boolean(h) && now - h!.last > period
        case 'active': return (Date.parse(String(c.lastActive || '')) || 0) > now - period
        case 'manual': return manual.includes(c.id)
        default: return true
      }
    })
  }, [customers, history, audience, pickedCategories, pickedProducts, manual, days, now])

  const start = async () => {
    setConfirming(false)
    setRunning(true)
    cancelled.current = false
    const ids = recipients.map((c) => c.id)
    const totals: Progress = { sent: 0, failed: 0, skipped: 0, processed: 0 }
    setProgress({ ...totals })

    try {
      for (let i = 0; i < ids.length && !cancelled.current; i += CHUNK) {
        const result = await apiPost<Progress>('action', {
          action: 'broadcast.send',
          text,
          textRu,
          recipients: ids.slice(i, i + CHUNK),
        })
        totals.sent += result.sent
        totals.failed += result.failed
        totals.skipped += result.skipped
        totals.processed += result.processed
        setProgress({ ...totals })
      }
      show(
        cancelled.current
          ? `To‘xtatildi — ${totals.sent} ta yuborildi`
          : `Tayyor: ${totals.sent} ta yuborildi, ${totals.failed} ta yetmadi`,
      )
    } catch (error) {
      show(error instanceof Error ? error.message : 'Yuborishda xato', 'error')
    } finally {
      setRunning(false)
    }
  }

  const toggle = (list: string[], set: (next: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const needle = search.trim().toLowerCase()
  const productOptions = products
    .filter((p) => !needle || p.name.toLowerCase().includes(needle))
    .slice(0, 60)
  const customerOptions = customers
    .filter((c) => !needle || displayName(c).toLowerCase().includes(needle) || String(c.phone || '').includes(needle))
    .slice(0, 80)

  const blocked = running || !text.trim() || recipients.length === 0

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="adm-card p-4 sm:p-5">
          <label className="adm-label" htmlFor="broadcast-text">Xabar matni</label>
          <textarea
            id="broadcast-text"
            className="adm-input"
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'🎉 Yangi mahsulot!\n\nMUSA plombiri endi katalogda. Buyurtma bering — tez yetkazamiz.'}
            disabled={running}
            maxLength={3500}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>
              HTML: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;qiya&lt;/i&gt;, &lt;a href=""&gt;havola&lt;/a&gt;
            </p>
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{text.length} / 3500</p>
          </div>

          {/* Ruscha matn: mijoz botda yoki ilovada rus tilini tanlagan
              bo'lsa shu ketadi. Bo'sh qolsa — hammaga o'zbekchasi. */}
          <label className="adm-label mt-4" htmlFor="broadcast-text-ru">Xabar matni (ruscha)</label>
          <textarea
            id="broadcast-text-ru"
            className="adm-input"
            rows={7}
            value={textRu}
            onChange={(e) => setTextRu(e.target.value)}
            placeholder={'🎉 Новинка!\n\nПломбир MUSA уже в каталоге. Закажите — доставим быстро.'}
            disabled={running}
            maxLength={3500}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>
              Bo‘sh qoldirilsa, rus tilidagi mijozlarga ham o‘zbekcha matn boradi
            </p>
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{textRu.length} / 3500</p>
          </div>

          <p className="adm-label mt-4">Kimga</p>
          <div className="adm-audience">
            {AUDIENCES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={'adm-audience__item ' + (audience === item.key ? 'active' : '')}
                onClick={() => { setAudience(item.key); setSearch('') }}
                disabled={running}
                aria-pressed={audience === item.key}
              >
                <b>{item.label}</b>
                <span>{item.hint}</span>
              </button>
            ))}
          </div>

          {audience === 'category' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={String(c.id)}
                  type="button"
                  className={'adm-chip ' + (pickedCategories.includes(c.name) ? 'active' : '')}
                  onClick={() => toggle(pickedCategories, setPickedCategories, c.name)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {(audience === 'lapsed' || audience === 'active') && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span style={{ color: 'var(--muted)' }}>{audience === 'lapsed' ? 'Oxirgi buyurtmadan beri' : 'So‘nggi'}</span>
              <input
                className="adm-input w-24 text-center"
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 3))}
                aria-label="Kun"
              />
              <span style={{ color: 'var(--muted)' }}>{audience === 'lapsed' ? 'kundan ko‘p o‘tganlar' : 'kun ichida kirganlar'}</span>
            </div>
          )}

          {(audience === 'product' || audience === 'manual') && (
            <div className="mt-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--faint)' }} />
                <input
                  className="adm-input icon-left"
                  placeholder={audience === 'product' ? 'Mahsulot qidirish...' : 'Ism yoki telefon bo‘yicha qidirish...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="adm-picklist">
                {audience === 'product'
                  ? productOptions.map((p) => (
                    <label key={p.docId}>
                      <input
                        type="checkbox"
                        checked={pickedProducts.includes(p.docId)}
                        onChange={() => toggle(pickedProducts, setPickedProducts, p.docId)}
                      />
                      <span className="truncate">{p.name}</span>
                      <small>{p.category}</small>
                    </label>
                  ))
                  : customerOptions.map((c) => (
                    <label key={c.id}>
                      <input type="checkbox" checked={manual.includes(c.id)} onChange={() => toggle(manual, setManual, c.id)} />
                      <span className="truncate">{displayName(c)}</span>
                      <small>{c.phone || (history.get(c.id) ? 'xaridor' : '')}</small>
                    </label>
                  ))}
              </div>
              {audience === 'manual' && (
                <div className="mt-2 flex gap-2 text-xs">
                  <button type="button" className="adm-link" onClick={() => setManual([...new Set([...manual, ...customerOptions.map((c) => c.id)])])}>
                    Ko‘rinayotganlarni belgilash
                  </button>
                  <button type="button" className="adm-link" onClick={() => setManual([])}>Tozalash</button>
                </div>
              )}
            </div>
          )}

          <button
            className="adm-btn adm-btn--primary mt-4 w-full py-3"
            onClick={() => setConfirming(true)}
            disabled={blocked}
          >
            <Send size={17} />
            {running ? 'Yuborilmoqda...' : recipients.length ? `${recipients.length} ta mijozga yuborish` : 'Qabul qiluvchi yo‘q'}
          </button>

          {running && (
            <button className="adm-btn adm-btn--ghost mt-2 w-full" onClick={() => { cancelled.current = true }}>
              To‘xtatish
            </button>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="adm-card p-4">
            <h2 className="text-sm font-extrabold">Ko‘rinishi</h2>
            <div
              className="mt-3 whitespace-pre-wrap rounded-2xl rounded-tl-sm p-3 text-sm"
              style={{ background: 'var(--brand-soft)', color: 'var(--ink)' }}
            >
              {text.trim() || 'Xabar matni shu yerda ko‘rinadi...'}
            </div>
          </div>

          <div className="adm-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <Users size={16} /> Qabul qiluvchilar
              <span className="ml-auto text-lg font-extrabold" style={{ color: 'var(--brand)' }}>{recipients.length}</span>
            </h2>
            {recipients.length ? (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {recipients.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">{displayName(c)}</span>
                    <span className="shrink-0 text-xs" style={{ color: 'var(--faint)' }}>{c.phone || ''}</span>
                  </li>
                ))}
                {recipients.length > 8 && (
                  <li className="text-xs" style={{ color: 'var(--muted)' }}>… va yana {recipients.length - 8} ta</li>
                )}
              </ul>
            ) : (
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                Tanlangan shartga mos mijoz yo‘q. Boshqa guruh yoki filtrni tanlang.
              </p>
            )}
          </div>

          {progress && (
            <div className="adm-card p-4">
              <h2 className="text-sm font-extrabold">Jarayon</h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Line icon={<CheckCircle2 size={15} />} label="Yuborildi" value={progress.sent} tone="var(--brand)" />
                <Line icon={<XCircle size={15} />} label="Yetmadi — bot bloklangan" value={progress.failed} tone="var(--danger)" />
                <Line icon={<Megaphone size={15} />} label="O‘tkazib yuborildi" value={progress.skipped} tone="var(--muted)" />
              </div>
              {running && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'var(--brand)',
                      width: `${Math.min(100, (progress.processed / Math.max(1, recipients.length)) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Ommaviy xabar yuborilsinmi?"
          message={`Xabar ${recipients.length} ta mijozga boradi. Yuborilgan xabarni qaytarib bo‘lmaydi.`}
          confirmLabel="Ha, yuborilsin"
          onConfirm={start}
          onClose={() => setConfirming(false)}
        />
      )}

      {toast}
    </>
  )
}

function Line({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: tone }}>{icon}</span>
      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-extrabold">{value}</span>
    </div>
  )
}
