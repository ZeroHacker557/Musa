import {
  Banknote, CheckCircle2, ChevronLeft, Clock3, CreditCard, Loader2, MapPin, MessageSquareText, Package,
  PackageCheck, Phone, UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { formatPrice } from '../data'
import { useI18n } from '../i18n'
import { usePresence } from '../hooks/use-presence'
import type { CourierOrder } from './api'
import { clock, telHref, timeAgo } from './format'
import { NavigateButton } from './NavigateButton'
import { CourierReceipt } from './CourierReceipt'

type Props = {
  order: CourierOrder | null
  busy: boolean
  onClose: () => void
  onTake: (order: CourierOrder) => void
  onDeliver: (order: CourierOrder) => void
}

/**
 * Buyurtma tafsilotlari — to'liq ekran.
 *
 * Mahsulotlar RASMI bilan faqat shu yerda: kuryer do'kondan olayotganda
 * nimani olishini ko'rib tekshiradi. Ro'yxatdagi kartochka esa ixcham
 * qoladi — u yerda manzil, masofa va summa kifoya.
 */
export function OrderDetail({ order, busy, onClose, onTake, onDeliver }: Props) {
  const { t } = useI18n()
  const { mounted, leaving } = usePresence(order !== null, 240)
  // Yopilish animatsiyasi paytida ham oxirgi buyurtma ko'rinib tursin
  const [shown, setShown] = useState(order)
  if (order && order !== shown) setShown(order)
  if (!mounted || !shown) return null

  const c = shown.customer
  const cash = shown.paymentMethod !== 'Karta'
  const status =
    shown.status === 'Yetkazildi' ? 'done' : shown.status === 'Yetkazilmoqda' ? 'active' : 'new'
  const phone = c.recipientPhone || c.phone
  const count = shown.items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className={'crr-detail ' + (leaving ? 'leaving' : '')} role="dialog" aria-modal="true">
      <header className="crr-detail__head">
        <button className="crr-icon-btn" onClick={onClose} aria-label={t('common.back')}>
          <ChevronLeft size={21} />
        </button>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-lg font-extrabold" style={{ color: 'var(--ink)' }}>
            {shown.number}
          </b>
          <span className="block text-xs" style={{ color: 'var(--muted)' }}>{t('courier.detailsTitle')}</span>
        </div>
        <span className={'crr-status crr-status--' + status}>
          {t(status === 'done' ? 'courier.statusDone' : status === 'active' ? 'courier.statusActive' : 'courier.statusNew')}
        </span>
      </header>

      <div className="crr-detail__body">
        {/* Vaqtlar */}
        <section className="crr-timeline">
          <span><Clock3 size={14} /> {t('courier.createdAt')} {clock(shown.createdAt)} · {timeAgo(shown.createdAt, t)}</span>
          {shown.takenAt && <span><Package size={14} /> {t('courier.takenAt')} {clock(shown.takenAt)}</span>}
          {shown.deliveredAt && <span><CheckCircle2 size={14} /> {t('courier.deliveredAt', { time: clock(shown.deliveredAt) })}</span>}
        </section>

        {/* Manzil */}
        <section className="crr-block">
          <p className="crr-block__title">{t('courier.address')}</p>
          <p className="crr-line">
            <MapPin size={17} className="crr-line__icon" />
            <span style={{ color: 'var(--ink)' }}>{c.address || '—'}</span>
          </p>
          {c.comment && (
            <p className="crr-line crr-line--note mt-2">
              <MessageSquareText size={16} className="crr-line__icon" />
              <span>{c.comment}</span>
            </p>
          )}
          {c.location && status !== 'done' && (
            <div className="mt-3">
              <NavigateButton point={c.location} block />
            </div>
          )}
        </section>

        {/* Mijoz */}
        <section className="crr-block">
          <p className="crr-block__title">{c.recipientName ? t('courier.recipient') : t('courier.customer')}</p>
          <div className="crr-person" style={{ borderTop: 0, paddingTop: 0 }}>
            <span className="crr-person__avatar"><UserRound size={16} /></span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm" style={{ color: 'var(--ink)' }}>{c.recipientName || c.name || '—'}</b>
              <span className="block truncate text-xs" style={{ color: 'var(--muted)' }}>{phone}</span>
              {c.recipientName && c.name && (
                <span className="block truncate text-xs" style={{ color: 'var(--faint)' }}>
                  {t('courier.orderedBy', { name: c.name })} · {c.phone}
                </span>
              )}
            </span>
            {phone && status !== 'done' && (
              <a className="crr-call" href={telHref(phone)} aria-label={t('courier.call')}>
                <Phone size={17} />
              </a>
            )}
          </div>
        </section>

        {/* Yetkazilgan — to'liq chek (mahsulotlar rasm bilan uning ichida) */}
        {status === 'done' && (
          <section className="mt-3.5">
            <CourierReceipt order={shown} />
          </section>
        )}

        {/* Mahsulotlar — rasmlar bilan */}
        {status !== 'done' && (
          <section className="crr-block">
            <p className="crr-block__title">
              {t('courier.products')} <span style={{ color: 'var(--faint)' }}>· {t('courier.items', { count })}</span>
            </p>
            <ul className="crr-products">
              {shown.items.map((item, i) => (
                <li key={i}>
                  <ItemImage src={item.image} />
                  <span className="min-w-0 flex-1">
                    <b className="crr-products__name">{item.name}</b>
                    <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                      {item.size ? `${item.size} · ` : ''}{formatPrice(item.price)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="crr-qty">× {item.quantity}</span>
                    <b className="mt-1 block text-sm" style={{ color: 'var(--ink)' }}>{formatPrice(item.price * item.quantity)}</b>
                  </span>
                </li>
              ))}
            </ul>

            <div className="crr-total">
              <span>{t('courier.total')}</span>
              <b>{formatPrice(shown.total)}</b>
            </div>
            <div className={'crr-pay mt-3 ' + (cash ? 'crr-pay--cash' : 'crr-pay--card')}>
              {cash ? <Banknote size={18} /> : <CreditCard size={18} />}
              <span className="min-w-0 flex-1 text-xs font-bold">{cash ? t('courier.cashCollect') : t('courier.paidCard')}</span>
              <b className="text-base">{formatPrice(shown.total)}</b>
            </div>
          </section>
        )}
      </div>

      {/* Amal — pastda doim ko'rinib turadi */}
      {status !== 'done' && (
        <footer className="crr-detail__foot">
          {status === 'new' ? (
            <button className="crr-btn crr-btn--primary crr-btn--block" disabled={busy} onClick={() => onTake(shown)}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {t('courier.take')}
            </button>
          ) : (
            <button className="crr-btn crr-btn--primary crr-btn--block" disabled={busy} onClick={() => onDeliver(shown)}>
              <PackageCheck size={18} />
              {t('courier.deliver')}
            </button>
          )}
        </footer>
      )}
    </div>
  )
}

/** Mahsulot rasmi; yo'q yoki yuklanmasa — belgi. */
function ItemImage({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="crr-products__img">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <Package size={22} />
      )}
    </span>
  )
}
