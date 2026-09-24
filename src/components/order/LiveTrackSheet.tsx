import L from 'leaflet'
import { ChevronLeft, Crosshair, Phone, Radio, Receipt } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { useI18n } from '../../i18n'
import { TRACKING_FRESH_MS, liveMinutes, useOrderTracking } from '../../lib/tracking'
import { distanceKm, formatKm, type Point } from '../../courier/route'
import type { Order } from '../../types/domain'

type Props = {
  order: Order
  onClose: () => void
  onReceipt: (order: Order) => void
}

const CAR_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>' +
  '<circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>'
const HOME_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/></svg>'

// Mashina belgisi — silliq siljish uchun alohida sinf (styles.css → .lts-car-icon)
const carIcon = L.divIcon({
  className: 'lts-car-icon',
  html: `<div class="lts-car"><span class="lts-car__pulse"></span>${CAR_SVG}</div>`,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
})
const homeIcon = L.divIcon({
  className: '',
  html: `<div class="lts-home">${HOME_SVG}</div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
})

/** Birinchi joylashuvda ikkalasini sig'diradi; «kuzatish» yoqilsa — kuryer ortidan yuradi. */
function Camera({ courier, home, follow, fitKey }: {
  courier: Point | null
  home: Point | null
  follow: boolean
  fitKey: number
}) {
  const map = useMap()
  // Qaysi holat uchun sig'dirilgan: tugma bosilishi (fitKey) va kuryer
  // joylashuvi kelgan-kelmagani. Kuryer keyinroq paydo bo'lsa — qayta
  // sig'diriladi, aks holda mashina ekrandan chetda qolardi.
  const fitted = useRef('')
  const hasCourier = courier !== null

  useEffect(() => {
    const key = `${fitKey}:${hasCourier ? 1 : 0}`
    if (fitted.current === key) return
    const pts = [courier, home].filter((p): p is Point => p !== null)
    if (!pts.length) return
    fitted.current = key
    if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 15)
    else map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [70, 70], maxZoom: 16 })
  }, [map, courier, home, fitKey, hasCourier])

  useEffect(() => {
    if (follow && courier) map.panTo([courier.lat, courier.lng], { animate: true, duration: 1 })
  }, [map, courier, follow])

  return null
}

/**
 * «Kuryer qayerda» — jonli xarita.
 *
 * Mashina belgisi har yangilanishda manzil tomon silliq siljiydi, qolgan
 * masofa va vaqt jonli hisoblanadi. Joylashuv kelmagan bo'lsa (kuryer
 * hali ulashmagan) — faqat manzil va tushuntirish.
 */
export default function LiveTrackSheet({ order, onClose, onReceipt }: Props) {
  const { t, lang } = useI18n()
  const home = useMemo<Point | null>(() => {
    const loc = order.customer?.location
    return loc && Number.isFinite(loc.lat) ? { lat: loc.lat, lng: loc.lng } : null
  }, [order.customer?.location])
  const tracking = useOrderTracking(order.id, home)
  const [follow, setFollow] = useState(false)
  const [fitKey, setFitKey] = useState(0)

  // «Yangilandi 15 s oldin» — vaqt holatda, render toza qoladi
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(timer)
  }, [])

  // Yangi joylashuv kelgandagina yangi obyekt — xarita har renderda siljimasin
  const courier = useMemo<Point | null>(() => (tracking ? { lat: tracking.lat, lng: tracking.lng } : null), [tracking])
  const age = tracking ? now - Date.parse(tracking.at) : Infinity
  const fresh = age < TRACKING_FRESH_MS
  const arrived = Boolean(order.arrivedAt)
  const km = courier && home ? distanceKm(courier, home) : null
  const minutes = courier && home && fresh ? liveMinutes(courier, home) : null
  const phone = order.courierPhone?.replace(/[^\d+]/g, '')
  const seconds = Math.max(0, Math.round(age / 1000))

  const title = arrived
    ? t('delivery.arrivedTitle')
    : minutes !== null ? t('delivery.minutesLeft', { n: minutes }) : t('delivery.onWayTitle')

  return (
    <div className="lts" role="dialog" aria-modal="true">
      <div className="lts__map">
        <MapContainer
          center={home ? [home.lat, home.lng] : [41.3111, 69.2797]}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Camera courier={courier} home={home} follow={follow} fitKey={fitKey} />
          {courier && home && (
            <Polyline
              positions={[[courier.lat, courier.lng], [home.lat, home.lng]]}
              pathOptions={{ color: '#0a7a3d', weight: 4, dashArray: '2 10', lineCap: 'round', opacity: 0.8 }}
            />
          )}
          {home && <Marker position={[home.lat, home.lng]} icon={homeIcon} />}
          {courier && <Marker position={[courier.lat, courier.lng]} icon={carIcon} zIndexOffset={1000} />}
        </MapContainer>

        <button className="lts__back" onClick={onClose} aria-label={t('common.back')}>
          <ChevronLeft size={22} />
        </button>
        {courier && (
          <button
            className={'lts__follow ' + (follow ? 'is-on' : '')}
            onClick={() => {
              setFollow((v) => !v)
              if (follow) setFitKey((k) => k + 1)
            }}
            aria-pressed={follow}
            aria-label={t('delivery.follow')}
          >
            <Crosshair size={20} />
          </button>
        )}
      </div>

      <div className={'lts__card ' + (arrived ? 'is-arrived' : '')}>
        <span className="lts__grip" />
        <div className="flex items-center gap-3">
          <span className="lts__avatar">{(order.courierName || 'K').charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <b className="block text-lg font-extrabold" style={{ color: 'var(--ink)' }}>{title}</b>
            <span className="block truncate text-sm" style={{ color: 'var(--muted)' }}>
              {order.courierName || t('rating.courier')} · {order.orderNumber}
              {km !== null && !arrived ? ` · ${formatKm(km, lang)}` : ''}
            </span>
          </div>
          {phone && (
            <a className="lts__call" href={`tel:${phone}`} aria-label={t('delivery.call')}>
              <Phone size={19} />
            </a>
          )}
        </div>

        <p className={'lts__status ' + (fresh ? 'is-live' : '')}>
          {tracking ? (
            <>
              <Radio size={14} />
              {fresh
                ? t('delivery.updated', {
                    s: seconds < 60
                      ? `${seconds} ${lang === 'ru' ? 'с' : 's'}`
                      : `${Math.round(seconds / 60)} ${lang === 'ru' ? 'мин' : 'daq'}`,
                  })
                : t('delivery.stale')}
            </>
          ) : (
            t('delivery.noLocation')
          )}
        </p>

        <button className="lts__receipt" onClick={() => onReceipt(order)}>
          <Receipt size={16} /> {t('delivery.receipt')}
        </button>
      </div>
    </div>
  )
}
