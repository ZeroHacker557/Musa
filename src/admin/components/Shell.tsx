import {
  BarChart3, BrainCircuit, Boxes, Clapperboard, ExternalLink, FileBarChart, Flame, Headset, Layers, LayoutGrid, LogOut, Maximize2,
  Megaphone, Menu, Minimize2, Moon, PlugZap, Settings, ShoppingBag, Sun, Tag, Users, UserCog, X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  fullscreenState, isInTelegram, openInBrowser, subscribeFullscreen, toggleFullscreen,
} from '../lib/telegram'
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
  /** Menyu oxirida alohida ajralib turadigan maxsus bo'lim. */
  special?: boolean
}

const NAV: NavEntry[] = [
  { route: 'dashboard', label: 'Boshqaruv paneli', icon: BarChart3, min: 'courier' },
  { route: 'orders', label: 'Buyurtmalar', icon: ShoppingBag, min: 'courier' },
  { route: 'reports', label: 'Hisobotlar', icon: FileBarChart, min: 'admin' },

  { route: 'products', label: 'Mahsulotlar', icon: Boxes, min: 'admin', section: 'Katalog' },
  { route: 'categories', label: 'Kategoriyalar', icon: LayoutGrid, min: 'admin' },
  { route: 'sections', label: 'Bo‘limlar va tartib', icon: Layers, min: 'admin' },
  { route: 'promotions', label: 'Vaqtli aksiyalar', icon: Flame, min: 'admin' },
  { route: 'ads', label: 'Reklama banneri', icon: Clapperboard, min: 'admin' },
  { route: 'promocodes', label: 'Promokodlar', icon: Tag, min: 'admin' },

  { route: 'customers', label: 'Mijozlar', icon: Users, min: 'admin', section: 'Odamlar' },
  { route: 'broadcast', label: 'Ommaviy xabar', icon: Megaphone, min: 'admin' },
  { route: 'support', label: 'Qo‘llab-quvvatlash', icon: Headset, min: 'admin' },
  { route: 'staff', label: 'Xodimlar', icon: UserCog, min: 'owner' },

  { route: 'settings', label: 'Sozlamalar', icon: Settings, min: 'owner', section: 'Tizim' },
  { route: 'linko', label: 'Linko integratsiya', icon: PlugZap, min: 'admin' },

  // Eng pastda — butun tizimning galaktika ko'rinishi
  { route: 'brain', label: 'Miya', icon: BrainCircuit, min: 'admin', special: true },
]

const TITLES: Record<Route, string> = {
  dashboard: 'Boshqaruv paneli',
  orders: 'Buyurtmalar',
  products: 'Mahsulotlar',
  categories: 'Kategoriyalar',
  sections: 'Bo‘limlar va tartib',
  promotions: 'Vaqtli aksiyalar',
  ads: 'Reklama banneri',
  reports: 'Hisobotlar',
  customers: 'Mijozlar',
  broadcast: 'Ommaviy xabar',
  support: 'Qo‘llab-quvvatlash',
  staff: 'Xodimlar',
  promocodes: 'Promokodlar',
  settings: 'Sozlamalar',
  linko: 'Linko integratsiya',
  brain: 'Miya',
}

type Props = {
  staff: Staff
  route: Route
  onNavigate: (route: Route) => void
  /** Yangi buyurtmalar soni — yon menyuda nishon bo'lib chiqadi. */
  newOrders?: number
  /** Kuryerlarning javob kutayotgan xabarlari. */
  supportUnread?: number
  children: ReactNode
}

export function Shell({ staff, route, onNavigate, newOrders = 0, supportUnread = 0, children }: Props) {
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
              <div key={entry.route} className={entry.special ? 'adm-nav__special' : undefined}>
                {entry.section && <p className="adm-nav__section">{entry.section}</p>}
                <button
                  className={
                    'adm-nav__item w-full ' +
                    (entry.special ? 'adm-nav__item--brain ' : '') +
                    (route === entry.route ? 'active' : '')
                  }
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
                  {entry.route === 'support' && supportUnread > 0 && (
                    <span className="adm-nav__badge">{supportUnread > 99 ? '99+' : supportUnread}</span>
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
        <h1 className="adm-topbar__title mr-auto truncate">{TITLES[route]}</h1>

        {/* Telegram ichida: oynani kattalashtirish yoki brauzerda ochish */}
        <TelegramWindowButtons />

        <button
          className="grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-90"
          style={{ background: 'var(--surface-2)' }}
          onClick={toggleTheme}
          aria-label="Rejimni almashtirish"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="adm-main">
        {/* Miya sahifasi butun maydonni egallaydi — chekka bo'shliqlarsiz */}
        <div className={'adm-content ' + (route === 'brain' ? 'adm-content--bleed' : '')} key={route}>
          {children}
        </div>
      </main>
    </div>
  )
}

/**
 * Telegram oynasini boshqarish tugmalari.
 *
 * Kompyuterda Telegram mini appni telefon o'lchamidagi kichik oynada
 * ochadi. «To'liq ekran» uni butun ekranga chiqaradi (Bot API 8.0+).
 * Telegram bu qurilmada qo'llab-quvvatlamasa, tugma o'rniga panelni
 * brauzerda ochish taklif qilinadi — u yerda oyna baribir katta.
 *
 * Brauzerda (Telegramsiz) hech qanday tugma ko'rinmaydi.
 */
function TelegramWindowButtons() {
  const [fs, setFs] = useState(fullscreenState)
  useEffect(() => subscribeFullscreen(setFs), [])

  if (!isInTelegram()) return null

  return (
    <>
      {fs.available && !fs.failed && (
        <button
          className="grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-90"
          style={{ background: 'var(--surface-2)' }}
          onClick={toggleFullscreen}
          aria-label={fs.active ? 'Oynani kichraytirish' : "To'liq ekran"}
          title={fs.active ? 'Oynani kichraytirish' : "To'liq ekran"}
        >
          {fs.active ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      )}

      <button
        className="grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-90"
        style={{ background: 'var(--surface-2)' }}
        onClick={openInBrowser}
        aria-label="Brauzerda ochish"
        title="Brauzerda ochish — katta ekranda ishlash uchun"
      >
        <ExternalLink size={18} />
      </button>
    </>
  )
}

export { ROUTES }
