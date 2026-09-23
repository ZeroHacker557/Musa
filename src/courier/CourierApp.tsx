import { Banknote, ClipboardList, CreditCard, Loader2, PackageCheck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatPrice } from '../data'
import { useI18n } from '../i18n'
import { usePresence } from '../hooks/use-presence'
import { Toast } from '../components/ui/Toast'
import { showAlert } from '../utils/telegram'
import { CourierOrdersPage, type CourierTab } from './CourierOrdersPage'
import { CourierProfilePage } from './CourierProfilePage'
import type { CourierOrder } from './api'
import { createOrderActions, useCourierData, useCourierLocation } from './use-courier'

type Props = {
  /** Bot xabaridagi «Ilovada ochish» — shu buyurtma ajratib ko'rsatiladi. */
  focusId: string | null
  photo?: string
  onOpenShop: () => void
  /** Server «kuryer emassiz» desa — ilova do'konga qaytadi. */
  onNotCourier: () => void
}

/**
 * Kuryer rejimi — mini app ichidagi alohida qobiq.
 *
 * Admin panelda kuryer qilib qo'shilgan odam ilovani ochganda shu
 * chiqadi. Ikkita bo'lim: buyurtmalar (olish, marshrut, yetkazish) va
 * profil (statistika, tarix, do'konga o'tish).
 */
export function CourierApp({ focusId, photo, onOpenShop, onNotCourier }: Props) {
  const { t } = useI18n()
  const [page, setPage] = useState<'orders' | 'profile'>('orders')
  const [tab, setTab] = useState<CourierTab>('new')
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<CourierOrder | null>(null)

  const { data, error, refreshing, busyId, setBusyId, load } = useCourierData(onNotCourier)
  const { location, retry } = useCourierLocation()
  const actions = createOrderActions(t, () => load(), setBusyId)

  /*
   * Havola bilan ochilgan buyurtma qaysi bo'limda bo'lsa, o'sha ochiladi.
   * Faqat bir marta — keyin kuryer bo'limlarni o'zi almashtiradi.
   */
  const [focusApplied, setFocusApplied] = useState(false)
  if (!focusApplied && focusId && data) {
    setFocusApplied(true)
    if (data.active.some((o) => o.id === focusId)) setTab('active')
    else if (data.done.some((o) => o.id === focusId)) setTab('done')
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const report = (result: { kind: 'success' | 'error'; text: string }) => {
    if (result.kind === 'success') setToast(result.text)
    else showAlert(result.text)
  }

  const take = async (order: CourierOrder) => {
    const result = await actions.take(order.id)
    report(result)
    // Olingan buyurtma «Yo'lda» ga o'tadi — kuryer darhol marshrutni ko'rsin
    if (result.kind === 'success') setTab('active')
  }

  // Oyna javob kelguncha ochiq turadi — tugmada aylanuvchi belgi ko'rinadi
  const deliver = async (order: CourierOrder) => {
    const result = await actions.deliver(order.id)
    setConfirm(null)
    report(result)
  }

  return (
    <>
      <Toast message={toast} onClose={() => setToast(null)} />

      <div className="page-wrapper crr-wrapper">
        <div className="page-animate" key={page}>
          {page === 'orders' ? (
            <CourierOrdersPage
              data={data}
              error={error}
              refreshing={refreshing}
              busyId={busyId}
              location={location}
              tab={tab}
              focusId={focusId}
              onTab={setTab}
              onRefresh={() => {
                void load(true)
                retry()
              }}
              onRetryLocation={retry}
              onTake={take}
              onDeliver={setConfirm}
            />
          ) : (
            <CourierProfilePage data={data} photo={photo} onOpenShop={onOpenShop} />
          )}
        </div>
      </div>

      <nav className="bottom-nav">
        {([
          { id: 'orders', label: t('courier.navOrders'), icon: ClipboardList, badge: data?.available.length ?? 0 },
          { id: 'profile', label: t('courier.navProfile'), icon: UserRound, badge: 0 },
        ] as const).map(({ id, label, icon: Icon, badge }) => {
          const active = page === id
          return (
            <button
              key={id}
              className={'nav-item ' + (active ? 'active' : '')}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                setPage(id)
                window.scrollTo(0, 0)
              }}
            >
              <span className="relative">
                <Icon size={23} />
                {badge > 0 && (
                  <span
                    className="nav-badge--pop absolute -right-2 -top-1 grid size-4 place-items-center rounded-full text-[9px] font-bold"
                    style={{ background: 'var(--danger)', color: '#fff' }}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="text-center">{label}</span>
            </button>
          )
        })}
      </nav>

      <DeliverSheet
        order={confirm}
        busy={confirm !== null && busyId === confirm.id}
        onCancel={() => {
          if (busyId === null) setConfirm(null)
        }}
        onConfirm={deliver}
      />
    </>
  )
}

/**
 * «Yetkazdim» tasdig'i. Tasodifiy bosilib ketmasin va naqd bo'lsa
 * kuryer summani yana bir bor ko'rib, pulni olganiga ishonch hosil qilsin.
 */
function DeliverSheet({
  order, busy, onCancel, onConfirm,
}: {
  order: CourierOrder | null
  busy: boolean
  onCancel: () => void
  onConfirm: (order: CourierOrder) => void
}) {
  const { t } = useI18n()
  const { mounted, leaving } = usePresence(order !== null, 220)
  const [shown, setShown] = useState(order)
  if (order && order !== shown) setShown(order)
  if (!mounted || !shown) return null

  const cash = shown.paymentMethod !== 'Karta'

  return (
    <div className={'crr-sheet-overlay ' + (leaving ? 'leaving' : '')} onClick={onCancel}>
      <div className={'crr-sheet ' + (leaving ? 'leaving' : '')} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span className="crr-sheet__grip" />
        <span className="crr-sheet__icon"><PackageCheck size={28} /></span>
        <h3 className="mt-3 text-center text-xl font-extrabold" style={{ color: 'var(--ink)' }}>
          {t('courier.confirmTitle', { number: shown.number })}
        </h3>
        <p className="mt-1 text-center text-sm" style={{ color: 'var(--muted)' }}>{shown.customer.address}</p>

        <div className={'crr-pay mt-4 ' + (cash ? 'crr-pay--cash' : 'crr-pay--card')}>
          {cash ? <Banknote size={20} /> : <CreditCard size={20} />}
          <span className="min-w-0 flex-1 text-sm font-bold">
            {cash ? t('courier.confirmCash') : t('courier.confirmCard')}
          </span>
          {cash && <b className="text-lg">{formatPrice(shown.total)}</b>}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_1.6fr] gap-2">
          <button className="crr-btn crr-btn--ghost crr-btn--block" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="crr-btn crr-btn--primary crr-btn--block" onClick={() => onConfirm(shown)} disabled={busy}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={18} />}
            {t('courier.confirmYes')}
          </button>
        </div>
      </div>
    </div>
  )
}
