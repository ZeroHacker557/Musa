import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Bike, LocateFixed, MapPinned, Radio, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { useCourierLocations, useOrders, useStaff, type AdminOrder, type CourierLocationRow } from '../lib/live'
import type { Staff } from '../lib/auth'
import { planRoute, type Point } from '../../courier/route'

/** Toshkent markazi — ma'lumot kelguncha. */
const CENTER: [number, number] = [41.3111, 69.2797]

/** Kuryerlar ranglari — xaritada kuryer va uning buyurtmalari bir xil rangda. */
const PALETTE = ['#0a7a3d', '#1f6fd0', '#a9760a', '#b4368f', '#0f8f8f', '#d0592c']

type Freshness = 'fresh' | 'recent' | 'lost'

/** Joylashuv qanchalik yangi: 2 daq — jonli, 10 daq — eskiroq, undan keyin — aloqa uzilgan. */
function freshness(at: string, now: number): Freshness {
  const age = now - Date.parse(at)
  if (!Number.isFinite(age) || age > 10 * 60_000) return 'lost'
  return age > 2 * 60_000 ? 'recent' : 'fresh'
}

function ago(at: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(at)) / 1000))
  if (!Number.isFinite(s)) return '—'
  if (s < 60) return `${s} s oldin`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} daq oldin`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h} soat oldin` : `${Math.floor(h / 24)} kun oldin`
}

const pointOf = (o: AdminOrder): Point | null => {
  const loc = o.customer?.location
  return loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng) ? { lat: loc.lat, lng: loc.lng } : null
}

function courierIcon(name: string, color: string, state: Freshness, heading: number | null) {
  const arrow = heading !== null && state === 'fresh'
    ? `<i class="amap-courier__arrow" style="transform: rotate(${heading}deg)"></i>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div class="amap-courier is-${state}" style="--c:${color}">${arrow}<span>${name.charAt(0).toUpperCase()}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

function orderIcon(label: string, color: string | null) {
  return L.divIcon({
    className: '',
    html: `<div class="amap-order ${color ? '' : 'is-waiting'}" style="--c:${color ?? '#8a9c92'}"><span>${label}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -34],
  })
}

/**
 * Hamma belgilar ko'rinadigan qilib yaqinlashtiradi: birinchi ma'lumot
 * kelganda va «Hammasini ko'rsatish» bosilganda (`trigger` o'zgaradi).
 */
function FitAll({ points, trigger }: { points: [number, number][]; trigger: number }) {
  const map = useMap()
  const fitted = useRef(-1)
  useEffect(() => {
    if (fitted.current === trigger || points.length === 0) return
    fitted.current = trigger
    if (points.length === 1) map.setView(points[0], 14)
    else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 })
  }, [map, points, trigger])
  return null
}

/** Ro'yxatdan tanlangan kuryerga uchib boradi. */
function FlyTo({ target }: { target: { lat: number; lng: number; key: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 })
  }, [map, target])
  return null
}

/**
 * Kuryerlar xaritasi — kim qayerda va nimani olib ketyapti.
 *
 * Joylashuv ikki manbadan: Telegram «Jonli joylashuv»i (kuryer botga
 * bir marta ulashadi, keyin ilova yopiq bo'lsa ham yangilanib turadi) va
 * ochiq mini app. Belgi rangi joylashuv yangiligini bildiradi: yashil —
 * jonli, sariq — biroz eski, kulrang — aloqa uzilgan (10 daqiqadan ortiq).
 * Har kuryerdan uning yo'ldagi buyurtmalariga yaqinlik tartibida chiziq
 * tortiladi.
 */
