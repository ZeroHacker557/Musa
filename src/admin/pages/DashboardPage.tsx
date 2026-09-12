import {
  Clock, Package, ShoppingBag, TrendingUp, Users, Wallet,
} from 'lucide-react'
import { useMemo } from 'react'
import { formatPrice } from '../../data'
import { useCustomers, useOrders, useProducts, type AdminOrder } from '../lib/live'
import { StatusBadge } from '../components/StatusBadge'
import { MiniBarChart } from '../components/MiniBarChart'

/** Bekor qilingan va rad etilgan buyurtmalar tushumga kirmaydi. */
const REVENUE_STATUSES = new Set(['Yangi', 'Qabul qilindi', 'Yetkazilmoqda', 'Yetkazildi'])

function dayKey(iso: string): string {
  return (iso || '').slice(0, 10)
}

function StatCard({
  label, value, icon: Icon, tone, delay,
}: {
  label: string
  value: string
  icon: typeof ShoppingBag
  tone: { fg: string; bg: string }
  delay: number
}) {
  return (
    <div className="adm-card adm-stat" style={{ animationDelay: `${delay}ms` }}>
      <span className="adm-stat__icon" style={{ background: tone.bg, color: tone.fg }}>
        <Icon size={18} />
      </span>
      <p className="adm-stat__label">{label}</p>
      <p className="adm-stat__value">{value}</p>
    </div>
  )
}

export function DashboardPage({ courierId }: { courierId?: string }) {
  const { orders, loading } = useOrders(courierId)
  const { customers } = useCustomers()
  const { products } = useProducts()

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const paid = orders.filter((o) => REVENUE_STATUSES.has(o.status))

    const revenue = paid.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    const todayOrders = orders.filter((o) => dayKey(o.createdAt) === today)
    const todayRevenue = todayOrders
      .filter((o) => REVENUE_STATUSES.has(o.status))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0)

    // Oxirgi 14 kunlik tushum — grafik uchun
    const days: { label: string; value: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = date.toISOString().slice(0, 10)
      const value = paid
        .filter((o) => dayKey(o.createdAt) === key)
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0)
      days.push({ label: key.slice(8), value })
    }

    // Eng ko'p sotilgan mahsulotlar
    const counter = new Map<string, { name: string; qty: number; sum: number }>()
    for (const order of paid) {
      for (const line of order.products || []) {
        const name = line.product?.name || 'Nomsiz'
        const entry = counter.get(name) || { name, qty: 0, sum: 0 }
        entry.qty += line.quantity || 0
        entry.sum += (line.product?.price || 0) * (line.quantity || 0)
        counter.set(name, entry)
      }
    }
    const top = [...counter.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)

    return {
      revenue,
      todayRevenue,
      todayCount: todayOrders.length,
      total: orders.length,
      pending: orders.filter((o) => o.status === 'Yangi').length,
      inProgress: orders.filter(
        (o) => o.status === 'Qabul qilindi' || o.status === 'Yetkazilmoqda',
      ).length,
      days,
      top,
      average: paid.length ? Math.round(revenue / paid.length) : 0,
    }
  }, [orders])

  const recent: AdminOrder[] = orders.slice(0, 6)

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="adm-skeleton h-24" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Bugungi tushum"
          value={formatPrice(stats.todayRevenue)}
          icon={Wallet}
          tone={{ fg: 'var(--brand)', bg: 'var(--brand-soft)' }}
          delay={0}
        />
        <StatCard
          label="Bugungi buyurtmalar"
          value={String(stats.todayCount)}
          icon={ShoppingBag}
          tone={{ fg: 'var(--royal)', bg: 'var(--royal-soft)' }}
          delay={40}
        />
        <StatCard
          label="Yangi — javob kutmoqda"
          value={String(stats.pending)}
          icon={Clock}
          tone={{ fg: 'var(--warning)', bg: 'var(--warning-soft)' }}
          delay={80}
        />
        <StatCard
          label="Umumiy tushum"
          value={formatPrice(stats.revenue)}
          icon={TrendingUp}
          tone={{ fg: 'var(--brand)', bg: 'var(--brand-soft)' }}
          delay={120}
        />
        <StatCard
          label="Mijozlar"
          value={String(customers.length)}
          icon={Users}
          tone={{ fg: 'var(--info)', bg: 'var(--info-soft)' }}
          delay={160}
        />
        <StatCard
          label="Mahsulotlar"
          value={String(products.length)}
          icon={Package}
          tone={{ fg: 'var(--gold)', bg: 'var(--gold-soft)' }}
          delay={200}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="adm-card p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-extrabold">Oxirgi 14 kun</h2>
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              O‘rtacha chek: {formatPrice(stats.average)}
            </p>
          </div>
          <MiniBarChart data={stats.days} />
        </section>

        <section className="adm-card p-4 sm:p-5">
          <h2 className="text-base font-extrabold">Eng ko‘p sotilganlar</h2>
          {stats.top.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
              Hali sotuv yo‘q.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2.5">
              {stats.top.map((item, i) => (
                <li key={item.name} className="flex items-center gap-3">
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold"
                    style={{
                      background: i === 0 ? 'var(--gold-soft)' : 'var(--surface-2)',
                      color: i === 0 ? 'var(--gold)' : 'var(--muted)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</span>
                  <span className="shrink-0 text-sm font-extrabold">{item.qty} dona</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="adm-card mt-4 overflow-hidden">
        <h2 className="px-4 pt-4 text-base font-extrabold sm:px-5">Oxirgi buyurtmalar</h2>
        {recent.length === 0 ? (
          <div className="adm-empty">
            <ShoppingBag size={30} />
            <p className="text-sm font-semibold">Hozircha buyurtma yo‘q</p>
          </div>
        ) : (
          <div className="adm-table-wrap mt-3">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Raqam</th>
                  <th>Mijoz</th>
                  <th>Summa</th>
                  <th>Holat</th>
                  <th>Sana</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((order) => (
                  <tr key={order.id}>
                    <td className="font-extrabold">{order.orderNumber}</td>
                    <td>{order.customer?.name || '—'}</td>
                    <td className="font-bold">{formatPrice(order.total)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
