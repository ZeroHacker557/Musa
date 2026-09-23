import {
  Banknote, CheckCircle2, ChevronDown, CreditCard, LocateFixed, LocateOff, Loader2, MapPin, MessageSquareText,
  Navigation, PackageCheck, Phone, RotateCw, Route, UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatPrice } from '../data'
import { useI18n } from '../i18n'
import { PageTitle } from '../components/layout/PageTitle'
import { getTelegram } from '../utils/telegram'
import type { CourierOrder, CourierOverview } from './api'
import {
  GOOGLE_MAX_STOPS, formatKm, googleMultiRoute, googleRouteTo, planRoute, yandexMultiRoute, yandexRouteTo,
  type Point, type RouteStop,
} from './route'
import type { LocationState } from './use-courier'

export type CourierTab = 'new' | 'active' | 'done'

type Props = {
  data: CourierOverview | null
  error: string | null
  refreshing: boolean
  busyId: string | null
  location: LocationState
  tab: CourierTab
  focusId: string | null
  onTab: (tab: CourierTab) => void
  onRefresh: () => void
  onRetryLocation: () => void
  onTake: (order: CourierOrder) => void
  onDeliver: (order: CourierOrder) => void
}

/** Tashqi havola — Telegram ichida tizim brauzeri/ilovasida ochiladi. */
function openExternal(url: string) {
  const tg = getTelegram()
  if (tg?.openLink) tg.openLink(url)
  else window.open(url, '_blank', 'noopener')
}

const pointOf = (order: CourierOrder): Point | null => order.customer.location

/** Eng eskisi birinchi — joylashuv noma'lum bo'lsa marshrut shundan boshlanadi. */
const byCreated = (a: CourierOrder, b: CourierOrder) =>
  String(a.createdAt).localeCompare(String(b.createdAt))

