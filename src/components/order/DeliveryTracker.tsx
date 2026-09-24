import { Car, MapPin, Phone, Radio, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import { TRACKING_FRESH_MS, liveMinutes, useOrderTracking } from '../../lib/tracking'
import type { Order } from '../../types/domain'

type Props = {
  orders: Order[]
  /** Bosilganda — «Kuryer qayerda» jonli xaritasi. */
  onOpen: (order: Order) => void
}

const HIDDEN_KEY = 'musa:tracker-hidden'

function readHidden(): string | null {
  try {
    return sessionStorage.getItem(HIDDEN_KEY)
  } catch {
    return null
  }
}

/**
 * «Kuryer yo'lda» — mijoz ilovasining pastida suzib turadigan kartochka.
 *
 * Buyurtma «Yetkazilmoqda» bo'lishi bilan chiqadi: yo'l chizig'i
 * bo'ylab mashina manzil tomon siljiydi (qancha yo'l qolgani taxminiy
 * vaqtdan hisoblanadi), oxirida manzil belgisi lipillaydi. Kuryer «Yetib
 * keldim» bossa — mashina manzilga yetib to'xtaydi: «Kuryer eshik
 * oldida!».
 *
 * Ma'lumot buyurtmaning o'zidan: mijoz o'z buyurtmalarini Firestore'dan
 * jonli o'qiydi, shuning uchun kuryer bosgan zahoti bu yerda ko'rinadi.
 *
 * Bir vaqtda bir nechta buyurtma yo'lda bo'lsa — tepada raqamlar
 * chiqadi, mijoz qaysi birini kuzatishni tanlaydi.
 */
export function DeliveryTracker({ orders, onOpen }: Props) {
  const { t } = useI18n()
  const onWay = useMemo(() => orders.filter((o) => o.status === 'Yetkazilmoqda'), [orders])
  const [pickedId, setPickedId] = useState<string | null>(null)
  const order = useMemo(() => onWay.find((o) => o.id === pickedId) ?? onWay[0] ?? null, [onWay, pickedId])

  // Daqiqalar sanog'i va mashina joyi vaqt o'tishi bilan yangilanadi
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!order) return
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [order])

  // Kuryerning jonli joyi (bo'lsa) — daqiqalar vaqt emas, masofadan hisoblanadi
  const home = useMemo(() => {
    const loc = order?.customer?.location
    return loc && Number.isFinite(loc.lat) ? { lat: loc.lat, lng: loc.lng } : null
  }, [order?.customer?.location])
  const tracking = useOrderTracking(order?.id ?? null, home)

  // «×» — shu holat uchun yashiriladi; kuryer yetib kelsa yana chiqadi
  const stateKey = order ? `${order.id}:${order.arrivedAt ? 'arrived' : 'way'}` : ''
  const [hidden, setHidden] = useState(readHidden)
  if (!order || hidden === stateKey) return null

  const hide = () => {
    setHidden(stateKey)
    try {
      sessionStorage.setItem(HIDDEN_KEY, stateKey)
    } catch {
      // saqlanmasa ham shu seansda yashirin qoladi
    }
  }

  const arrived = Boolean(order.arrivedAt)
  const start = Date.parse(order.takenAt || '')
  const end = Date.parse(order.etaAt || '')
  const live = tracking !== null && home !== null && now - Date.parse(tracking.at) < TRACKING_FRESH_MS
  const minutesLeft = live
    ? liveMinutes(tracking, home)
    : Number.isFinite(end) ? Math.ceil((end - now) / 60_000) : null
  // Kuryer avval boshqa manzil(lar)ga boradi — mijoz nega kutayotganini bilsin
  const stopsBefore = live ? tracking.stopsBefore : Number(order.etaStops) || 0

  // Mashina yo'lning qayerida: olingandan beri o'tgan vaqt / taxminiy vaqt
  let progress = 0.35
  // Yetib keldi — mashina manzil belgisining yonida to'xtaydi (ustiga chiqmaydi)
  if (arrived) progress = 0.9
  else if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    // Yo'lda bo'lsa manzilga to'liq yetmaydi — bu «yetib keldim» uchun
    progress = Math.min(0.82, Math.max(0.08, (now - start) / (end - start)))
  }

  const title = arrived ? t('delivery.arrivedTitle') : t('delivery.onWayTitle')
  const subtitle = arrived
    ? t('delivery.arrivedText')
    : minutesLeft === null
      ? t('delivery.onWaySoon')
      : minutesLeft > 0
        ? t('delivery.minutesLeft', { n: minutesLeft })
        : t('delivery.almostThere')
  const phone = (order.courierPhone || tracking?.courierPhone)?.replace(/[^\d+]/g, '')

  return (
    <div className={'dlv ' + (arrived ? 'is-arrived' : '')} role="status" aria-live="polite">
      {onWay.length > 1 && (
        <div className="dlv__tabs" role="tablist" aria-label={t('delivery.pickOrder')}>
          {onWay.map((o) => (
            <button
              key={o.id}
              role="tab"
              aria-selected={o.id === order.id}
              className={'dlv__tab ' + (o.id === order.id ? 'is-on' : '')}
              onClick={() => setPickedId(o.id)}
            >
              {o.arrivedAt && <span className="dlv__tab-dot" />}
              {o.orderNumber}
            </button>
          ))}
        </div>
      )}
      <button className="dlv__main" onClick={() => onOpen(order)}>
        <span className="dlv__road" aria-hidden="true">
          <span className="dlv__track" />
          <span className="dlv__done" style={{ width: `${progress * 100}%` }} />
          <span className="dlv__car" style={{ left: `${progress * 100}%` }}>
            <Car size={17} strokeWidth={2.4} />
          </span>
          <span className="dlv__pin">
            <MapPin size={18} strokeWidth={2.4} />
          </span>
        </span>

        <span className="dlv__text">
          <b className="dlv__title">
            {title}
            {live && !arrived && (
              <span className="dlv__live"><Radio size={11} /> {t('delivery.live')}</span>
            )}
          </b>
          <span className="dlv__sub">
            {subtitle}
            {!arrived && stopsBefore > 0
              ? ` · ${t('delivery.stopsBefore', { n: stopsBefore })}`
              : order.courierName ? ` · ${order.courierName}` : ''}
            {' · '}{order.orderNumber}
          </span>
        </span>
      </button>

      {phone && (
        <a className="dlv__call" href={`tel:${phone}`} aria-label={t('delivery.call')}>
          <Phone size={17} />
        </a>
      )}
      <button className="dlv__close" onClick={hide} aria-label={t('common.close')}>
        <X size={15} />
      </button>
    </div>
  )
}
