import { Check, Gift, Loader2, RefreshCw, RotateCcw, Send, Trophy, UserX, Users } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost } from '../lib/api'
import { useToast } from '../components/Toast'

/**
 * Konkurs: botda START bosganlar orasidan g'oliblarni baraban bilan
 * aniqlash. Natija SERVERDA tanlanadi (api/_lib/actions/giveaway.ts),
 * baraban faqat ko'rsatadi. «Tasdiqlayman» — g'oliblarga bot xabari.
 */

type Config = {
  title: string
  prize: string
  startAt: string | null
  endAt: string | null
  winners: number
  referral: { enabled: boolean }
  messageUz: string
  messageRu: string
}
type Participant = { id: string; name: string; username: string | null; starts: number; firstAt: string; isNew: boolean; refs: number; tickets: number; excluded: boolean }
type Draw = { id: string; name: string; username: string | null; tickets: number; at: string }
type State = {
  config: Config
  draws: Draw[]
  confirmedAt: string | null
  sent: { ok: number; failed: number } | null
  participants: Participant[]
  stats: { people: number; tickets: number; newUsers: number; refs: number }
}
type WheelName = { id: string; name: string; username: string | null }

const BOT = 'musauz_bot'
const COLORS = ['#0a7a3d', '#ffd43b', '#14a352', '#f5b800', '#05542a', '#ffe27a']

