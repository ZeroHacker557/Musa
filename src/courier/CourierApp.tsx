import { Banknote, ClipboardList, CreditCard, PackageCheck, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatPrice } from '../data'
import { useI18n } from '../i18n'
import { usePresence } from '../hooks/use-presence'
import { Toast } from '../components/ui/Toast'
import { setupBackButton, showAlert, toggleBackButton } from '../utils/telegram'
import { CourierOrdersPage, type CourierTab } from './CourierOrdersPage'
import { CourierProfilePage } from './CourierProfilePage'
import { HoldButton } from './HoldButton'
import { OrderDetail } from './OrderDetail'
import { SupportScreen } from './SupportScreen'
import { useMyThreads } from './support'
import type { CourierOrder } from './api'
import { createOrderActions, useCourierData, useCourierLocation } from './use-courier'

type Props = {
  /** Bot xabaridagi «Ilovada ochish» — shu buyurtma ajratib ko'rsatiladi. */
  focusId: string | null
  /** Bot xabaridagi «Chatni ochish» — shu murojaat ochiladi. */
  supportId: string | null
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
export function CourierApp({ focusId, supportId, photo, onOpenShop, onNotCourier }: Props) {
  const { t } = useI18n()
  const [page, setPage] = useState<'orders' | 'profile'>('orders')
  const [tab, setTab] = useState<CourierTab>('new')
  const [toast, setToast] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<CourierOrder | null>(null)
  // Tafsilotlar — id bo'yicha: ro'yxat yangilanganda oyna ham yangi holatni ko'rsatadi
  const [detailId, setDetailId] = useState<string | null>(null)
  // Qo'llab-quvvatlash: `key` har ochilishda o'zgaradi — oyna ro'yxatdan boshlanadi
  const [support, setSupport] = useState<{
    open: boolean
    threadId: string | null
    /** Tafsilotdan ochilgan — murojaat faqat shu buyurtma bo'yicha. */
    order: CourierOrder | null
    key: number
  }>({ open: supportId !== null, threadId: supportId, order: null, key: 0 })

  const { data, error, refreshing, busyId, setBusyId, load } = useCourierData(onNotCourier)
  const { location, retry } = useCourierLocation()
  const { threads, ready: threadsReady } = useMyThreads(data?.profile.telegramId ?? null)
  const supportUnread = threads.reduce((sum, thread) => sum + thread.unreadCourier, 0)

  // Murojaat uchun tanlanadigan buyurtmalar — takrorlanmasdan
  const supportOrders = (() => {
    const seen = new Set<string>()
    return [...(data?.active ?? []), ...(data?.available ?? []), ...(data?.done ?? []), ...(data?.recent ?? [])]
      .filter((order) => !seen.has(order.id) && seen.add(order.id))
  })()
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

  const detail = detailId
    ? [...(data?.available ?? []), ...(data?.active ?? []), ...(data?.done ?? []), ...(data?.recent ?? [])]
        .find((o) => o.id === detailId) ?? null
    : null

  // Tafsilot ochiq bo'lsa Telegram'ning «orqaga» tugmasi uni yopadi.
  // Ustida qo'llab-quvvatlash oynasi turganda — u o'zi boshqaradi,
  // aks holda bitta bosishda ikkala oyna ham yopilib ketardi.
  const detailOpen = detail !== null && !support.open
  useEffect(() => {
    if (!detailOpen) return
    toggleBackButton(true)
    const off = setupBackButton(() => setDetailId(null))
    return () => {
      off()
      toggleBackButton(false)
    }
  }, [detailOpen])

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
    // Yetkazildi — tafsilot ham yopiladi, kuryer ro'yxatga qaytadi
    if (result.kind === 'success') setDetailId(null)
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
              onOpen={(order) => setDetailId(order.id)}
            />
          ) : (
            <CourierProfilePage
              data={data}
              photo={photo}
              onOpenShop={onOpenShop}
              onOpenOrder={(order) => setDetailId(order.id)}
              supportUnread={supportUnread}
              onOpenSupport={() => setSupport((s) => ({ open: true, threadId: null, order: null, key: s.key + 1 }))}
            />
          )}
        </div>
      </div>

      <nav className="bottom-nav">
        {([
          { id: 'orders', label: t('courier.navOrders'), icon: ClipboardList, badge: data?.available.length ?? 0 },
          { id: 'profile', label: t('courier.navProfile'), icon: UserRound, badge: supportUnread },
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

      <SupportScreen
        key={support.key}
        open={support.open}
        initialThreadId={support.threadId}
        lockedOrder={support.order}
        threads={threads}
        threadsReady={threadsReady}
        orders={supportOrders}
        onClose={() => setSupport((s) => ({ ...s, open: false }))}
      />

      <OrderDetail
        order={detail}
        busy={detail !== null && busyId === detail.id}
        onClose={() => setDetailId(null)}
        onTake={take}
        onDeliver={setConfirm}
        onSupport={(order) => {
          // Shu buyurtma bo'yicha ochiq murojaat bo'lsa — to'g'ri o'sha chat,
          // bo'lmasa yozish oynasi (buyurtma oldindan tanlangan)
          const existing = threads.find((thread) => thread.orderId === order.id && thread.status === 'open')
          setSupport((s) => ({ open: true, threadId: existing?.id ?? null, order, key: s.key + 1 }))
        }}
      />

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

        {/* Tasodifiy bosilmasin — 3 soniya bosib turiladi, tugma o'ngga to'lib boradi */}
        <div className="mt-5">
          <HoldButton
            label={t('courier.confirmYes')}
            holdingLabel={(n) => t('courier.holdKeep', { n })}
            busy={busy}
            onComplete={() => onConfirm(shown)}
          />
          <p className="mt-2 text-center text-xs font-bold" style={{ color: 'var(--faint)' }}>
            {t('courier.holdHint')}
          </p>
          <button className="crr-btn crr-btn--ghost crr-btn--block mt-3" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
