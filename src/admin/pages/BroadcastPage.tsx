import { CheckCircle2, Megaphone, Send, Users, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import type { UploadedAdMedia } from '../lib/storage'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import { ButtonsEditor, MediaField, PostPreview } from '../components/PostComposer'
import { AudiencePicker } from '../components/Audience'
import { CAPTION_MAX, buttonError, cleanButtons, plainLength, type ButtonDraft } from '../lib/post-draft'
import { displayName, sendToCustomers, useAudience, type Progress } from '../lib/audience'

/**
 * Ommaviy xabar — botda mijozlarga (har biri o'z tilida).
 * Muharrir va auditoriya qismlari «Kanal» sahifasi bilan umumiy.
 */
export function BroadcastPage() {
  const aud = useAudience()
  const { recipients } = aud
  const { show, node: toast } = useToast()

  const [text, setText] = useState('')
  /** Ruscha matn — bo'sh qolsa ruschada ham o'zbekchasi ketadi. */
  const [textRu, setTextRu] = useState('')
  const [media, setMedia] = useState<UploadedAdMedia | null>(null)
  const [uploading, setUploading] = useState(false)
  const [buttons, setButtons] = useState<ButtonDraft[]>([])

  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const cancelled = useRef(false)

  const start = async () => {
    setConfirming(false)
    setRunning(true)
    cancelled.current = false
    try {
      const totals = await sendToCustomers(
        { text, textRu, media, buttons: cleanButtons(buttons) },
        recipients.map((c) => c.id),
        setProgress,
        () => cancelled.current,
      )
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

  const buttonsInvalid = buttons.some((b) => buttonError(b))
  const longCaption = Boolean(media) && Math.max(plainLength(text), plainLength(textRu)) > CAPTION_MAX
  const blocked = running || uploading || buttonsInvalid || (!text.trim() && !media) || recipients.length === 0

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="adm-card p-4 sm:p-5">
          {/* Rasm yoki video — matn uning izohi bo'lib ketadi */}
          <MediaField
            media={media}
            onChange={setMedia}
            onBusy={setUploading}
            disabled={running}
            onError={(message) => show(message, 'error')}
          />

          <label className="adm-label mt-4" htmlFor="broadcast-text">Xabar matni</label>
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
          {longCaption && (
            <p className="adm-bc-note">
              Matn {CAPTION_MAX} belgidan uzun — Telegram rasm ostiga buncha matn sig‘dirmaydi.
              Avval rasm/video, keyin matn tugmalar bilan alohida xabar bo‘lib boradi.
            </p>
          )}

          {/* Inline tugmalar — xabar ostida, har biri alohida qatorda */}
          <ButtonsEditor buttons={buttons} onChange={setButtons} disabled={running} />

          <p className="adm-label mt-4">Kimga</p>
          <AudiencePicker state={aud} disabled={running} />

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
            <div className="mt-3">
              <PostPreview media={media} text={text} buttons={buttons} />
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
