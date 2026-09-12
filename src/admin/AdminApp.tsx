import { Loader2, ShieldAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiGet } from './lib/api'
import { logout, watchUser, type Staff } from './lib/auth'
import { useRoute } from './lib/router'
import { useOrders } from './lib/live'
import { Shell } from './components/Shell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductsPage } from './pages/ProductsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { PromocodesPage } from './pages/PromocodesPage'
import { CustomersPage } from './pages/CustomersPage'
import { BroadcastPage } from './pages/BroadcastPage'
import { StaffPage } from './pages/StaffPage'
import { SettingsPage } from './pages/SettingsPage'
import { can } from './lib/auth'
import { applyTheme, getStoredTheme } from '../utils/theme'

type State =
  | { phase: 'loading' }
  | { phase: 'anonymous' }
  | { phase: 'denied'; reason: string }
  | { phase: 'ready'; staff: Staff }

export function AdminApp() {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const { route, param, navigate } = useRoute()

  // Tema mini app bilan bir xil kalitdan o'qiladi
  useEffect(() => applyTheme(getStoredTheme()), [])

  useEffect(() => {
    return watchUser(async (user) => {
      if (!user) {
        setState({ phase: 'anonymous' })
        return
      }
      setState({ phase: 'loading' })
      try {
        // Rolga mijoz tomonida ishonilmaydi — serverdan so'raladi
        const { staff } = await apiGet<{ staff: Staff }>('session')
        setState({ phase: 'ready', staff })
      } catch (error) {
        setState({
          phase: 'denied',
          reason: error instanceof Error ? error.message : 'Ruxsat yo‘q',
        })
      }
    })
  }, [])

  if (state.phase === 'loading') {
    return (
      <div className="adm-login">
        <Loader2 size={30} className="animate-spin" style={{ color: 'var(--brand)' }} />
      </div>
    )
  }

  if (state.phase === 'anonymous') return <LoginPage />

  if (state.phase === 'denied') {
    return (
      <div className="adm-login">
        <div className="adm-login__card text-center">
          <span
            className="mx-auto grid size-14 place-items-center rounded-2xl"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            <ShieldAlert size={26} />
          </span>
          <h1 className="mt-4 text-lg font-extrabold">Ruxsat berilmadi</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            {state.reason}
          </p>
          <button className="adm-btn adm-btn--ghost mt-5 w-full" onClick={() => logout()}>
            Boshqa hisob bilan kirish
          </button>
        </div>
      </div>
    )
  }

  return <AdminPanel staff={state.staff} route={route} param={param} navigate={navigate} />
}

function AdminPanel({
  staff, route, param, navigate,
}: {
  staff: Staff
  route: ReturnType<typeof useRoute>['route']
  param: ReturnType<typeof useRoute>['param']
  navigate: ReturnType<typeof useRoute>['navigate']
}) {
  const courierId = staff.role === 'courier' ? staff.uid : undefined
  const { orders } = useOrders(courierId)
  const newOrders = useMemo(() => orders.filter((o) => o.status === 'Yangi').length, [orders])

  return (
    <Shell staff={staff} route={route} onNavigate={navigate} newOrders={newOrders}>
      {route === 'dashboard' && <DashboardPage courierId={courierId} />}
      {route === 'orders' && <OrdersPage staff={staff} focusId={param} />}

      {/* Katalog — kuryerga yopiq */}
      {route === 'products' && (can(staff.role, 'admin') ? <ProductsPage /> : <NoAccess />)}
      {route === 'categories' && (can(staff.role, 'admin') ? <CategoriesPage /> : <NoAccess />)}
      {route === 'promocodes' && (can(staff.role, 'admin') ? <PromocodesPage /> : <NoAccess />)}

      {route === 'customers' && (can(staff.role, 'admin') ? <CustomersPage /> : <NoAccess />)}
      {route === 'broadcast' && (can(staff.role, 'admin') ? <BroadcastPage /> : <NoAccess />)}

      {/* Faqat ega */}
      {route === 'staff' && (staff.role === 'owner' ? <StaffPage me={staff} /> : <NoAccess />)}
      {route === 'settings' && (staff.role === 'owner' ? <SettingsPage /> : <NoAccess />)}
    </Shell>
  )
}

/**
 * Rol yetmaganda ko'rsatiladi.
 *
 * Yon menyuda bu bo'limlar allaqachon yashirilgan — bu ekran manzilni
 * qo'lda yozib kirgan holat uchun. Haqiqiy himoya baribir serverda
 * va Firestore Rules'da.
 */
function NoAccess() {
  return (
    <div className="adm-card adm-empty">
      <p className="text-base font-extrabold" style={{ color: 'var(--ink)' }}>
        Bu bo‘limga ruxsatingiz yo‘q
      </p>
      <p className="max-w-sm text-sm">Kerak bo‘lsa ega sizga huquq bera oladi.</p>
    </div>
  )
}