export function CourierOrdersPage({
  data, error, refreshing, busyId, location, tab, focusId,
  onTab, onRefresh, onRetryLocation, onTake, onDeliver,
}: Props) {
  const { t, lang } = useI18n()
  const start = location.status === 'ok' ? location.point : null

  /*
   * Ikkala ro'yxat ham YAQINLIK zanjiri bo'yicha: har keyingi manzil
   * oldingisiga eng yaqini. «Yangi» — kuryerning joyidan, «Yo'lda» —
   * ham shunday, lekin u haqiqiy marshrut sifatida raqamlanadi.
   */
  const newPlan = useMemo(
    () => planRoute([...(data?.available ?? [])].sort(byCreated), pointOf, start),
    [data?.available, start],
  )
  const activePlan = useMemo(
    () => planRoute([...(data?.active ?? [])].sort(byCreated), pointOf, start),
    [data?.active, start],
  )

  const counts = {
    new: data?.available.length ?? 0,
    active: data?.active.length ?? 0,
    done: data?.done.length ?? 0,
  }

  const firstName = (data?.profile.name || '').split(' ')[0]

  return (
    <>
      <header className="page-head flex items-center justify-between gap-3 px-5 pt-8 sm:px-10">
        <div className="min-w-0">
          {firstName && (
            <p className="truncate text-sm font-bold" style={{ color: 'var(--muted)' }}>
              {t('courier.hello', { name: firstName })}
            </p>
          )}
          <PageTitle className="text-3xl font-extrabold">{t('courier.navOrders')}</PageTitle>
        </div>
        <button
          className="crr-icon-btn ml-auto"
          onClick={onRefresh}
          aria-label={t('common.retry')}
          disabled={refreshing}
        >
          <RotateCw size={19} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Bugungi xulosa */}
      <section className="crr-summary mx-5 mt-5 sm:mx-10">
        <SummaryTile icon={<PackageCheck size={18} />} label={t('courier.sumDelivered')} value={data ? String(data.stats.today.delivered) : null} />
        <SummaryTile icon={<Navigation size={18} />} label={t('courier.sumOnWay')} value={data ? String(counts.active) : null} />
        <SummaryTile
          icon={<Banknote size={18} />}
          label={t('courier.sumCash')}
          value={data ? formatPrice(data.stats.today.cash) : null}
          tone="gold"
        />
      </section>

      {/* Bo'limlar */}
      <div className="crr-segmented mx-5 mt-5 sm:mx-10" role="tablist">
        {(['new', 'active', 'done'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={'crr-segmented__item ' + (tab === key ? 'active' : '')}
            onClick={() => onTab(key)}
          >
            {t(key === 'new' ? 'courier.tabNew' : key === 'active' ? 'courier.tabActive' : 'courier.tabDone')}
            {counts[key] > 0 && <span className={'crr-count ' + (key === 'new' ? 'crr-count--hot' : '')}>{counts[key]}</span>}
          </button>
        ))}
      </div>

      {tab !== 'done' && <LocationBar location={location} onRetry={onRetryLocation} />}

      <section className="px-5 pb-8 pt-4 sm:px-10">
        {!data && !error && <ListSkeleton />}

        {error && !data && (
          <div className="crr-empty">
            <p className="font-extrabold" style={{ color: 'var(--ink)' }}>{t('courier.loadFailed')}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{error}</p>
            <button className="crr-btn crr-btn--primary mt-4" onClick={onRefresh}>{t('common.retry')}</button>
          </div>
        )}

        {data && tab === 'new' && (
          <StopList
            stops={newPlan.stops}
            empty={[t('courier.emptyNew'), t('courier.emptyNewText')]}
            render={(stop, index) => (
              <OrderCard
                key={stop.item.id}
                order={stop.item}
                stop={stop}
                index={index}
                numbered={false}
                focused={stop.item.id === focusId}
                busy={busyId === stop.item.id}
                lang={lang}
                action={
                  <button
                    className="crr-btn crr-btn--primary crr-btn--block"
                    disabled={busyId !== null}
                    onClick={() => onTake(stop.item)}
                  >
                    {busyId === stop.item.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                    {t('courier.take')}
                  </button>
                }
              />
            )}
          />
        )}

        {data && tab === 'active' && (
          <>
            {activePlan.stops.length > 0 && <RouteCard stops={activePlan.stops} totalKm={activePlan.totalKm} lang={lang} />}
            <StopList
              stops={activePlan.stops}
              empty={[t('courier.emptyActive'), t('courier.emptyActiveText')]}
              render={(stop, index) => (
                <OrderCard
                  key={stop.item.id}
                  order={stop.item}
                  stop={stop}
                  index={index}
                  numbered
                  focused={stop.item.id === focusId}
                  busy={busyId === stop.item.id}
                  lang={lang}
                  action={
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      {stop.item.customer.location ? (
                        <NavigateButton point={stop.item.customer.location} />
                      ) : (
                        <span />
                      )}
                      <button
                        className="crr-btn crr-btn--primary crr-btn--block"
                        disabled={busyId !== null}
                        onClick={() => onDeliver(stop.item)}
                      >
                        {busyId === stop.item.id ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={18} />}
                        {t('courier.deliver')}
                      </button>
                    </div>
                  }
                />
              )}
            />
          </>
        )}

        {data && tab === 'done' && (
          data.done.length ? (
            <div className="grid gap-3">
              {data.done.map((order, index) => (
                <OrderCard key={order.id} order={order} index={index} numbered={false} focused={false} busy={false} lang={lang} />
              ))}
            </div>
          ) : (
            <Empty title={t('courier.emptyDone')} text={t('courier.emptyDoneText')} />
          )
        )}
      </section>
    </>
  )
}

function SummaryTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | null; tone?: 'gold' }) {
  return (
    <div className={'crr-tile ' + (tone === 'gold' ? 'crr-tile--gold' : '')}>
      <span className="crr-tile__icon">{icon}</span>
      {value === null ? <span className="crr-skel h-5 w-10" /> : <b className="crr-tile__value">{value}</b>}
      <span className="crr-tile__label">{label}</span>
    </div>
  )
}

