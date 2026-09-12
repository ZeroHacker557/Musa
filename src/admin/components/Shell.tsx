import {
  BarChart3, Boxes, LayoutGrid, LogOut, Megaphone, Menu, Moon, Settings,
  ShoppingBag, Sun, Tag, Users, UserCog, X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { can, logout, type Staff, type StaffRole } from '../lib/auth'
import { ROUTES, type Route } from '../lib/router'
import { applyTheme, getStoredTheme, storeTheme, type ThemeMode } from '../../utils/theme'

type NavEntry = {
  route: Route
  label: string
  icon: typeof BarChart3
  /** Shu roldan past xodimga ko'rinmaydi. */
  min: StaffRole
  section?: string
}

const NAV: NavEntry[] = [
  { route: 'dashboard', label: 'Boshqaruv paneli', icon: BarChart3, min: 'courier' },
  { route: 'orders', label: 'Buyurtmalar', icon: ShoppingBag, min: 'courier' },

  { route: 'products', label: 'Mahsulotlar', icon: Boxes, min: 'admin', section: 'Katalog' },
  { route: 'categories', label: 'Kategoriyalar', icon: LayoutGrid, min: 'admin' },
  { route: 'promocodes', label: 'Promokodlar', icon: Tag, min: 'admin' },

  { route: 'customers', label: 'Mijozlar', icon: Users, min: 'admin', section: 'Odamlar' },
  { route: 'broadcast', label: 'Ommaviy xabar', icon: Megaphone, min: 'admin' },
  { route: 'staff', label: 'Xodimlar', icon: UserCog, min: 'owner' },

  { route: 'settings', label: 'Sozlamalar', icon: Settings, min: 'owner', section: 'Tizim' },
]

const TITLES: Record<Route, string> = {
  dashboard: 'Boshqaruv paneli',
  orders: 'Buyurtmalar',
  products: 'Mahsulotlar',
  categories: 'Kategoriyalar',
  customers: 'Mijozlar',
  broadcast: 'Ommaviy xabar',
  staff: 'Xodimlar',
  promocodes: 'Promokodlar',
  settings: 'Sozlamalar',
}

type Props = {
  staff: Staff
  route: Route
  onNavigate: (route: Route) => void
  /** Yangi buyurtmalar soni — yon menyuda nishon bo'lib chiqadi. */
  newOrders?: number
  children: ReactNode
}

export function Shell({ staff, route, onNavigate, newOrders = 0, children }: Props) {
  const [open, setOpen] = useState(false)
  const [theme, setThemeState] = useState<ThemeMode>(getStoredTheme)

  // Yon panel ochiq turganda orqa fon aylanmasin
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const visible = NAV.filter((entry) => can(staff.role, entry.min))

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    storeTheme(next)
    setThemeState(next)
  }

  return (
    <div className="adm-shell">
      <aside className={'adm-sidebar ' + (open ? 'open' : '')}>
        <div className="flex items-center justify-between">
          <BrandLogo size={36} />
          <button
            className="grid size-9 place-items-center rounded-xl lg:hidden"
            style={{ background: 'var(--surface-2)' }}
            onClick={() => setOpen(false)}
            aria-label="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="adm-nav">
          {visible.map((entry) => {
            const Icon = entry.icon
            return (
              <div key={entry.route}>
                {entry.section && <p className="adm-nav__section">{entry.section}</p>}
                <button
                  className={'adm-nav__item w-full ' + (route === entry.route ? 'active' : '')}
                  onClick={() => {
                    // Telefonda bo'lim tanlangach yon panel yopiladi
                    setOpen(false)
                    onNavigate(entry.route)
                  }}
                  aria-current={route === entry.route ? 'page' : undefined}
                >
                  <Icon size={18} />
                  <span className="truncate">{entry.label}</span>
                  {entry.route === 'orders' && newOrders > 0 && (
                    <span className="adm-nav__badge">{newOrders > 99 ? '99+' : newOrders}</span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        <div className="mt-auto pt-4">
          <div
            className="flex items-center gap-2.5 rounded-xl p-2.5"
            style={{ background: 'var(--surface-2)' }}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold"
              style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
            >
              {(staff.name || staff.email).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{staff.name || staff.email}</p>
              <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                {staff.role === 'owner' ? 'Ega' : staff.role === 'admin' ? 'Admin' : 'Kuryer'}
              </p>
            </div>
            <button
              className="grid size-8 shrink-0 place-items-center rounded-lg transition active:scale-90"
              style={{ color: 'var(--danger)' }}
              onClick={() => logout()}
              aria-label="Chiqish"
              title="Chiqish"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="adm-backdrop lg:hidden" onClick={() => setOpen(false)} />}

      <header className="adm-topbar">
        <button
          className="grid size-10 place-items-center rounded-xl transition active:scale-90 lg:hidden"
          style={{ background: 'var(--surface-2)' }}
          onClick={() => setOpen(true)}
          aria-label="Menyu"
        >
          <Menu size={20} />
        </button>
        <h1 className="adm-topbar__title truncate">{TITLES[route]}</h1>
        <button
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-90"
          style={{ background: 'var(--surface-2)' }}
          onClick={toggleTheme}
          aria-label="Rejimni almashtirish"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="adm-main">
        <div className="adm-content" key={route}>
          {children}
        </div>
      </main>
    </div>
  )
}

export { ROUTES }