/** ISO → <input type="datetime-local"> (brauzer vaqti — Toshkent). */
const toLocal = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null)
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const short = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Ertangi kun 00:00 (brauzer vaqti). */
function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function GiveawayPage({ owner }: { owner: boolean }) {
  const { show, node: toast } = useToast()
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState('')
  const [form, setForm] = useState<Config | null>(null)

  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    let alive = true
    apiPost<State>('action', { action: 'giveaway.get' })
      .then((s) => {
        if (!alive) return
        setState(s)
        setForm((f) => f ?? { ...s.config, startAt: s.config.startAt ?? tomorrow() })
      })
      .catch((e: unknown) => { if (alive) show(e instanceof Error ? e.message : 'Yuklanmadi', 'error') })
    return () => { alive = false }
  }, [tick, show])

  const run = async (key: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(key)
    try {
      const res = await apiPost<Record<string, unknown>>('action', body)
      if (ok) show(ok)
      load()
      return res
    } catch (e) {
      show(e instanceof Error ? e.message : 'Bajarilmadi', 'error')
      return null
    } finally {
      setBusy('')
    }
  }

  if (!state || !form) {
    return <div className="adm-card flex items-center gap-2 p-6"><Loader2 size={18} className="animate-spin" /> Yuklanmoqda…</div>
  }
  const done = !!state.confirmedAt
  const set = <K extends keyof Config>(k: K, v: Config[K]) => setForm({ ...form, [k]: v })

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Wheel state={state} busy={busy} onDraw={() => run('draw', { action: 'giveaway.draw' })} onUndo={() => run('undo', { action: 'giveaway.undo' }, 'Oxirgi g‘olib bekor qilindi')}
          onConfirm={async () => {
            const names = state.draws.map((d, i) => `${i + 1}. ${d.name}${d.username ? ` (@${d.username})` : ''}`).join('\n')
            if (!window.confirm(`Quyidagi g‘oliblarga «Siz yutdingiz» xabari yuboriladi:\n\n${names}\n\nTasdiqlaysizmi? Bu amalni qaytarib bo‘lmaydi.`)) return
            const r = await run('confirm', { action: 'giveaway.confirm' })
            if (r) show(`Xabar yuborildi: ${r.sent} ta${Number(r.failed) ? `, yetib bormadi: ${r.failed} ta` : ''}`)
          }}
          owner={owner}
        />

        {/* Sozlamalar */}
        <section className="adm-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold"><Gift size={17} /> Konkurs sozlamalari</h2>
          <fieldset disabled={!owner || done} className="mt-3 grid gap-3">
            <label className="adm-label">Nomi<input className="adm-input mt-1" value={form.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label className="adm-label">Sovg‘a<input className="adm-input mt-1" value={form.prize} onChange={(e) => set('prize', e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="adm-label">Boshlanadi<input type="datetime-local" className="adm-input mt-1" value={toLocal(form.startAt)} onChange={(e) => set('startAt', fromLocal(e.target.value))} /></label>
              <label className="adm-label">Tugaydi (bo‘sh — hozirgacha)<input type="datetime-local" className="adm-input mt-1" value={toLocal(form.endAt)} onChange={(e) => set('endAt', fromLocal(e.target.value))} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="adm-label">G‘oliblar soni<input type="number" min={1} max={50} className="adm-input mt-1" value={form.winners} onChange={(e) => set('winners', Number(e.target.value))} /></label>
            </div>
            <label className="adm-ch-toggle">
              <span className="adm-ch-toggle__icon"><Users size={18} /></span>
              <span className="min-w-0 flex-1">
                <b>{form.referral.enabled ? 'Do‘st taklifi hisobga olinadi' : 'Do‘st taklifi hisobga olinmaydi'}</b>
                <span>Har bir taklif qilingan YANGI do‘st (mini app’ni ochgan) — +1 imkoniyat, cheklovsiz. Havola: t.me/{BOT}?start=ref_&lt;ID&gt;</span>
              </span>
              <input type="checkbox" className="adm-ch-switch" checked={form.referral.enabled} onChange={(e) => set('referral', { ...form.referral, enabled: e.target.checked })} />
            </label>
            <label className="adm-label">G‘olibga xabar (o‘zbekcha) — {'{name}'}, {'{prize}'}<textarea className="adm-input mt-1" rows={4} value={form.messageUz} onChange={(e) => set('messageUz', e.target.value)} /></label>
            <label className="adm-label">G‘olibga xabar (ruscha)<textarea className="adm-input mt-1" rows={4} value={form.messageRu} onChange={(e) => set('messageRu', e.target.value)} /></label>
            {owner && !done && (
              <button className="adm-btn adm-btn--primary" disabled={!!busy} onClick={() => run('save', { action: 'giveaway.save', ...form }, 'Saqlandi')}>
                {busy === 'save' && <Loader2 size={16} className="animate-spin" />} Saqlash
              </button>
            )}
          </fieldset>
          {owner && done && (
            <button className="adm-btn adm-btn--ghost mt-3 w-full" disabled={!!busy} onClick={() => window.confirm('Joriy konkurs tarixga ko‘chiriladi va yangisi boshlanadi. Davom etasizmi?') && run('reset', { action: 'giveaway.reset' }, 'Yangi konkurs').then(() => setForm(null))}>
              <RotateCcw size={15} /> Yangi konkurs
            </button>
          )}
          {!owner && <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Sozlamalarni faqat ega o‘zgartiradi.</p>}
        </section>
      </div>

      {/* Ishtirokchilar */}
      <section className="adm-card mt-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold"><Users size={17} /> Ishtirokchilar</h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{when(state.config.startAt)} → {state.config.endAt ? when(state.config.endAt) : 'hozirgacha'}</span>
          <button className="adm-btn adm-btn--ghost ml-auto" onClick={load}><RefreshCw size={15} /> Yangilash</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['Ishtirokchi', state.stats.people], ['Imkoniyatlar', state.stats.tickets], ['Yangi foydalanuvchi', state.stats.newUsers], ['Do‘st takliflari', state.stats.refs]].map(([l, v]) => (
            <div key={l} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-2)' }}>
              <p className="text-xl font-extrabold">{v}</p><p className="text-xs" style={{ color: 'var(--muted)' }}>{l}</p>
            </div>
          ))}
        </div>
        {!state.config.startAt ? (
          <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>Boshlanish vaqtini saqlang — shundan keyingi barcha START lar ishtirokchi bo‘ladi.</p>
        ) : state.participants.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>Hali ishtirokchi yo‘q.</p>
        ) : (
          <div className="mt-3 max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs" style={{ color: 'var(--muted)' }}><th className="py-2">Ism</th><th>Kirgan</th><th className="text-center">START</th><th className="text-center">Takliflar</th><th className="text-center">Imkoniyat</th><th /></tr></thead>
              <tbody>
                {state.participants.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: 'var(--line-soft)', opacity: p.excluded ? 0.45 : 1 }}>
                    <td className="py-2"><b>{p.name}</b> {p.isNew && <span className="ml-1 rounded px-1.5 text-[10px] font-bold" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>YANGI</span>}<br /><span className="text-xs" style={{ color: 'var(--muted)' }}>{p.username ? `@${p.username}` : `ID ${p.id}`}</span></td>
                    <td className="text-xs">{when(p.firstAt)}</td>
                    <td className="text-center">{p.starts}</td>
                    <td className="text-center">{p.refs}</td>
                    <td className="text-center font-extrabold">{p.tickets}</td>
                    <td className="text-right">
                      {!done && (
                        <button className="adm-btn adm-btn--ghost" title={p.excluded ? 'Qaytarish' : 'Konkursdan chiqarish (xodim, test akkaunt)'} disabled={!!busy} onClick={() => run('ex' + p.id, { action: 'giveaway.exclude', id: p.id, excluded: !p.excluded })}>
                          {p.excluded ? <Check size={14} /> : <UserX size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {toast}
    </>
  )
}

/** Baraban: server tanlagan g'olibda to'xtaydi. */
function Wheel({ state, busy, onDraw, onUndo, onConfirm, owner }: {
  state: State; busy: string; onDraw: () => Promise<Record<string, unknown> | null>; onUndo: () => void; onConfirm: () => void; owner: boolean
}) {
  const [names, setNames] = useState<WheelName[]>(() => state.participants.filter((p) => !p.excluded).slice(0, 16))
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [reveal, setReveal] = useState<Draw | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const done = !!state.confirmedAt
  const full = state.draws.length >= state.config.winners
  const seg = names.length ? 360 / names.length : 360

  const spin = async () => {
    setReveal(null)
    const res = await onDraw()
    if (!res?.wheel) return
    const wheel = res.wheel as WheelName[]
    // Aralashtiramiz: g'olib baraban bo'ylab tasodifiy joyda
    const order = [...wheel].sort(() => Math.random() - 0.5)
    const idx = order.findIndex((n) => n.id === (res.winner as Draw).id)
    const s = 360 / order.length
    setNames(order)
    // Ko'rsatkich tepada: g'olib segmentining o'rtasi 0° ga kelsin
    const target = 360 - (idx + 0.5) * s + (Math.random() - 0.5) * s * 0.6
    setRotation((r) => r - (r % 360) + 360 * 7 + target)
    setSpinning(true)
    timer.current = window.setTimeout(() => { setSpinning(false); setReveal(res.winner as Draw) }, 6200)
  }

  const R = 230
  return (
    <section className="adm-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-extrabold"><Trophy size={17} /> Baraban</h2>
        <span className="ml-auto text-xs font-bold" style={{ color: 'var(--muted)' }}>{state.draws.length} / {state.config.winners} g‘olib</span>
      </div>

      <div className="relative mx-auto mt-4" style={{ width: 2 * R + 20, maxWidth: '100%', aspectRatio: '1' }}>
        {/* Ko'rsatkich */}
        <div style={{ position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)', zIndex: 3, width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderTop: '34px solid #e8453c', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.35))' }} />
        <svg viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`} style={{ width: '100%', height: '100%', transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 6s cubic-bezier(0.12, 0.6, 0.08, 1)' : 'none' }}>
          <circle r={R + 6} fill="#05542a" />
          {names.length === 0 && <circle r={R} fill="#0a7a3d" />}
          {names.map((n, i) => {
            const a0 = (i * seg - 90) * (Math.PI / 180)
            const a1 = ((i + 1) * seg - 90) * (Math.PI / 180)
            const large = seg > 180 ? 1 : 0
            const path = names.length === 1
              ? `M0 ${-R} A${R} ${R} 0 1 1 -0.01 ${-R} Z`
              : `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`
            const mid = i * seg + seg / 2
            const color = COLORS[i % COLORS.length]
            const dark = ['#ffd43b', '#f5b800', '#ffe27a'].includes(color)
            return (
              <g key={n.id + i}>
                <path d={path} fill={color} stroke="#fff" strokeWidth={2} />
                <text transform={`rotate(${mid - 90}) translate(${R - 18} 0)`} textAnchor="end" dominantBaseline="middle" fontSize={names.length > 12 ? 15 : 18} fontWeight={800} fill={dark ? '#3a2a00' : '#fff'} fontFamily="Montserrat, sans-serif">
                  {short(n.name)}
                </text>
              </g>
            )
          })}
          <circle r={46} fill="#fff" stroke="#ffd43b" strokeWidth={6} />
          <text textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={900} fill="#0a7a3d" fontFamily="Montserrat, sans-serif">MUSA</text>
        </svg>
        {reveal && !spinning && (
          <div className="absolute inset-0 grid place-items-center" style={{ pointerEvents: 'none' }}>
            <div className="rounded-2xl px-6 py-4 text-center" style={{ background: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', animation: 'fadeInUp 0.4s ease' }}>
              <p className="text-xs font-extrabold" style={{ color: 'var(--brand)' }}>🎉 {state.draws.length}-G‘OLIB</p>
              <p className="mt-1 text-2xl font-extrabold" style={{ color: '#10231a' }}>{reveal.name}</p>
              <p className="text-sm" style={{ color: '#5d6b63' }}>{reveal.username ? `@${reveal.username}` : `ID ${reveal.id}`} · {reveal.tickets} imkoniyat</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="adm-btn adm-btn--primary flex-1" disabled={done || full || spinning || !!busy || state.stats.people === 0} onClick={() => void spin()}>
          {busy === 'draw' || spinning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {full ? 'Hamma g‘oliblar aniqlandi' : `${state.draws.length + 1}-g‘olibni aniqlash`}
        </button>
        {!done && state.draws.length > 0 && (
          <button className="adm-btn adm-btn--ghost" disabled={spinning || !!busy} onClick={onUndo}><RotateCcw size={15} /> Oxirgisini bekor qilish</button>
        )}
      </div>

      {state.draws.length > 0 && (
        <ol className="mt-4 grid gap-2">
          {state.draws.map((d, i) => (
            <li key={d.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--surface-2)' }}>
              <span className="grid size-8 place-items-center rounded-full text-sm font-extrabold" style={{ background: '#ffd43b', color: '#3a2a00' }}>{i + 1}</span>
              <span className="min-w-0 flex-1"><b>{d.name}</b> <span className="text-xs" style={{ color: 'var(--muted)' }}>{d.username ? `@${d.username}` : `ID ${d.id}`}</span></span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{d.tickets} imk.</span>
            </li>
          ))}
        </ol>
      )}

      {done ? (
        <p className="mt-4 rounded-xl p-3 text-sm font-bold" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
          ✅ Tasdiqlangan — g‘oliblarga xabar yuborildi: {state.sent?.ok ?? 0} ta{state.sent?.failed ? `, yetib bormadi: ${state.sent.failed} ta (botni bloklagan bo‘lishi mumkin)` : ''}.
        </p>
      ) : state.draws.length > 0 && owner ? (
        <button className="adm-btn adm-btn--primary mt-4 w-full" disabled={spinning || !!busy} onClick={onConfirm}>
          {busy === 'confirm' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Tasdiqlayman — g‘oliblarga xabar yuborish
        </button>
      ) : null}
    </section>
  )
}
