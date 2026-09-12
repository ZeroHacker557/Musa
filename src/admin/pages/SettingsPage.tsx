import { CreditCard, Loader2, Send, Truck, Users2 } from 'lucide-react'
import { useState } from 'react'
import { apiPost } from '../lib/api'
import { useSettings } from '../lib/live'
import { useToast } from '../components/Toast'

export function SettingsPage() {
  const settings = useSettings()
  const { show, node: toast } = useToast()
  const [busy, setBusy] = useState('')

  const save = async (section: string, payload: Record<string, unknown>) => {
    setBusy(section)
    try {
      await apiPost('action', { action: 'settings.save', section, ...payload })
      show('Saqlandi')
    } catch (error) {
      show(error instanceof Error ? error.message : 'Saqlanmadi', 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        {/*
          `key` — jonli qiymat kelganda forma qaytadan o'rnatilsin uchun.
          Props'ni useEffect bilan state'ga ko'chirish o'rniga shu usul:
          ortiqcha render bo'lmaydi va React uchun ham to'g'ri yo'l.
          Yozayotganda kalit o'zgarmaydi — settings faqat Firestore
          yangilanganda almashadi.
        */}
        <PaymentCard
          key={`pay:${settings.payment.cardNumber}|${settings.payment.cardOwner}`}
          settings={settings.payment}
          busy={busy === 'payment'}
          onSave={save}
        />
        <DeliveryCard
          key={`del:${settings.delivery.fee}|${settings.delivery.freeFrom}`}
          settings={settings.delivery}
          busy={busy === 'delivery'}
          onSave={save}
        />
        <CourierCard
          key={`cour:${settings.courier.toCouriers}|${settings.courier.toGroup}|${settings.courier.groupChatId}|${settings.courier.notifyAdmins}`}
          settings={settings.courier}
          busy={busy === 'courier'}
          onSave={save}
          onError={(m) => show(m, 'error')}
          onOk={(m) => show(m)}
        />
      </div>
      {toast}
    </>
  )
}

type SaveFn = (section: string, payload: Record<string, unknown>) => void

function Section({
  title, icon: Icon, hint, children,
}: {
  title: string
  icon: typeof CreditCard
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="adm-card p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold">{title}</h2>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {hint}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PaymentCard({
  settings, busy, onSave,
}: {
  settings: { cardNumber: string; cardOwner: string }
  busy: boolean
  onSave: SaveFn
}) {
  const [cardNumber, setCardNumber] = useState(settings.cardNumber)
  const [cardOwner, setCardOwner] = useState(settings.cardOwner)


  return (
    <Section
      title="To‘lov kartasi"
      icon={CreditCard}
      hint="Mijoz karta orqali to‘lashni tanlaganda ko‘rsatiladi"
    >
      <label className="adm-label">Karta raqami</label>
      <input
        className="adm-input"
        value={cardNumber}
        onChange={(e) => setCardNumber(e.target.value)}
        placeholder="0000 0000 0000 0000"
      />

      <label className="adm-label mt-3">Karta egasi</label>
      <input
        className="adm-input"
        value={cardOwner}
        onChange={(e) => setCardOwner(e.target.value)}
        placeholder="ISM FAMILIYA"
      />

      <button
        className="adm-btn adm-btn--primary mt-4 w-full"
        onClick={() => onSave('payment', { cardNumber, cardOwner })}
        disabled={busy}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Saqlash
      </button>
    </Section>
  )
}

function DeliveryCard({
  settings, busy, onSave,
}: {
  settings: { fee: number; freeFrom: number }
  busy: boolean
  onSave: SaveFn
}) {
  const [fee, setFee] = useState(String(settings.fee))
  const [freeFrom, setFreeFrom] = useState(String(settings.freeFrom))


  return (
    <Section
      title="Yetkazib berish"
      icon={Truck}
      hint="Narx buyurtma rasmiylashtirishda hisoblanadi"
    >
      <label className="adm-label">Yetkazish narxi (so‘m)</label>
      <input
        className="adm-input"
        inputMode="numeric"
        value={fee}
        onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))}
      />

      <label className="adm-label mt-3">Shu summadan bepul — 0 bo‘lsa bepul yetkazish yo‘q</label>
      <input
        className="adm-input"
        inputMode="numeric"
        value={freeFrom}
        onChange={(e) => setFreeFrom(e.target.value.replace(/\D/g, ''))}
      />

      <button
        className="adm-btn adm-btn--primary mt-4 w-full"
        onClick={() => onSave('delivery', { fee: Number(fee), freeFrom: Number(freeFrom) })}
        disabled={busy}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Saqlash
      </button>
    </Section>
  )
}

function CourierCard({
  settings, busy, onSave, onError, onOk,
}: {
  settings: {
    toCouriers: boolean
    toGroup: boolean
    groupChatId: string | null
    notifyAdmins: boolean
  }
  busy: boolean
  onSave: SaveFn
  onError: (message: string) => void
  onOk: (message: string) => void
}) {
  const [toCouriers, setToCouriers] = useState(settings.toCouriers)
  const [toGroup, setToGroup] = useState(settings.toGroup)
  const [groupChatId, setGroupChatId] = useState(settings.groupChatId || '')
  const [notifyAdmins, setNotifyAdmins] = useState(settings.notifyAdmins)
  const [testing, setTesting] = useState(false)


  const test = async () => {
    setTesting(true)
    try {
      await apiPost('action', { action: 'settings.testGroup', groupChatId })
      onOk('Sinov xabari yuborildi — guruhni tekshiring')
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Yuborilmadi')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Section
      title="Buyurtma xabarnomalari"
      icon={Users2}
      hint="Yangi buyurtma kimga va qachon tushadi"
    >
      <Toggle
        checked={notifyAdmins}
        onChange={setNotifyAdmins}
        label="Yangi buyurtma — adminlarga"
        hint="Buyurtma tushishi bilan admin va egaga xabar boradi (tasdiqlash uchun)"
      />

      <Toggle
        checked={toCouriers}
        onChange={setToCouriers}
        label="Tasdiqlangach — kuryerlarga"
        hint="«Qabul qilindi» bosilgach buyurtma kuryerga tushadi, «Oldim» tugmasi bilan"
      />

      <Toggle
        checked={toGroup}
        onChange={setToGroup}
        label="Tasdiqlangach — guruhga"
        hint="Tasdiqlangan buyurtmalar umumiy Telegram guruhiga ham tushadi"
      />

      {toGroup && (
        <div className="mt-3 rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
          <label className="adm-label">Guruh chat ID si</label>
          <input
            className="adm-input"
            value={groupChatId}
            onChange={(e) => setGroupChatId(e.target.value)}
            placeholder="-1001234567890"
          />
          <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
            Botni guruhga qo‘shing, admin qiling va guruhda <b>/group</b> deb
            yozing — bot guruh ID sini o‘zi aytadi.
          </p>
          <button
            className="adm-btn adm-btn--ghost mt-2 w-full"
            onClick={test}
            disabled={testing || !groupChatId.trim()}
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            Sinov xabarini yuborish
          </button>
        </div>
      )}

      <button
        className="adm-btn adm-btn--primary mt-4 w-full"
        onClick={() => onSave('courier', { toCouriers, toGroup, groupChatId, notifyAdmins })}
        disabled={busy}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null} Saqlash
      </button>
    </Section>
  )
}

function Toggle({
  checked, onChange, label, hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs" style={{ color: 'var(--muted)' }}>
          {hint}
        </span>
      </span>
    </label>
  )
}