function LocationBar({ location, onRetry }: { location: LocationState; onRetry: () => void }) {
  const { t } = useI18n()
  if (location.status === 'loading') {
    return (
      <p className="crr-locbar mx-5 mt-3 sm:mx-10">
        <Loader2 size={15} className="animate-spin" /> {t('courier.locating')}
      </p>
    )
  }
  if (location.status === 'ok') {
    return (
      <p className="crr-locbar crr-locbar--ok mx-5 mt-3 sm:mx-10">
        <LocateFixed size={15} /> {t('courier.locationOn')}
      </p>
    )
  }
  return (
    <div className="crr-locbar crr-locbar--off mx-5 mt-3 sm:mx-10">
      <LocateOff size={15} className="shrink-0" />
      <span className="min-w-0 flex-1">{t('courier.locationOff')}</span>
      <button className="crr-link" onClick={onRetry}>{t('courier.locationEnable')}</button>
    </div>
  )
}

function StopList({
  stops, empty, render,
}: {
  stops: RouteStop<CourierOrder>[]
  empty: [string, string]
  render: (stop: RouteStop<CourierOrder>, index: number) => React.ReactNode
}) {
  if (!stops.length) return <Empty title={empty[0]} text={empty[1]} />
  return <div className="grid gap-3">{stops.map((stop, index) => render(stop, index))}</div>
}

