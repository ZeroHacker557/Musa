import { CheckCircle2, Megaphone, Send, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { apiPost } from '../lib/api'
import { useCustomers } from '../lib/live'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'

type Segment = 'all' | 'customers' | 'active30'

const SEGMENTS: { key: Segment; label: string; hint: string }[] = [
  { key: 'all', label: 'Hamma', hint: 'Botni ishga tushirgan barcha foydalanuvchilar' },
  { key: 'customers', label: 'Telefon qoldirganlar', hint: 'Raqamini bergan mijozlar' },
  { key: 'active30', label: 'Oxirgi 30 kun', hint: 'So‘nggi oyda ilovaga kirganlar' },
]

type Progress = { sent: number; failed: number; skipped: number; processed: number }

export function BroadcastPage() {
  const { customers } = useCustomers()
  const { show, node: toast } = useToast()

  const [text, setText] = useState('')
  const [segment, setSegment] = useState<Segment>('all')
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const cancelled = useRef(false)

  /**
   * Yuborish BO'LAKLAB ketadi.
   *
   * Bitta serverless chaqiruvda hammasiga yuborib bo'lmaydi: funksiya
   * bir necha soniyada to'xtaydi, Telegram esa tezlikni cheklaydi.
   * Shuning uchun server har safar bir bo'lakni yuboradi va keyingi
   * kursorni qaytaradi — bu yerda esa tugagunicha aylanamiz.
   */
  const start = async () => {
    setConfirming(false)
    setRunning(true)
    cancelled.current = false

    const totals: Progress = { sent: 0, failed: 0, skipped: 0, processed: 0 }
    setProgress({ ...totals })

    let cursor: string | null = null
    try {
      do {
        const result: Progress & { nextCursor: string | null } = await apiPost(
          'action',
          { action: 'broadcast.send', text, segment, after: cursor, limit: 25 },
        )
        totals.sent += result.sent
        totals.failed += result.failed
        totals.skipped += result.skipped
        totals.processed += result.processed
        setProgress({ ...totals })
        cursor = result.nextCursor
      } while (cursor && !cancelled.current)

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

  const estimate = segment === 'customers' ? customers.filter((c) => c.phone).length : customers.length

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="adm-card p-4 sm:p-5">
          <label className="adm-label">Xabar matni</label>
          <textarea
            className="adm-input"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'🎉 Yangi mahsulot!\n\nMUSA plombiri endi katalogda. Buyurtma bering — 24 soat ichida yetkazamiz.'}
            disabled={running}
            maxLength={3500}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>
              HTML: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;qiya&lt;/i&gt;, &lt;a href=""&gt;havola&lt;/a&gt;
            </p>
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              {text.length} / 3500
            </p>
          </div>

          <p className="adm-label mt-4">Kimga</p>
          <div className="flex flex-col gap-2">
            {SEGMENTS.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition"
                style={{
                  borderColor: segment === item.key ? 'var(--brand-line)' : 'var(--line)',
                  background: segment === item.key ? 'var(--brand-soft)' : 'var(--surface)',
                }}
              >
                <input
                  type="radio"
                  className="mt-0.5 size-4"
                  checked={segment === item.key}
                  onChange={() => setSegment(item.key)}
                  disabled={running}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                    {item.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            className="adm-btn adm-btn--primary mt-4 w-full py-3"
            onClick={() => setConfirming(true)}
            disabled={running || !text.trim()}
          >
            <Send size={17} />
            {running ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>

          {running && (
            <button
              className="adm-btn adm-btn--ghost mt-2 w-full"
              onClick={() => {
                cancelled.current = true
              }}
            >
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
            <p className="mt-2 text-xs" style={{ color: 'var(--faint)' }}>
              Taxminan {estimate} ta foydalanuvchiga boradi.
            </p>
          </div>

          {progress && (
            <div className="adm-card p-4">
              <h2 className="text-sm font-extrabold">Jarayon</h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Line
                  icon={<CheckCircle2 size={15} />}
                  label="Yuborildi"
                  value={progress.sent}
                  tone="var(--brand)"
                />
                <Line
                  icon={<XCircle size={15} />}
                  label="Yetmadi — bot bloklangan"
                  value={progress.failed}
                  tone="var(--danger)"
                />
                <Line
                  icon={<Megaphone size={15} />}
                  label="Tashlab ketildi — segmentga kirmadi"
                  value={progress.skipped}
                  tone="var(--muted)"
                />
              </div>
              {running && (
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--surface-3)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'var(--brand)',
                      width: `${Math.min(100, (progress.processed / Math.max(1, customers.length)) * 100)}%`,
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
          message={`Xabar taxminan ${estimate} ta foydalanuvchiga boradi. Yuborilgan xabarni qaytarib bo‘lmaydi.`}
          confirmLabel="Ha, yuborilsin"
          onConfirm={start}
          onClose={() => setConfirming(false)}
        />
      )}

      {toast}
    </>
  )
}

function Line({
  icon, label, value, tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: tone }}>{icon}</span>
      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span className="font-extrabold">{value}</span>
    </div>
  )
}
