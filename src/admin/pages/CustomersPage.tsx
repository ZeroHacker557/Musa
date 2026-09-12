import { Phone, Search, ShoppingBag, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatPrice } from '../../data'
import { useCustomers, useOrders } from '../lib/live'

/** Tushumga kirmaydigan holatlar chiqarib tashlanadi. */
const COUNTED = new Set(['Yangi', 'Qabul qilindi', 'Yetkazilmoqda', 'Yetkazildi'])

export function CustomersPage() {
  const { customers, loading } = useCustomers()
  const { orders } = useOrders()
  const [query, setQuery] = useState('')

  // Har mijoz uchun buyurtmalar soni va sarflagan summasi
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; spent: number; last: string }>()
    for (const order of orders) {
      if (!order.userId) continue
      const key = String(order.userId)
      const entry = map.get(key) || { count: 0, spent: 0, last: '' }
      entry.count++
      if (COUNTED.has(order.status)) entry.spent += Number(order.total) || 0
      if (order.createdAt > entry.last) entry.last = order.createdAt
      map.set(key, entry)
    }
    return map
  }, [orders])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = customers.map((c) => ({
      ...c,
      fullName: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Nomsiz',
      ...(stats.get(c.id) || { count: 0, spent: 0, last: '' }),
    }))
    if (!needle) return rows
    return rows.filter(
      (c) =>
        c.fullName.toLowerCase().includes(needle) ||
        (c.username || '').toLowerCase().includes(needle) ||
        (c.phone || '').includes(needle) ||
        c.id.includes(needle),
    )
  }, [customers, stats, query])

  const totals = useMemo(
    () => ({
      withPhone: customers.filter((c) => c.phone).length,
      buyers: [...stats.values()].filter((s) => s.count > 0).length,
    }),
    [customers, stats],
  )

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card label="Jami mijozlar" value={String(customers.length)} />
        <Card label="Telefon qoldirganlar" value={String(totals.withPhone)} />
        <Card label="Buyurtma berganlar" value={String(totals.buyers)} />
      </div>

      <div className="relative mb-4">
        <Search
          size={17}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--faint)' }}
        />
        <input
          className="adm-input icon-left"
          placeholder="Ism, username, telefon yoki ID bo‘yicha qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="adm-skeleton h-16" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="adm-card adm-empty">
          <Users size={30} />
          <p className="text-sm font-semibold">Mijoz topilmadi</p>
        </div>
      ) : (
        <>
          {/* Telefon */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {visible.map((customer) => (
              <article key={customer.id} className="adm-card p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={customer.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{customer.fullName}</p>
                    {customer.username && (
                      <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                        @{customer.username}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-extrabold">{customer.count}</span>
                    <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                      buyurtma
                    </span>
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {customer.phone ? (
                    <a
                      className="flex items-center gap-1.5 text-xs font-bold"
                      style={{ color: 'var(--brand)' }}
                      href={`tel:${customer.phone.replace(/\s/g, '')}`}
                    >
                      <Phone size={13} /> {customer.phone}
                    </a>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--faint)' }}>
                      telefon yo‘q
                    </span>
                  )}
                  <span className="text-sm font-bold">{formatPrice(customer.spent)}</span>
                </div>
              </article>
            ))}
          </div>

          {/* Katta ekran */}
          <div className="adm-card hidden overflow-hidden lg:block">
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Mijoz</th>
                    <th>Username</th>
                    <th>Telefon</th>
                    <th>Buyurtmalar</th>
                    <th>Sarflagan</th>
                    <th>Oxirgi faollik</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <Avatar name={customer.fullName} small />
                          <span className="font-semibold">{customer.fullName}</span>
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>
                        {customer.username ? `@${customer.username}` : '—'}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{customer.phone || '—'}</td>
                      <td className="font-bold">{customer.count}</td>
                      <td className="font-bold">{formatPrice(customer.spent)}</td>
                      <td style={{ color: 'var(--muted)' }}>
                        {customer.lastActive
                          ? new Date(customer.lastActive).toLocaleDateString('ru-RU')
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
    </>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="adm-card adm-stat">
      <span
        className="adm-stat__icon"
        style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
      >
        <ShoppingBag size={18} />
      </span>
      <p className="adm-stat__label">{label}</p>
      <p className="adm-stat__value">{value}</p>
    </div>
  )
}

function Avatar({ name, small }: { name: string; small?: boolean }) {
  return (
    <span
      className={
        'grid shrink-0 place-items-center rounded-full font-extrabold ' +
        (small ? 'size-8 text-xs' : 'size-10 text-sm')
      }
      style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