export default function MapPage({ me }: { me: Staff }) {
  const { rows: locations, loading } = useCourierLocations()
  const { orders } = useOrders()
  // Smena holati — xodimlar ro'yxati faqat egaga ochiq (Rules)
  const { staff } = useStaff(me.role === 'owner')
  const [now, setNow] = useState(() => Date.now())
  const [fly, setFly] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [fitTrigger, setFitTrigger] = useState(0)
  const markers = useRef(new Map<string, L.Marker>())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  const colorOf = useMemo(() => {
    const map = new Map<string, string>()
    ;[...locations].sort((a, b) => a.name.localeCompare(b.name)).forEach((l, i) => map.set(l.uid, PALETTE[i % PALETTE.length]))
    return (uid: string) => map.get(uid) ?? PALETTE[0]
  }, [locations])

  const active = orders.filter((o) => o.status === 'Yetkazilmoqda' && o.courierId)
  const waiting = orders.filter((o) => o.status === 'Qabul qilindi' && !o.courierId && pointOf(o))

  // Har kuryer uchun: joylashuv, yo'ldagi buyurtmalar (yaqinlik tartibida)
  const couriers = useMemo(() => {
    const byId = new Map<string, { loc: CourierLocationRow | null; name: string; orders: AdminOrder[] }>()
    for (const l of locations) byId.set(l.uid, { loc: l, name: l.name, orders: [] })
    for (const o of active) {
      const row = byId.get(o.courierId!) ?? { loc: null, name: o.courierName || 'Kuryer', orders: [] }
      row.orders.push(o)
      byId.set(o.courierId!, row)
    }
    return [...byId.entries()].map(([uid, row]) => {
      const plan = planRoute(row.orders, pointOf, row.loc ? { lat: row.loc.lat, lng: row.loc.lng } : null)
      const person = staff.find((s) => s.uid === uid)
      return {
        uid,
        name: row.name,
        loc: row.loc,
        state: row.loc ? freshness(row.loc.at, now) : ('lost' as Freshness),
        stops: plan.stops.map((s) => s.item),
        onShift: person?.onShift,
      }
    }).sort((a, b) => {
      const rank = { fresh: 0, recent: 1, lost: 2 }
      return rank[a.state] - rank[b.state] || b.stops.length - a.stops.length
    })
  }, [locations, active, staff, now])

  const allPoints = useMemo(() => {
    const pts: [number, number][] = []
    for (const c of couriers) if (c.loc) pts.push([c.loc.lat, c.loc.lng])
    for (const o of [...active, ...waiting]) {
      const p = pointOf(o)
      if (p) pts.push([p.lat, p.lng])
    }
    return pts
  }, [couriers, active, waiting])

  const focus = (uid: string) => {
    const c = couriers.find((x) => x.uid === uid)
    if (!c?.loc) return
    // `key` — bir kuryer ikki marta bosilsa ham xarita yana uchib borsin
    const { lat, lng } = c.loc
    setFly((prev) => ({ lat, lng, key: (prev?.key ?? 0) + 1 }))
    setTimeout(() => markers.current.get(uid)?.openPopup(), 850)
  }

  const liveCount = couriers.filter((c) => c.state === 'fresh').length

  return (
    <div className="amap">
      {/* Kuryerlar ro'yxati */}
      <aside className="adm-card amap__side">
        <div className="amap__summary">
          <span><b>{liveCount}</b> jonli</span>
          <span><b>{active.length}</b> yo‘lda</span>
          <span><b>{waiting.length}</b> kutmoqda</span>
        </div>

        {loading ? (
          <p className="p-4 text-sm" style={{ color: 'var(--muted)' }}>Yuklanmoqda…</p>
        ) : couriers.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: 'var(--muted)' }}>
            <MapPinned size={26} style={{ color: 'var(--faint)' }} />
            <p className="mt-2 font-bold" style={{ color: 'var(--ink)' }}>Hali joylashuv yo‘q</p>
            <p className="mt-1">
              Kuryer smenani boshlab, botga «Jonli joylashuv» yuborsa — shu yerda ko‘rinadi.
            </p>
          </div>
        ) : (
          <ul className="amap__list">
            {couriers.map((c) => (
              <li key={c.uid}>
                <button className="amap__item" onClick={() => focus(c.uid)} disabled={!c.loc}>
                  <span className={'amap__dot is-' + c.state} style={{ ['--c' as string]: colorOf(c.uid) }}>
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <b className="block truncate text-sm">{c.name}</b>
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                      {c.loc ? (
                        <>
                          {c.loc.source === 'live' ? <Radio size={12} /> : <Smartphone size={12} />}
                          {c.state === 'lost' ? 'aloqa uzilgan · ' : ''}{ago(c.loc.at, now)}
                        </>
                      ) : 'joylashuv yo‘q'}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {c.stops.length > 0 && <span className="adm-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}><Bike size={12} /> {c.stops.length}</span>}
                    {c.onShift === false && <span className="text-[11px]" style={{ color: 'var(--faint)' }}>dam olmoqda</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="amap__legend">
          <span><i className="is-fresh" /> jonli (2 daq)</span>
          <span><i className="is-recent" /> 10 daqiqagacha</span>
          <span><i className="is-lost" /> aloqa uzilgan</span>
        </div>
      </aside>

      {/* Xarita */}
      <section className="adm-card amap__map">
        <MapContainer center={CENTER} zoom={12} scrollWheelZoom className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <FitAll points={allPoints} trigger={fitTrigger} />
          <FlyTo target={fly} />

          {/* Kuryer → buyurtmalari (yaqinlik tartibida) */}
          {couriers.map((c) => {
            if (!c.loc || !c.stops.length) return null
            const line: [number, number][] = [[c.loc.lat, c.loc.lng]]
            for (const o of c.stops) {
              const p = pointOf(o)
              if (p) line.push([p.lat, p.lng])
            }
            return (
              <Polyline
                key={`line-${c.uid}`}
                positions={line}
                pathOptions={{ color: colorOf(c.uid), weight: 3, dashArray: '6 8', opacity: c.state === 'lost' ? 0.35 : 0.85 }}
              />
            )
          })}

          {/* Yo'ldagi buyurtmalar — kuryer rangida, tartib raqami bilan */}
          {couriers.flatMap((c) => c.stops.map((o, i) => {
            const p = pointOf(o)
            if (!p) return null
            return (
              <Marker key={`o-${o.id}`} position={[p.lat, p.lng]} icon={orderIcon(`${i + 1}`, colorOf(c.uid))}>
                <Popup>
                  <b>{o.orderNumber}</b> · {c.name}<br />
                  {o.customer?.address}<br />
                  {o.arrivedAt ? '📍 Kuryer eshik oldida' : o.etaAt ? `🕒 ~${Math.max(0, Math.ceil((Date.parse(o.etaAt) - now) / 60_000))} daq` : ''}
                </Popup>
              </Marker>
            )
          }))}

          {/* Hali hech kim olmagan buyurtmalar */}
          {waiting.map((o) => {
            const p = pointOf(o)!
            return (
              <Marker key={`w-${o.id}`} position={[p.lat, p.lng]} icon={orderIcon(o.orderNumber.replace('#', ''), null)}>
                <Popup><b>{o.orderNumber}</b> — hali hech kim olmagan<br />{o.customer?.address}</Popup>
              </Marker>
            )
          })}

          {/* Kuryerlar */}
          {couriers.map((c) => c.loc && (
            <Marker
              key={`c-${c.uid}`}
              position={[c.loc.lat, c.loc.lng]}
              icon={courierIcon(c.name, colorOf(c.uid), c.state, c.loc.heading)}
              zIndexOffset={1000}
              ref={(m) => {
                if (m) markers.current.set(c.uid, m)
                else markers.current.delete(c.uid)
              }}
            >
              <Popup>
                <b>{c.name}</b><br />
                {c.loc.source === 'live' ? '📡 Telegram jonli joylashuvi' : '📱 Ilova'} · {ago(c.loc.at, now)}<br />
                {c.stops.length ? `🛵 Yo‘lda: ${c.stops.map((o) => o.orderNumber).join(', ')}` : 'Yo‘lda buyurtma yo‘q'}
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {allPoints.length > 0 && (
          <button
            className="amap__fit"
            onClick={() => setFitTrigger((n) => n + 1)}
            title="Hammasini ko‘rsatish"
            aria-label="Hammasini ko‘rsatish"
          >
            <LocateFixed size={18} />
          </button>
        )}
      </section>
    </div>
  )
}
