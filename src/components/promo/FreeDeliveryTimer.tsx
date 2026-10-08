import { ArrowRight, Clock, Snowflake, Truck } from 'lucide-react'
import { useI18n } from '../../i18n'
import { usePresence } from '../../hooks/use-presence'
import { formatCountdown, useDeliveryTimer } from '../../hooks/use-delivery-timer'
import { hapticSelection } from '../../utils/telegram'

/** 3 daqiqadan kam qolsa — shoshiltiruvchi rang. */
const URGENT_MS = 3 * 60_000

/**
 * «Yetkazib berish BEPUL» — taymer boshlangan zahoti chiqadigan oyna:
 * aylana sanoq, yo'l bo'ylab yuradigan mashina va «Xaridni boshlash».
 */
export function FreeDeliverySheet({ open, hasCart, onShop, onClose }: {
  open: boolean
  hasCart: boolean
  onShop: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const timer = useDeliveryTimer()
  const visible = open && timer.active
  const { mounted, leaving } = usePresence(visible, 260)
  if (!mounted) return null

  const minutes = Math.round(timer.totalMs / 60_000)
  const R = 52
  const C = 2 * Math.PI * R

  return (
    <div className={'fdt-overlay ' + (leaving ? 'leaving' : '')} onClick={onClose}>
      <div
        className={'fdt-sheet ' + (leaving ? 'leaving' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={`${t('timer.title')} ${t('timer.free')}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fdt-hero">
          <span className="fdt-grip" />
          {/* Ixcham: chapda sarlavha, o'ngda sanoq — oyna ekranning yarmicha */}
          <div className="fdt-hero__row">
            <div className="fdt-hero__text">
              <span className="fdt-badge">{t('timer.badge')}</span>
              <h2 className="fdt-title">
                {t('timer.title')}
                <span className="fdt-title__free">{t('timer.free')}</span>
              </h2>
            </div>

            <div className="fdt-ring" role="timer" aria-live="off">
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="fdt-ring__track" cx="60" cy="60" r={R} />
                <circle
                  className="fdt-ring__value"
                  cx="60"
                  cy="60"
                  r={R}
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - timer.progress)}
                />
              </svg>
              <span className="fdt-ring__center">
                <b>{formatCountdown(timer.remainingMs)}</b>
                <small>{t('timer.left')}</small>
              </span>
            </div>
          </div>

          {/* Yo'l va mashina */}
          <div className="fdt-road" aria-hidden="true">
            <span className="fdt-road__truck"><Truck size={22} strokeWidth={2.2} /></span>
          </div>
        </div>

        <div className="fdt-body">
          <p className="fdt-subtitle">{t('timer.subtitle', { minutes })}</p>
          <div className="fdt-perks">
            <span><Truck size={15} /> {t('timer.perkFree')}</span>
            <span><Snowflake size={15} /> {t('timer.perkCold')}</span>
          </div>
          <button
            className="btn-primary fdt-cta"
            onClick={() => {
              hapticSelection()
              onShop()
            }}
          >
            {hasCart ? t('timer.ctaCart') : t('timer.cta')} <ArrowRight size={18} />
          </button>
          <button className="fdt-later" onClick={onClose}>{t('timer.later')}</button>
        </div>
      </div>
    </div>
  )
}

/** Bosh sahifadagi ixcham banner — sanoq tugaguncha turadi. */
export function FreeDeliveryBanner({ onShop }: { onShop: () => void }) {
  const { t } = useI18n()
  const timer = useDeliveryTimer()
  const { mounted, leaving } = usePresence(timer.active, 300)
  if (!mounted) return null
  const urgent = timer.remainingMs < URGENT_MS

  return (
    <section className="px-5 pt-4 sm:px-10">
      <button
        className={'fdt-banner' + (urgent ? ' is-urgent' : '') + (leaving ? ' leaving' : '')}
        onClick={onShop}
        aria-label={`${t('timer.bannerTitle')} — ${formatCountdown(timer.remainingMs)}`}
      >
        <span className="fdt-banner__icon"><Truck size={22} strokeWidth={2.2} /></span>
        <span className="fdt-banner__text">
          <b>{t('timer.bannerTitle')}</b>
          <span>{t('timer.bannerText')}</span>
        </span>
        <span className="fdt-banner__time">
          <Clock size={14} strokeWidth={2.6} />
          {formatCountdown(timer.remainingMs)}
        </span>
        <span className="fdt-banner__bar" style={{ ['--p' as string]: `${timer.progress * 100}%` }} />
      </button>
    </section>
  )
}

/** Savat va buyurtma sahifasida: «Yetkazish bepul — 12:30». */
export function FreeDeliveryChip({ line = false }: { line?: boolean }) {
  const { t } = useI18n()
  const timer = useDeliveryTimer()
  if (!timer.active) return null
  const time = formatCountdown(timer.remainingMs)
  const urgent = timer.remainingMs < URGENT_MS

  if (line) {
    return (
      <div className={'fdt-cartline' + (urgent ? ' is-urgent' : '')}>
        <span><Truck size={16} /> {t('timer.cartLine')}</span>
        <b><Clock size={13} strokeWidth={2.6} /> {time}</b>
      </div>
    )
  }
  return (
    <span className={'fdt-chip' + (urgent ? ' is-urgent' : '')}>
      <Clock size={12} strokeWidth={2.6} /> {time}
    </span>
  )
}
