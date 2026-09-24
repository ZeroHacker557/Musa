import type { LucideIcon } from 'lucide-react'
import { Grid2X2, Home, ShoppingBag, ShoppingCart, UserRound } from 'lucide-react'
import { useT, type TranslationKey } from '../../i18n'
import type { AppPage } from '../../types/domain'

/**
 * Pastdagi menyu.
 *
 * «Savat» ATAYLAB shu yerda, o'rtada: ilgari u faqat tepadagi kichik
 * ikonka edi va foydalanuvchilar savatni topolmasdi. «Sevimlilar» esa
 * o'rnini bo'shatib tepaga (yurak ikonkasi) ko'chdi — u kamroq
 * ishlatiladigan bo'lim.
 *
 * Savat sahifa emas, chekka oyna (CartDrawer), shuning uchun ro'yxatda
 * u alohida `cart` turi bilan turadi.
 */
type NavId = AppPage | 'cart'

const items: { id: NavId; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { id: 'home', labelKey: 'nav.home', icon: Home },
  { id: 'catalog', labelKey: 'nav.catalog', icon: Grid2X2 },
  { id: 'cart', labelKey: 'nav.cart', icon: ShoppingCart },
  { id: 'orders', labelKey: 'nav.orders', icon: ShoppingBag },
  { id: 'profile', labelKey: 'nav.profile', icon: UserRound },
]

type Props = {
  page: AppPage
  onNavigate: (page: AppPage) => void
  onOpenCart: () => void
  cartOpen: boolean
  cartCount: number
  /** Holati o'zgargan, hali ko'rilmagan buyurtmalar soni. */
  ordersBadge?: number
}

export function BottomNav({ page, onNavigate, onOpenCart, cartOpen, cartCount, ordersBadge = 0 }: Props) {
  const t = useT()

  return (
    <nav className="bottom-nav">
      {items.map(({ id, labelKey, icon: Icon }) => {
        const isCart = id === 'cart'
        // Savat ochiq bo'lsa faqat savat yonadi — ostidagi sahifa emas
        const active = isCart ? cartOpen : page === id && !cartOpen
        // Savatda — mahsulotlar soni, buyurtmalarda — yangilangan buyurtmalar
        const badge = isCart ? cartCount : id === 'orders' ? ordersBadge : 0
        return (
          <button
            onClick={() => (isCart ? onOpenCart() : onNavigate(id as AppPage))}
            key={id}
            aria-current={active ? 'page' : undefined}
            className={'nav-item ' + (active ? 'active' : '')}
          >
            {/* data-cart-target — savatga qo'shilgan mahsulot shu belgiga uchadi */}
            <span className="relative" {...(isCart ? { 'data-cart-target': '' } : {})}>
              <Icon size={23} fill={active ? 'currentColor' : 'none'} />
              {/* Son ikonka ustida: savatda — nechta mahsulot, buyurtmalarda —
                  nechta buyurtmaning holati o'zgargan */}
              {badge > 0 && (
                <span
                  className={'absolute -right-2 -top-1 grid size-4 place-items-center rounded-full text-[9px] font-bold' + (isCart ? '' : ' nav-badge--pop')}
                  style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
                >
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </span>
            <span className="text-center">{t(labelKey)}</span>
            {id === 'orders' && badge > 0 && <span className="sr-only">{t('orders.updated', { count: badge })}</span>}
          </button>
        )
      })}
    </nav>
  )
}
