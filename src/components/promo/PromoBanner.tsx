import { ChevronRight } from 'lucide-react'
import { useT } from '../../i18n'
import type { Promotion } from '../../utils/promotions'
import { useTimeLeft } from '../../hooks/use-time-left'

/**
 * Bosh sahifadagi aksiya banneri — eng katta chegirmali ishlayotgan aksiya.
 * Bosilganda aksiya tegishli kategoriya (yoki katalog) ochiladi.
 */
export function PromoBanner({ promotion, onOpen }: { promotion: Promotion; onOpen: () => void }) {
  const t = useT()
  const time = useTimeLeft(promotion.endsAt)
  return (
    <button className="promo-banner" onClick={onOpen}>
      <span className="promo-banner__pct">-{promotion.percent}%</span>
      <span className="min-w-0 flex-1">
        <span className="promo-banner__title">{promotion.title}</span>
        <span className="promo-banner__time">⏳ {t('promo.endsIn', { time })}</span>
      </span>
      <ChevronRight size={20} />
    </button>
  )
}