/** Butun marshrut — umumiy yo'l va xaritada ochish. */
function RouteCard({ stops, totalKm, lang }: { stops: RouteStop<CourierOrder>[]; totalKm: number; lang: 'uz' | 'ru' }) {
  const { t } = useI18n()
  const points = stops.map((s) => s.item.customer.location).filter((p): p is Point => p !== null)
  const yandex = yandexMultiRoute(points)
  const google = googleMultiRoute(points)

  return (
    <div className="crr-route mb-3">
      <span className="crr-route__icon"><Route size={20} /></span>
      <div className="min-w-0 flex-1">
        <b className="block text-sm" style={{ color: 'var(--ink)' }}>{t('courier.routeTitle')}</b>
        <span className="block text-xs" style={{ color: 'var(--muted)' }}>
          {t('courier.routeStops', { count: stops.length, km: formatKm(totalKm, lang) })}
        </span>
      </div>
      {(yandex || google) && (
        <div className="crr-route__actions">
          {yandex && (
            <button className="crr-chip" onClick={() => openExternal(yandex)}>
              <Navigation size={14} /> {t('courier.routeYandex')}
            </button>
          )}
          {google && (
            <button className="crr-chip" onClick={() => openExternal(google)}>
              <Navigation size={14} /> {t('courier.routeGoogle', { count: Math.min(points.length, GOOGLE_MAX_STOPS) })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Bitta manzilga yo'l — bosilganda Yandex yoki Google tanlanadi. */
function NavigateButton({ point }: { point: Point }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button className="crr-btn crr-btn--ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Navigation size={17} /> {t('courier.navigate')}
      </button>
      {open && (
        <div className="crr-menu">
          <button onClick={() => { setOpen(false); openExternal(yandexRouteTo(point)) }}>Yandex</button>
          <button onClick={() => { setOpen(false); openExternal(googleRouteTo(point)) }}>Google Maps</button>
        </div>
      )}
    </div>
  )
}

function timeAgo(value: string | null, t: ReturnType<typeof useI18n>['t']): string {
  const ms = Date.parse(value || '')
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000))
  if (minutes < 1) return t('courier.justNow')
  if (minutes < 60) return t('courier.minutesAgo', { n: minutes })
  return t('courier.hoursAgo', { n: Math.floor(minutes / 60) })
}

function clock(value: string | null): string {
  const ms = Date.parse(value || '')
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function OrderCard({
  order, stop, index, numbered, focused, busy, lang, action,
}: {
  order: CourierOrder
  stop?: RouteStop<CourierOrder>
  index: number
  numbered: boolean
  focused: boolean
  busy: boolean
  lang: 'uz' | 'ru'
  action?: React.ReactNode
}) {
  const { t } = useI18n()
  const [itemsOpen, setItemsOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)

  // Bot xabaridagi «Ilovada ochish» — aynan shu buyurtmaga olib keladi
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focused])

  const c = order.customer
  const cash = order.paymentMethod !== 'Karta'
  const delivered = order.status === 'Yetkazildi'
  const phone = c.recipientPhone || c.phone
  const who = c.recipientName || c.name
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)

  let distance: string | null = null
  if (stop?.legKm != null) {
    distance = index === 0 ? t('courier.fromYou', { km: formatKm(stop.legKm, lang) }) : t('courier.fromPrev', { km: formatKm(stop.legKm, lang) })
  } else if (stop && !c.location) {
    distance = t('courier.noPoint')
  }

  return (
    <article
      ref={ref}
      className={'crr-card ' + (focused ? 'crr-card--focus ' : '') + (busy ? 'crr-card--busy' : '')}
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        {numbered && <span className="crr-stop">{index + 1}</span>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="text-base" style={{ color: 'var(--ink)' }}>{order.number}</b>
            <span className="text-xs" style={{ color: 'var(--faint)' }}>
              {delivered ? t('courier.deliveredAt', { time: clock(order.deliveredAt) }) : timeAgo(order.createdAt, t)}
            </span>
            {order.assignedToMe && !delivered && order.status === 'Qabul qilindi' && (
              <span className="crr-badge">{t('courier.assigned')}</span>
            )}
          </div>
          {distance && (
            <span className={'crr-distance ' + (stop?.legKm != null && stop.legKm > 10 ? 'crr-distance--far' : '')}>
              <Navigation size={12} /> {distance}
            </span>
          )}
        </div>
      </div>

      <p className="crr-line mt-3">
        <MapPin size={16} className="crr-line__icon" />
        <span style={{ color: 'var(--ink)' }}>{c.address || '—'}</span>
      </p>

      {c.comment && (
        <p className="crr-line crr-line--note mt-2">
          <MessageSquareText size={16} className="crr-line__icon" />
          <span>{c.comment}</span>
        </p>
      )}

      <div className="crr-person mt-3">
        <span className="crr-person__avatar"><UserRound size={16} /></span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-sm" style={{ color: 'var(--ink)' }}>{who || '—'}</b>
          <span className="block truncate text-xs" style={{ color: 'var(--muted)' }}>
            {c.recipientName ? `${t('courier.recipient')} · ` : ''}{phone}
          </span>
        </span>
        {phone && !delivered && (
          <a className="crr-call" href={`tel:${phone.replace(/[^\d+]/g, '')}`} aria-label={t('courier.call')}>
            <Phone size={17} />
          </a>
        )}
      </div>

      <button className="crr-items-toggle mt-3" onClick={() => setItemsOpen((v) => !v)} aria-expanded={itemsOpen}>
        {t('courier.items', { count })}
        <ChevronDown size={16} style={{ transform: itemsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {itemsOpen && (
        <ul className="crr-items">
          {order.items.map((item, i) => (
            <li key={i}>
              <span className="min-w-0 flex-1 truncate">{item.name}{item.size ? ` · ${item.size}` : ''}</span>
              <b>× {item.quantity}</b>
            </li>
          ))}
        </ul>
      )}

      <div className={'crr-pay mt-3 ' + (cash ? 'crr-pay--cash' : 'crr-pay--card')}>
        {cash ? <Banknote size={18} /> : <CreditCard size={18} />}
        <span className="min-w-0 flex-1 text-xs font-bold">{cash ? t('courier.cashCollect') : t('courier.paidCard')}</span>
        <b className="text-base">{formatPrice(order.total)}</b>
      </div>

      {action && <div className="mt-3">{action}</div>}
    </article>
  )
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="crr-empty">
      <span className="crr-empty__icon"><PackageCheck size={30} /></span>
      <p className="mt-3 font-extrabold" style={{ color: 'var(--ink)' }}>{title}</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{text}</p>
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="crr-card">
          <span className="crr-skel h-5 w-24" />
          <span className="crr-skel mt-3 h-4 w-full" />
          <span className="crr-skel mt-2 h-4 w-2/3" />
          <span className="crr-skel mt-4 h-10 w-full" />
        </div>
      ))}
    </div>
  )
}
