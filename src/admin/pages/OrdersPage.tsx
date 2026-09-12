import {
  Bike, ChevronDown, Loader2, MapPin, Phone, Printer, Search, ShoppingBag, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatPrice } from '../../data'
import type { OrderStatus } from '../../types/domain'
import { apiPost } from '../lib/api'
import { useOrders, useStaff, type AdminOrder, type StaffRow } from '../lib/live'
import { StatusBadge } from '../components/StatusBadge'
import { can, type Staff } from '../lib/auth'
import { useToast } from '../components/Toast'
import { Receipt } from '../components/Receipt'

const ALL_STATUSES: OrderStatus[] = [
  'Yangi',
  'Qabul qilindi',
  'Yetkazilmoqda',
  'Yetkazildi',
  'Bekor qilingan',
  'Rad etildi',
]

/** Kuryer faqat shu ikkitasini qo'ya oladi — server ham buni tekshiradi. */
const COURIER_STATUSES: OrderStatus[] = ['Yetkazilmoqda', 'Yetkazildi']

type Filter = 'all' | OrderStatus

export function OrdersPage({ staff, focusId }: { staff: Staff; focusId?: string | null }) {
  const courierId = staff.role === 'courier' ? staff.uid : undefined
  const { orders, loading, error } = useOrders(courierId)

  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  /**
   * Ochiq buyurtma HOLATDA emas, identifikator bo'yicha hisoblanadi.
   *
   * Shunda oyna doim onSnapshot'dan kelgan yangi ma'lumotni ko'rsatadi:
   * holat o'zgarsa yoki kuryer biriktirilsa, oynadagi qiymat ham o'zi
   * yangilanadi — qo'lda sinxronlash kerak emas.
   *
   * Boshlang'ich qiymat — Telegram'dagi «Admin paneldan ochish» tugmasi
   * bergan #/orders/<id> dagi identifikator.
   */
  const [openId, setOpenId] = useState<string | null>(focusId ?? null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { show, node: toast } = useToast()

  const allowed = staff.role === 'courier' ? COURIER_STATUSES : ALL_STATUSES
  // Kuryerlar ro'yxati faqat egaga ochiq (Firestore Rules) — admin uchun
  // bo'sh keladi va biriktirish tanlovi ko'rinmaydi.
  const { staff: team } = useStaff(staff.role === 'owner')
  const couriers = useMemo(
    () => team.filter((person) => person.role === 'courier' && person.active),
    [team],
  )

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([['all', orders.length]])
    for (const status of ALL_STATUSES) {
      map.set(status, orders.filter((o) => o.status === status).length)
    }
    return map
  }, [orders])

  const open = useMemo(
    () => (openId ? (orders.find((order) => order.id === openId) ?? null) : null),
    [orders, openId],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return orders.filter((order) => {
      if (filter !== 'all' && order.status !== filter) return false
      if (!needle) return true
      return (
        order.orderNumber.toLowerCase().includes(needle) ||
        (order.customer?.name || '').toLowerCase().includes(needle) ||
        (order.customer?.phone || '').toLowerCase().includes(needle)
      )
    })
  }, [orders, filter, query])

  const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
    if (order.status === status || busyId) return
    setBusyId(order.id)
    try {
      const result = await apiPost<{ notified: boolean }>('action', {
        action: 'order.status',
        orderId: order.id,
        status,
      })
      show(
        result.notified
          ? `${order.orderNumber} — «${status}». Mijozga xabar yuborildi.`
          : `${order.orderNumber} — «${status}».`,
      )
    } catch (err) {
      show(err instanceof Error ? err.message : 'O‘zgartirib bo‘lmadi', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const assign = async (order: AdminOrder, courierId: string) => {
    setBusyId(order.id)
    try {
      const result = await apiPost<{ notified: boolean; courierName?: string }>('action', {
        action: 'order.assign',
        orderId: order.id,
        courierId,
      })
      show(
        !courierId
          ? 'Biriktirish bekor qilindi'
          : result.notified
            ? `${result.courierName} ga biriktirildi va xabar yuborildi`
            : `${result.courierName} ga biriktirildi (Telegram ID yo‘q — xabar bormadi)`,
      )
    } catch (err) {
      show(err instanceof Error ? err.message : 'Biriktirib bo‘lmadi', 'error')
    } finally {
      setBusyId(null)
    }
  }

  if (error) {
    return (
      <div className="adm-card adm-empty">
        <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Qidiruv */}
      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--faint)' }}
        />
        <input
          className="adm-input icon-left"
          placeholder="Raqam, ism yoki telefon bo‘yicha qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Holat filtrlari */}
      <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
        {(['all', ...ALL_STATUSES] as Filter[]).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
            style={{
              borderColor: filter === key ? 'var(--brand-line)' : 'var(--line)',
              background: filter === key ? 'var(--brand-soft)' : 'var(--surface)',
              color: filter === key ? 'var(--brand-strong)' : 'var(--muted)',
            }}
          >
            {key === 'all' ? 'Barchasi' : key}
            <span className="ml-1.5 opacity-60">{counts.get(key) ?? 0}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="adm-skeleton h-16" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="adm-card adm-empty mt-4">
          <ShoppingBag size={30} />
          <p className="text-sm font-semibold">Buyurtma topilmadi</p>
        </div>
      ) : (
        <>
          {/* Telefon: kartalar */}
          <div className="mt-4 flex flex-col gap-2.5 lg:hidden">
            {visible.map((order) => (
              <button
                key={order.id}
                className="adm-card p-3.5 text-left transition active:scale-[0.99]"
                onClick={() => setOpenId(order.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold">{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-1.5 truncate text-sm font-semibold">
                  {order.customer?.name || 'Nomsiz'}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : '—'}
                  </span>
                  <span className="font-extrabold">{formatPrice(order.total)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Katta ekran: jadval */}
          <div className="adm-card mt-4 hidden overflow-hidden lg:block">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Raqam</th>
                    <th>Mijoz</th>
                    <th>Telefon</th>
                    <th>Summa</th>
                    <th>To‘lov</th>
                    <th>Holat</th>
                    <th>Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() => setOpenId(order.id)}
                    >
                      <td className="font-extrabold">{order.orderNumber}</td>
                      <td>{order.customer?.name || '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{order.customer?.phone || '—'}</td>
                      <td className="font-bold">{formatPrice(order.total)}</td>
                      <td style={{ color: 'var(--muted)' }}>{order.paymentMethod || '—'}</td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td style={{ color: 'var(--muted)' }}>
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleString('ru-RU')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Buyurtma tafsiloti */}
      {open && (
        <OrderDrawer
          order={open}
          allowed={allowed}
          busy={busyId === open.id}
          canAssign={can(staff.role, 'admin')}
          couriers={couriers}
          onStatus={(status) => changeStatus(open, status)}
          onAssign={(courierId) => assign(open, courierId)}
          onClose={() => setOpenId(null)}
        />
      )}

      {toast}
    </>
  )
}

function OrderDrawer({
  order, allowed, busy, canAssign, couriers, onStatus, onAssign, onClose,
}: {
  order: AdminOrder
  allowed: OrderStatus[]
  busy: boolean
  canAssign: boolean
  couriers: StaffRow[]
  onStatus: (status: OrderStatus) => void
  onAssign: (courierId: string) => void
  onClose: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  // Ochiq turganda orqa sahifa aylanmasin
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /*
   * document.body ga PORTAL — bu majburiy.
   * .adm-content da transform'li animatsiya bor (fill: both), shuning
   * uchun u fixed elementlar uchun containing block bo'lib qoladi.
   * Portalsiz drawer viewport o'rniga o'sha blokka yopishib, ekranning
   * bir qismi bo'sh oq bo'lib qolardi.
   */
  return createPortal(
    <div className="adm-drawer" role="dialog" aria-modal="true">
      <div className="adm-drawer__backdrop" onClick={onClose} />

      <div className="adm-drawer__panel">
        <div className="adm-drawer__head">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{order.orderNumber}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : '—'}
            </p>
          </div>
          <button
            className="grid size-9 shrink-0 place-items-center rounded-xl transition active:scale-90"
            style={{ background: 'var(--surface-2)' }}
            onClick={() => window.print()}
            aria-label="Chekni chop etish"
            title="Chekni chop etish"
          >
            <Printer size={17} />
          </button>
          <button
            className="grid size-9 shrink-0 place-items-center rounded-xl transition active:scale-90"
            style={{ background: 'var(--surface-2)' }}
            onClick={onClose}
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* Holat */}
          <section>
            <p className="adm-label">Holat</p>
            <div className="relative">
              <button
                className="adm-btn adm-btn--ghost w-full justify-between"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={busy}
              >
                <span className="flex items-center gap-2">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  <StatusBadge status={order.status} />
                </span>
                <ChevronDown size={16} />
              </button>

              {pickerOpen && (
                <div
                  className="adm-card absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden p-1"
                  style={{ boxShadow: 'var(--shadow-lg)' }}
                >
                  {allowed.map((status) => (
                    <button
                      key={status}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition hover:bg-[var(--surface-2)]"
                      onClick={() => {
                        setPickerOpen(false)
                        onStatus(status)
                      }}
                    >
                      <StatusBadge status={status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
              Holat o‘zgarsa mijozga Telegram xabari va ilova ichida bildirishnoma boradi.
            </p>
          </section>

          {/* Mijoz */}
          <section className="adm-card p-3.5">
            <p className="text-sm font-extrabold">{order.customer?.name || 'Nomsiz'}</p>
            {order.customer?.phone && (
              <a
                className="mt-2 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--brand)' }}
                href={`tel:${order.customer.phone.replace(/\s/g, '')}`}
              >
                <Phone size={15} /> {order.customer.phone}
              </a>
            )}
            {order.customer?.address && (
              <p className="mt-2 flex items-start gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                <MapPin size={15} className="mt-0.5 shrink-0" /> {order.customer.address}
              </p>
            )}
            {order.customer?.location && (
              <a
                className="mt-2 inline-block text-sm font-bold"
                style={{ color: 'var(--royal)' }}
                href={`https://maps.google.com/?q=${order.customer.location.lat},${order.customer.location.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Xaritada ochish →
              </a>
            )}
            {order.customer?.comment && (
              <p className="mt-2 text-sm italic" style={{ color: 'var(--muted)' }}>
                “{order.customer.comment}”
              </p>
            )}
          </section>

          {/* Mahsulotlar */}
          <section>
            <p className="adm-label">Mahsulotlar</p>
            <div className="adm-card divide-y" style={{ borderColor: 'var(--line-soft)' }}>
              {(order.products || []).map((line, i) => (
                <div key={line.cartKey || i} className="flex items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {line.product?.name || 'Nomsiz'}
                    </span>
                    {(line.size || line.color) && (
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {[line.size, line.color].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm" style={{ color: 'var(--muted)' }}>
                    ×{line.quantity}
                  </span>
                  <span className="shrink-0 text-sm font-bold">
                    {formatPrice((line.product?.price || 0) * (line.quantity || 0))}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Hisob */}
          <section className="adm-card p-3.5 text-sm">
            <Row label="Mahsulotlar" value={formatPrice(order.subtotal ?? order.total)} />
            {!!order.discount && (
              <Row label={`Chegirma${order.promoCode ? ` (${order.promoCode})` : ''}`} value={`− ${formatPrice(order.discount)}`} tone="var(--brand)" />
            )}
            {!!order.deliveryFee && (
              <Row label="Yetkazish" value={formatPrice(order.deliveryFee)} />
            )}
            <div
              className="mt-2 flex items-center justify-between border-t pt-2 text-base font-extrabold"
              style={{ borderColor: 'var(--line)' }}
            >
              <span>Jami</span>
              <span>{formatPrice(order.total)}</span>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
              To‘lov: {order.paymentMethod || '—'}
              {order.paymentStatus ? ` • ${order.paymentStatus}` : ''}
            </p>
          </section>

          <button
            className="adm-btn adm-btn--ghost w-full"
            onClick={() => window.print()}
          >
            <Printer size={16} /> Chekni chop etish
          </button>

          {canAssign && (
            <section>
              <p className="adm-label">
                <span className="inline-flex items-center gap-1.5">
                  <Bike size={14} /> Kuryer
                </span>
              </p>
              {couriers.length === 0 ? (
                <p
                  className="rounded-xl p-3 text-xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                >
                  Faol kuryer yo‘q. «Xodimlar» bo‘limidan qo‘shing — Telegram ID
                  bilan qo‘shilsa, buyurtma unga avtomatik yuboriladi.
                </p>
              ) : (
                <>
                  <select
                    className="adm-input"
                    value={order.courierId || ''}
                    onChange={(e) => onAssign(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Biriktirilmagan</option>
                    {couriers.map((courier) => (
                      <option key={courier.uid} value={courier.uid}>
                        {courier.name}
                        {courier.telegramId ? '' : ' (Telegram ID yo‘q)'}
                      </option>
                    ))}
                  </select>
                  {order.courierName && (
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                      Hozir: <b>{order.courierName}</b>
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        {/* Chop etish uchun — ekranda ko'rinmaydi */}
        <Receipt order={order} />
      </div>
    </div>,
    document.body,
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-bold" style={{ color: tone }}>
        {value}
      </span>
    </div>
  )
}
