import { CalendarClock, Eye, Loader2, Radio, Send, Smartphone, Sparkles, TriangleAlert, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { apiPost } from '../lib/api'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

/**
 * Kunlik e’lon: har kuni belgilangan soatda 4 ta tasodifiy mahsulot
 * bir xil shablondagi rasmda bot foydalanuvchilariga va/yoki kanalga.
 * Server: api/_lib/actions/daily.ts (rasm — api/_lib/daily/card.ts).
 */

type Settings = {
  enabled: boolean
  time: string
  customers: boolean
  channel: boolean
  title: string
  accent: string
  text: string
  textRu: string
  button: string
  buttonRu: string
}
type State = Settings & {
  lastDay: string | null
  lastImage: string | null
  lastRunAt: string | null
  lastError: string | null
}
type Job = {
  status: string
  runAt: string
  sent: number
  failed: number
  channelLink: string | null
  channelError: string | null
  error: string | null
}
type Info = { settings: State; job: Job | null; today: string; now: string }
type Preview = { image: string; text: string; textRu: string }

const JOB_STATUS: Record<string, string> = {
  pending: 'navbatda',
  running: 'yuborilmoqda',
  done: 'yuborildi',
  failed: 'xato',
  cancelled: 'bekor qilindi',
}

const pickSettings = (s: State): Settings => ({
  enabled: s.enabled, time: s.time, customers: s.customers, channel: s.channel,
  title: s.title, accent: s.accent, text: s.text, textRu: s.textRu, button: s.button, buttonRu: s.buttonRu,
})

/** «2026-10-01» → «01.10.2026». */
const day = (value: string | null) => (value ? `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}` : '—')

export function DailyPicksPage() {
  const { show, node: toast } = useToast()
  const [info, setInfo] = useState<Info | null>(null)
  const [draft, setDraft] = useState<Settings | null>(null)
  const [busy, setBusy] = useState<'' | 'save' | 'preview' | 'test' | 'send'>('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmSend, setConfirmSend] = useState(false)

  const load = useCallback(async () => {
    try {
      const next = await apiPost<Info>('action', { action: 'daily.get' })
      setInfo(next)
      setDraft((d) => d ?? pickSettings(next.settings))
    } catch (error) {
      show(error instanceof Error ? error.message : 'Yuklanmadi', 'error')
    }
  }, [show])

  useEffect(() => {
    let alive = true
    apiPost<Info>('action', { action: 'daily.get' })
      .then((next) => {
        if (!alive) return
        setInfo(next)
        setDraft(pickSettings(next.settings))
      })
      .catch((e: unknown) => { if (alive) show(e instanceof Error ? e.message : 'Yuklanmadi', 'error') })
    return () => { alive = false }
  }, [show])

  if (!info || !draft) {
    return (
      <div className="grid gap-3">
        <div className="adm-skeleton h-32" />
        <div className="adm-skeleton h-72" />
        {toast}
      </div>
    )
  }

  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch })
  const saved = pickSettings(info.settings)
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)

  const run = async <T,>(kind: typeof busy, action: string, done: (r: T) => void) => {
    setBusy(kind)
    try {
      done(await apiPost<T>('action', { action, settings: draft }))
    } catch (error) {
      show(error instanceof Error ? error.message : 'Bajarilmadi', 'error')
    } finally {
      setBusy('')
    }
  }

  const save = () =>
    run<Info>('save', 'daily.save', (next) => {
      setInfo(next)
      setDraft(pickSettings(next.settings))
      show(next.settings.enabled ? `Saqlandi — har kuni ${next.settings.time} da yuboriladi` : 'Saqlandi (o‘chiq)')
    })

  const job = info.job
  const sentToday = info.settings.lastDay === info.today

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 content-start gap-4">
        {/* ── Holat va vaqt ── */}
        <section className="adm-card grid gap-3 p-4">
          <Toggle
            icon={<CalendarClock size={18} />}
            label={draft.enabled ? 'Kunlik e’lon yoqilgan' : 'Kunlik e’lonni yoqish'}
            hint={draft.enabled ? `Har kuni ${draft.time} da avtomatik yuboriladi` : 'Yoqilmaguncha hech narsa yuborilmaydi'}
            checked={draft.enabled}
            onChange={(enabled) => set({ enabled })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="adm-label m-0" htmlFor="daily-time">Yuborish vaqti</label>
            <input
              id="daily-time"
              type="time"
              className="adm-input"
              style={{ width: 130 }}
              value={draft.time}
              onChange={(e) => set({ time: e.target.value })}
            />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Toshkent vaqti · hozir {info.now}</span>
          </div>
          <p className="adm-label m-0 mt-1">Kimga yuborilsin</p>
          <Toggle
            icon={<Users size={18} />}
            label="Bot foydalanuvchilari"
            hint="Botni ishga tushirgan barcha mijozlarga shaxsiy xabar"
            checked={draft.customers}
            onChange={(customers) => set({ customers })}
          />
          <Toggle
            icon={<Radio size={18} />}
            label="Telegram kanal"
            hint="«Telegram kanal» bo‘limida ulangan kanalga post"
            checked={draft.channel}
            onChange={(channel) => set({ channel })}
          />
        </section>

        {/* ── Matnlar ── */}
        <section className="adm-card grid gap-3 p-4">
          <h3 className="flex items-center gap-2 text-sm font-extrabold"><Sparkles size={16} /> Rasmdagi sarlavha</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Oq qator" value={draft.title} max={40} onChange={(title) => set({ title })} />
            <Field label="Sariq qator" value={draft.accent} max={40} onChange={(accent) => set({ accent })} />
          </div>
          <h3 className="mt-2 text-sm font-extrabold">Xabar matni</h3>
          <p className="-mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            Ostiga 4 ta mahsulot nomi va narxi avtomatik qo‘shiladi. HTML: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;qiya&lt;/i&gt;.
          </p>
          <Area label="O‘zbekcha" value={draft.text} onChange={(text) => set({ text })} />
          <Area label="Ruscha (ixtiyoriy — rus tilini tanlaganlarga)" value={draft.textRu} onChange={(textRu) => set({ textRu })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tugma (o‘zbekcha)" value={draft.button} max={40} onChange={(button) => set({ button })} />
            <Field label="Tugma (ruscha)" value={draft.buttonRu} max={40} onChange={(buttonRu) => set({ buttonRu })} />
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <button className="adm-btn adm-btn--primary" onClick={() => void save()} disabled={!!busy || !dirty}>
            {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : null} Saqlash
          </button>
          <button className="adm-btn adm-btn--ghost" onClick={() => void run<Preview>('preview', 'daily.preview', setPreview)} disabled={!!busy}>
            {busy === 'preview' ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Namunani ko‘rish
          </button>
          <button className="adm-btn adm-btn--ghost" onClick={() => void run<{ sent: number }>('test', 'daily.test', () => show('Telegram’ingizga yuborildi'))} disabled={!!busy}>
            {busy === 'test' ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />} Menga sinab yuborish
          </button>
          <button className="adm-btn adm-btn--ghost" onClick={() => setConfirmSend(true)} disabled={!!busy}>
            {busy === 'send' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Hozir hammaga
          </button>
        </div>
        {dirty && <p className="text-xs font-bold" style={{ color: 'var(--warning)' }}>O‘zgarishlar hali saqlanmagan.</p>}
      </div>

      {/* ── Oxirgi yuborish ── */}
      <aside className="adm-card grid content-start gap-3 p-4">
        <h3 className="text-sm font-extrabold">Oxirgi yuborish</h3>
        {info.settings.lastImage ? (
          <a href={info.settings.lastImage} target="_blank" rel="noreferrer">
            <img src={info.settings.lastImage} alt="" className="w-full rounded-xl" />
          </a>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Hali yuborilmagan.</p>
        )}
        <dl className="grid gap-1.5 text-sm">
          <Row label="Sana" value={day(info.settings.lastDay)} />
          <Row label="Bugun" value={sentToday ? 'yuborilgan' : info.settings.enabled ? `${info.settings.time} da yuboriladi` : 'o‘chiq'} />
          {job && <Row label="Holati" value={JOB_STATUS[job.status] ?? job.status} />}
          {job && <Row label="Mijozlarga" value={`${job.sent} ta${job.failed ? ` · ${job.failed} ta yetmadi` : ''}`} />}
          {job?.channelLink && (
            <Row label="Kanal" value={<a href={job.channelLink} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>postni ochish</a>} />
          )}
        </dl>
        {[info.settings.lastError, job?.error, job?.channelError].filter(Boolean).map((e) => (
          <p key={String(e)} className="flex gap-2 rounded-xl p-2.5 text-xs font-semibold" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <TriangleAlert size={14} className="shrink-0" /> {e}
          </p>
        ))}
        <button className="adm-btn adm-btn--ghost" onClick={() => void load()}>Yangilash</button>
      </aside>

      {preview && (
        <Modal title="Namuna" onClose={() => setPreview(null)} wide>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <img src={preview.image} alt="" className="w-full rounded-xl" />
            <div className="grid content-start gap-3">
              <div className="whitespace-pre-wrap rounded-xl p-3 text-sm" style={{ background: 'var(--surface-2)' }} dangerouslySetInnerHTML={{ __html: preview.text }} />
              {preview.textRu && (
                <div className="whitespace-pre-wrap rounded-xl p-3 text-sm" style={{ background: 'var(--surface-2)' }} dangerouslySetInnerHTML={{ __html: preview.textRu }} />
              )}
              <span className="rounded-xl p-2.5 text-center text-sm font-bold" style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}>{draft.button}</span>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Mahsulotlar har safar tasodifiy tanlanadi — haqiqiy e’londa boshqalari chiqadi.</p>
            </div>
          </div>
        </Modal>
      )}

      {confirmSend && (
        <ConfirmDialog
          title="Hozir hammaga yuborilsinmi?"
          message={`${[draft.customers && 'bot foydalanuvchilariga', draft.channel && 'kanalga'].filter(Boolean).join(' va ') || 'hech qayerga'} hozir yuboriladi. Bugungi avtomatik yuborish shu bilan almashadi.`}
          confirmLabel="Yuborish"
          onClose={() => setConfirmSend(false)}
          onConfirm={() => {
            setConfirmSend(false)
            void run<Info & { queued: string }>('send', 'daily.send', (next) => {
              setInfo(next)
              show('Navbatga qo‘yildi — bir daqiqa ichida yuboriladi')
            })
          }}
        />
      )}
      {toast}
    </div>
  )
}

function Toggle({ icon, label, hint, checked, onChange }: { icon: React.ReactNode; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="adm-ch-toggle">
      <span className="adm-ch-toggle__icon">{icon}</span>
      <span className="min-w-0 flex-1">
        <b>{label}</b>
        <span>{hint}</span>
      </span>
      <input type="checkbox" className="adm-ch-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Field({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="adm-label m-0">{label}</span>
      <input className="adm-input" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="adm-label m-0">{label}</span>
      <textarea className="adm-input" rows={4} maxLength={700} value={value} onChange={(e) => onChange(e.target.value)} style={{ resize: 'vertical' }} />
    </label>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  )
}
