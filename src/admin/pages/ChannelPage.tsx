import {
  AlertTriangle, BellOff, CheckCircle2, Copy, ExternalLink, Film, Link2, Loader2, Megaphone, Pin, PlugZap,
  RefreshCw, Send, ShieldCheck, Trash2, Unplug, Users, XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost } from '../lib/api'
import type { UploadedAdMedia } from '../lib/storage'
import { ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import { ButtonsEditor, MediaField, PostPreview } from '../components/PostComposer'
import { AudiencePicker } from '../components/Audience'
import {
  CAPTION_MAX, buttonError, cleanButtons, plainLength, type ButtonColor, type ButtonDraft, type Target,
} from '../lib/post-draft'
import { sendToCustomers, useAudience, type Progress } from '../lib/audience'

/**
 * Telegram kanali — e'lon joylash.
 *
 * Tepada ulanish holati (bot adminmi, post joylay oladimi — jonli
 * tekshiriladi), pastda muharrir: rasm/video, matn, tugmalar (havola yoki
 * ilovaning kerakli joyi, rangi). Xohlasa o'sha e'lon bir vaqtda botda
 * mijozlarga ham ketadi — «Ommaviy xabar» bilan bir xil auditoriya tanlovi.
 * Server: api/_lib/actions/channel.ts.
 */

type Rights = { isAdmin: boolean; canPost: boolean; canEdit: boolean; canDelete: boolean }
type ChannelInfo = { chatId: number; title: string; username: string | null; members: number | null; link: string | null }
type RawButton = { text: string; textRu: string; kind: 'url' | 'app'; url: string; target: string; style: string | null }
type Post = {
  id: string
  link: string
  snippet: string
  media: { type: 'image' | 'video'; url: string } | null
  buttons: number
  pinned: boolean
  silent: boolean
  protect: boolean
  customers: number
  by: string
  at: string
  deleted: boolean
  draft?: { text: string; textRu: string; bilingual: boolean; buttons: RawButton[] }
}
type Status = {
  connected: boolean
  channel: ChannelInfo | null
  rights: Rights | null
  problem: string | null
  bot: { username: string; appLinks: boolean } | null
  candidates: { chatId: number; title: string; username: string | null }[]
  posts: Post[]
}

/** Tarixdagi tugma → muharrir ko'rinishi (people.ts → appQuery teskarisi). */
function toDraft(b: RawButton): ButtonDraft {
  const match = /^(cat|sec|product):(.*)$/s.exec(b.target)
  const target: Target = match
    ? (({ cat: 'category', sec: 'section', product: 'product' } as const)[match[1] as 'cat' | 'sec' | 'product'])
    : ((b.target || 'home') as Target)
  return {
    kind: b.kind,
    text: b.text,
    textRu: b.textRu ?? '',
    url: b.url ?? '',
    target,
    value: match ? match[2] : '',
    style: (b.style ?? '') as ButtonColor,
  }
}

const formatWhen = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function ChannelPage() {
  const { show, node: toast } = useToast()
  const aud = useAudience()

  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [changing, setChanging] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  // Muharrir
  const [media, setMedia] = useState<UploadedAdMedia | null>(null)
  const [uploading, setUploading] = useState(false)
  const [text, setText] = useState('')
  const [textRu, setTextRu] = useState('')
  const [bilingual, setBilingual] = useState(false)
  const [buttons, setButtons] = useState<ButtonDraft[]>([])

  // Qayerga va qanday
  const [toChannel, setToChannel] = useState(true)
  const [toCustomers, setToCustomers] = useState(false)
  const [silent, setSilent] = useState(false)
  const [pin, setPin] = useState(false)
  const [protect, setProtect] = useState(false)
  const [preview, setPreview] = useState(false)

  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [lastLink, setLastLink] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Post | null>(null)
  const cancelled = useRef(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      setStatus(await apiPost<Status>('action', { action: 'channel.status' }))
    } catch (error) {
      show(error instanceof Error ? error.message : 'Holatni olib bo‘lmadi', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  // Birinchi yuklash — natija kelganda holat yoziladi
  useEffect(() => {
    let alive = true
    apiPost<Status>('action', { action: 'channel.status' })
      .then((next) => { if (alive) setStatus(next) })
      .catch((error: unknown) => { if (alive) show(error instanceof Error ? error.message : 'Holatni olib bo‘lmadi', 'error') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [show])

  const connect = async (chat: string) => {
    setConnecting(true)
    try {
      setStatus(await apiPost<Status>('action', { action: 'channel.connect', chat }))
      setChatInput('')
      setChanging(false)
      show('Kanal ulandi')
    } catch (error) {
      show(error instanceof Error ? error.message : 'Ulab bo‘lmadi', 'error')
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    setConfirmDisconnect(false)
    try {
      setStatus(await apiPost<Status>('action', { action: 'channel.disconnect' }))
      show('Kanal uzildi')
    } catch (error) {
      show(error instanceof Error ? error.message : 'Uzib bo‘lmadi', 'error')
    }
  }

  const ready = Boolean(status?.connected && status.rights?.canPost && !status.problem)
  const channelOn = toChannel && ready
  const customersOn = toCustomers && aud.recipients.length > 0
  const channelText = bilingual && textRu.trim() && text.trim() ? `🇺🇿 ${text.trim()}\n\n🇷🇺 ${textRu.trim()}` : text.trim() || textRu.trim()

  const buttonsInvalid = buttons.some((b) => buttonError(b))
  const empty = !text.trim() && !textRu.trim() && !media
  const blocked = running || uploading || buttonsInvalid || empty || (!channelOn && !customersOn)
  const longCaption = Boolean(media) && plainLength(channelOn ? channelText : text) > CAPTION_MAX

  const send = async () => {
    setConfirming(false)
    setRunning(true)
    setProgress(null)
    setLastLink(null)
    cancelled.current = false
    const payloadButtons = cleanButtons(buttons)
    try {
      if (channelOn) {
        const result = await apiPost<{ link: string; pinned: boolean; pinError: string | null }>('action', {
          action: 'channel.post',
          text,
          textRu,
          bilingual,
          media,
          buttons: payloadButtons,
          silent,
          pin: pin && Boolean(status?.rights?.canEdit),
          protect,
          preview: preview && !media,
          customers: customersOn ? aud.recipients.length : 0,
        })
        setLastLink(result.link)
        if (result.pinError) show(`E’lon joylandi, lekin qadalmadi: ${result.pinError}`, 'error')
        else if (!customersOn) show('E’lon kanalga joylandi')
      }
      if (customersOn) {
        const totals = await sendToCustomers(
          { text, textRu, media, buttons: payloadButtons },
          aud.recipients.map((c) => c.id),
          setProgress,
          () => cancelled.current,
        )
        show(
          (channelOn ? 'Kanalga joylandi. ' : '') +
            (cancelled.current
              ? `Mijozlarga yuborish to‘xtatildi — ${totals.sent} ta yuborildi`
              : `Mijozlarga: ${totals.sent} ta yuborildi, ${totals.failed} ta yetmadi`),
        )
      }
      void load(true)
    } catch (error) {
      show(error instanceof Error ? error.message : 'Yuborishda xato', 'error')
    } finally {
      setRunning(false)
    }
  }

  const reuse = (post: Post) => {
    if (!post.draft) return
    setText(post.draft.text)
    setTextRu(post.draft.textRu)
    setBilingual(post.draft.bilingual)
    setButtons((post.draft.buttons ?? []).map(toDraft))
    setMedia(post.media)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    show('E’lon muharrirga yuklandi')
  }

  const removePost = async () => {
    const post = deleting
    setDeleting(null)
    if (!post) return
    try {
      await apiPost('action', { action: 'channel.delete', id: post.id })
      show('E’lon kanaldan o‘chirildi')
      void load(true)
    } catch (error) {
      show(error instanceof Error ? error.message : 'O‘chirib bo‘lmadi', 'error')
    }
  }

  const sendLabel = running
    ? 'Yuborilmoqda...'
    : channelOn && customersOn
      ? `Kanalga va ${aud.recipients.length} ta mijozga`
      : channelOn
        ? 'Kanalga joylash'
        : customersOn
          ? `${aud.recipients.length} ta mijozga yuborish`
          : 'Qayerga yuborishni tanlang'

  const confirmMessage = [
    channelOn && `E’lon «${status?.channel?.title}» kanaliga joylanadi${pin && status?.rights?.canEdit ? ' va qadaladi' : ''}.`,
    customersOn && `${aud.recipients.length} ta mijozga botda yuboriladi.`,
    'Yuborilgan xabarni qaytarib bo‘lmaydi (kanaldagini keyin o‘chirish mumkin).',
  ].filter(Boolean).join(' ')

  return (
    <>
      {/* ── Ulanish holati ── */}
      <ConnectionCard
        status={status}
        loading={loading}
        changing={changing}
        chatInput={chatInput}
        connecting={connecting}
        onInput={setChatInput}
        onConnect={connect}
        onRefresh={() => void load()}
        onChange={() => setChanging(true)}
        onCancelChange={() => setChanging(false)}
        onDisconnect={() => setConfirmDisconnect(true)}
      />

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="adm-card p-4 sm:p-5">
          <MediaField
            media={media}
            onChange={setMedia}
            onBusy={setUploading}
            disabled={running}
            onError={(message) => show(message, 'error')}
          />

          <label className="adm-label mt-4" htmlFor="channel-text">E’lon matni</label>
          <textarea
            id="channel-text"
            className="adm-input"
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'🔥 Yangi aksiya!\n\nBarcha muzqaymoqlarga 20% chegirma — faqat shu hafta.'}
            disabled={running}
            maxLength={3500}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>
              HTML: &lt;b&gt;qalin&lt;/b&gt;, &lt;i&gt;qiya&lt;/i&gt;, &lt;a href=""&gt;havola&lt;/a&gt;, &lt;tg-spoiler&gt;
            </p>
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{text.length} / 3500</p>
          </div>

          <label className="adm-label mt-4" htmlFor="channel-text-ru">
            Ruscha matn <span style={{ color: 'var(--faint)' }}>(ixtiyoriy)</span>
          </label>
          <textarea
            id="channel-text-ru"
            className="adm-input"
            rows={5}
            value={textRu}
            onChange={(e) => setTextRu(e.target.value)}
            placeholder={'🔥 Новая акция!\n\nСкидка 20% на всё мороженое — только на этой неделе.'}
            disabled={running}
            maxLength={3500}
          />
          <p className="mt-1.5 text-xs" style={{ color: 'var(--faint)' }}>
            Mijozlarga — har biriga o‘z tilida. Kanalga — pastdagi belgiga qarab.
          </p>
          {textRu.trim() && text.trim() && (
            <Toggle
              checked={bilingual}
              onChange={setBilingual}
              label="Kanalga ikki tilda joylash"
              hint="Bitta postda avval o‘zbekcha, keyin ruscha. O‘chiq bo‘lsa — faqat o‘zbekcha"
            />
          )}
          {longCaption && (
            <p className="adm-bc-note">
              Matn {CAPTION_MAX} belgidan uzun — Telegram rasm ostiga buncha matn sig‘dirmaydi.
              Avval rasm/video, keyin matn tugmalar bilan alohida xabar bo‘lib chiqadi.
            </p>
          )}

          <ButtonsEditor buttons={buttons} onChange={setButtons} disabled={running} channel={!toCustomers} />
          {buttons.some((b) => b.kind === 'app') && status?.bot && (
            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              {status.bot.appLinks
                ? `Kanalda «Ilovada ochish» tugmasi @${status.bot.username} ilovasini aynan tanlangan joyda ochadi.`
                : `Botda asosiy Mini App sozlanmagan — kanaldagi tugma faqat @${status.bot.username} botini ochadi.`}
            </p>
          )}

          {/* ── Qayerga ── */}
          <p className="adm-label mt-5">Qayerga yuborilsin</p>
          <div className="adm-ch-dest">
            <button
              type="button"
              className={'adm-ch-dest__item ' + (channelOn ? 'active' : '')}
              onClick={() => setToChannel(!toChannel)}
              disabled={running || !ready}
              aria-pressed={channelOn}
            >
              <span className="adm-ch-dest__icon"><Megaphone size={18} /></span>
              <span className="min-w-0">
                <b>Kanalga</b>
                <span>{ready ? status?.channel?.title : 'Kanal ulanmagan'}</span>
              </span>
              <span className="adm-ch-dest__check">{channelOn && <CheckCircle2 size={18} />}</span>
            </button>
            <button
              type="button"
              className={'adm-ch-dest__item ' + (toCustomers ? 'active' : '')}
              onClick={() => setToCustomers(!toCustomers)}
              disabled={running}
              aria-pressed={toCustomers}
            >
              <span className="adm-ch-dest__icon"><Users size={18} /></span>
              <span className="min-w-0">
                <b>Mijozlarga ham</b>
                <span>Botda, har biriga shaxsan</span>
              </span>
              <span className="adm-ch-dest__check">{toCustomers && <CheckCircle2 size={18} />}</span>
            </button>
          </div>

          {channelOn && (
            <div className="adm-ch-opts">
              <Toggle checked={silent} onChange={setSilent} icon={<BellOff size={15} />} label="Ovozsiz" hint="Obunachilarga tovushsiz bildirishnoma" />
              <Toggle
                checked={pin}
                onChange={setPin}
                icon={<Pin size={15} />}
                label="Kanalda qadash"
                hint={status?.rights?.canEdit ? 'E’lon kanal tepasida turadi' : 'Botda «Tahrirlash» huquqi kerak'}
                disabled={!status?.rights?.canEdit}
              />
              <Toggle checked={protect} onChange={setProtect} icon={<ShieldCheck size={15} />} label="Nusxalashni taqiqlash" hint="Forward qilib, saqlab bo‘lmaydi" />
              <Toggle checked={preview} onChange={setPreview} icon={<Link2 size={15} />} label="Havola ko‘rinishi" hint="Matndagi birinchi havola kartochka bo‘lib chiqadi" disabled={Boolean(media)} />
            </div>
          )}

          {toCustomers && (
            <div className="mt-4">
              <p className="adm-label">Qaysi mijozlarga</p>
              <AudiencePicker state={aud} disabled={running} />
            </div>
          )}

          <button className="adm-btn adm-btn--primary mt-5 w-full py-3" onClick={() => setConfirming(true)} disabled={blocked}>
            {running ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            {sendLabel}
          </button>
          {running && customersOn && (
            <button className="adm-btn adm-btn--ghost mt-2 w-full" onClick={() => { cancelled.current = true }}>
              Mijozlarga yuborishni to‘xtatish
            </button>
          )}
          {lastLink && !running && (
            <a className="adm-btn adm-btn--ghost mt-2 w-full" href={lastLink} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> Kanaldagi e’lonni ochish
            </a>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="adm-card p-4">
            <h2 className="text-sm font-extrabold">Kanalda ko‘rinishi</h2>
            <div className="adm-ch-wall mt-3">
              <PostPreview
                media={media}
                text={channelText}
                buttons={buttons}
                channel={{ title: status?.channel?.title || 'Kanal' }}
              />
            </div>
          </div>

          {toCustomers && (
            <div className="adm-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Users size={16} /> Mijozlar
                <span className="ml-auto text-lg font-extrabold" style={{ color: 'var(--brand)' }}>{aud.recipients.length}</span>
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                Botda shaxsiy xabar bo‘lib boradi, tugmalar ilovani to‘g‘ridan-to‘g‘ri ochadi.
              </p>
            </div>
          )}

          {progress && (
            <div className="adm-card p-4">
              <h2 className="text-sm font-extrabold">Mijozlarga yuborish</h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Line icon={<CheckCircle2 size={15} />} label="Yuborildi" value={progress.sent} tone="var(--brand)" />
                <Line icon={<XCircle size={15} />} label="Yetmadi — bot bloklangan" value={progress.failed} tone="var(--danger)" />
              </div>
              {running && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-3)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'var(--brand)',
                      width: `${Math.min(100, (progress.processed / Math.max(1, aud.recipients.length)) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <History posts={status?.posts ?? []} canDelete={Boolean(status?.rights?.canDelete)} onReuse={reuse} onDelete={setDeleting} />
        </section>
      </div>

      {confirming && (
        <ConfirmDialog
          title={channelOn ? 'E’lon joylansinmi?' : 'Mijozlarga yuborilsinmi?'}
          message={confirmMessage}
          confirmLabel="Ha, yuborilsin"
          onConfirm={send}
          onClose={() => setConfirming(false)}
        />
      )}
      {confirmDisconnect && (
        <ConfirmDialog
          title="Kanal uzilsinmi?"
          message="Panel bu kanalga e’lon joylamaydi. Bot kanalda qoladi — keyin qayta ulash mumkin."
          confirmLabel="Ha, uzilsin"
          onConfirm={disconnect}
          onClose={() => setConfirmDisconnect(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="E’lon kanaldan o‘chirilsinmi?"
          message="Xabar kanaldan butunlay o‘chadi. Mijozlarga botda ketgan nusxalar qoladi."
          confirmLabel="Ha, o‘chirilsin"
          onConfirm={removePost}
          onClose={() => setDeleting(null)}
        />
      )}
      {toast}
    </>
  )
}

// ─── Ulanish kartasi ──────────────────────────────────────────

function ConnectionCard({
  status, loading, changing, chatInput, connecting,
  onInput, onConnect, onRefresh, onChange, onCancelChange, onDisconnect,
}: {
  status: Status | null
  loading: boolean
  changing: boolean
  chatInput: string
  connecting: boolean
  onInput: (value: string) => void
  onConnect: (chat: string) => void
  onRefresh: () => void
  onChange: () => void
  onCancelChange: () => void
  onDisconnect: () => void
}) {
  if (loading && !status) {
    return (
      <section className="adm-card adm-ch-status flex items-center gap-3 p-4">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--muted)' }} />
        <span className="text-sm" style={{ color: 'var(--muted)' }}>Kanal holati tekshirilmoqda…</span>
      </section>
    )
  }

  const channel = status?.channel
  const rights = status?.rights
  const botName = status?.bot?.username ? `@${status.bot.username}` : 'botni'
  const healthy = Boolean(status?.connected && rights?.canPost && !status.problem)

  if (status?.connected && channel && !changing) {
    return (
      <section className={'adm-card adm-ch-status p-4 ' + (healthy ? 'is-ok' : 'is-bad')}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="adm-ch-avatar">{(channel.title || '?').trim().charAt(0).toUpperCase()}</span>
          <div className="min-w-[200px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-extrabold">{channel.title || 'Kanal'}</h2>
              <span className={'adm-ch-state ' + (healthy ? 'is-ok' : 'is-bad')}>
                <span className="adm-ch-state__dot" /> {healthy ? 'Ulangan' : 'Muammo bor'}
              </span>
            </div>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
              {channel.username ? `@${channel.username}` : 'Yopiq kanal'}
              {channel.members !== null && ` · ${channel.members.toLocaleString('ru-RU')} obunachi`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Tekshirish
            </button>
            {channel.link && (
              <a className="adm-btn adm-btn--ghost" href={channel.link} target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> Ochish
              </a>
            )}
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onChange}>
              <PlugZap size={15} /> Boshqa kanal
            </button>
            <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={onDisconnect} aria-label="Kanalni uzish" title="Uzish">
              <Unplug size={15} />
            </button>
          </div>
        </div>

        {rights && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Right ok={rights.isAdmin} label="Bot admin" />
            <Right ok={rights.canPost} label="Post joylash" />
            <Right ok={rights.canEdit} label="Qadash / tahrirlash" optional />
            <Right ok={rights.canDelete} label="O‘chirish" optional />
          </div>
        )}
        {status.problem && (
          <p className="adm-ch-problem">
            <AlertTriangle size={15} /> {status.problem}. Kanal sozlamalari → Administratorlar → {botName} → «Xabar joylash» ni yoqing.
          </p>
        )}
      </section>
    )
  }

  const candidates = status?.candidates ?? []
  return (
    <section className="adm-card adm-ch-status p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-extrabold">{changing ? 'Boshqa kanalni ulash' : 'Kanalni ulash'}</h2>
        {!changing && <span className="adm-ch-state is-off"><span className="adm-ch-state__dot" /> Ulanmagan</span>}
        {changing && (
          <button type="button" className="adm-link ml-auto text-sm" onClick={onCancelChange}>Bekor qilish</button>
        )}
      </div>
      <ol className="adm-ch-steps">
        <li>Telegram’da kanal sozlamalari → <b>Administratorlar</b> → <b>{botName}</b> ni qo‘shing.</li>
        <li><b>«Xabar joylash»</b> huquqini yoqing (qadash uchun <b>«Tahrirlash»</b>, o‘chirish uchun <b>«O‘chirish»</b> ham).</li>
        <li>Kanal manzilini yozing yoki bot topgan kanallardan tanlang.</li>
      </ol>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()) onConnect(chatInput) }}
      >
        <input
          className="adm-input flex-1"
          value={chatInput}
          onChange={(e) => onInput(e.target.value)}
          placeholder="@musa_uz, t.me/musa_uz yoki -100…"
          disabled={connecting}
          aria-label="Kanal manzili"
        />
        <button type="submit" className="adm-btn adm-btn--primary" disabled={connecting || !chatInput.trim()}>
          {connecting ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />} Ulash
        </button>
      </form>
      {candidates.length > 0 && (
        <>
          <p className="adm-bc-sub">Bot admin bo‘lgan kanallar:</p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((c) => (
              <button
                key={c.chatId}
                type="button"
                className="adm-chip inline-flex items-center gap-1.5"
                onClick={() => onConnect(String(c.chatId))}
                disabled={connecting}
              >
                <Megaphone size={13} /> {c.title || c.username || c.chatId}
              </button>
            ))}
          </div>
        </>
      )}
      {status?.problem && <p className="adm-ch-problem"><AlertTriangle size={15} /> {status.problem}</p>}
    </section>
  )
}

function Right({ ok, label, optional }: { ok: boolean; label: string; optional?: boolean }) {
  return (
    <span className={'adm-ch-right ' + (ok ? 'is-ok' : optional ? 'is-off' : 'is-bad')}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {label}
    </span>
  )
}

// ─── Tarix ────────────────────────────────────────────────────

function History({
  posts, canDelete, onReuse, onDelete,
}: {
  posts: Post[]
  canDelete: boolean
  onReuse: (post: Post) => void
  onDelete: (post: Post) => void
}) {
  return (
    <div className="adm-card p-4">
      <h2 className="text-sm font-extrabold">Oxirgi e’lonlar</h2>
      {posts.length === 0 ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>Hali e’lon joylanmagan.</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {posts.map((post) => (
            <li key={post.id} className={'adm-ch-post ' + (post.deleted ? 'is-deleted' : '')}>
              <span className="adm-ch-post__thumb">
                {post.media?.type === 'image'
                  ? <img src={post.media.url} alt="" loading="lazy" />
                  : post.media?.type === 'video' ? <Film size={16} /> : <Megaphone size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="adm-ch-post__text">{post.snippet || (post.media ? 'Rasm/video' : '—')}</p>
                <p className="adm-ch-post__meta">
                  {formatWhen(post.at)} · {post.by}
                  {post.pinned && <span title="Qadalgan"> · <Pin size={11} /></span>}
                  {post.silent && <span title="Ovozsiz"> · <BellOff size={11} /></span>}
                  {post.customers > 0 && <span title="Mijozlarga ham"> · <Users size={11} /> {post.customers}</span>}
                  {post.deleted && ' · o‘chirilgan'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {post.draft && (
                  <button type="button" className="adm-icon-btn" onClick={() => onReuse(post)} aria-label="Takrorlash" title="Muharrirga yuklash">
                    <Copy size={14} />
                  </button>
                )}
                {!post.deleted && (
                  <a className="adm-icon-btn" href={post.link} target="_blank" rel="noreferrer" aria-label="Kanalda ochish" title="Kanalda ochish">
                    <ExternalLink size={14} />
                  </a>
                )}
                {!post.deleted && canDelete && (
                  <button type="button" className="adm-icon-btn adm-icon-btn--danger" onClick={() => onDelete(post)} aria-label="Kanaldan o‘chirish" title="Kanaldan o‘chirish">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Kichik qismlar ───────────────────────────────────────────

function Toggle({
  checked, onChange, label, hint, icon, disabled,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint?: string
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label className={'adm-ch-toggle ' + (disabled ? 'is-disabled' : '')}>
      {icon && <span className="adm-ch-toggle__icon">{icon}</span>}
      <span className="min-w-0 flex-1">
        <b>{label}</b>
        {hint && <span>{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="adm-ch-switch"
        checked={checked && !disabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
    </label>
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
