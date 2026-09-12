import { ArrowLeft, Search } from 'lucide-react'
import { CartButton } from '../ui/CartButton'
import { IconButton } from '../ui/IconButton'
import { useT } from '../../i18n'

type Props = {
  title: string
  /**
   * Orqaga qaytish. Berilgan bo'lsa sarlavha chapida tugma chiqadi.
   * Bosh sahifada berilmaydi — u eng yuqori sahifa.
   */
  onBack?: () => void
  onSearch?: () => void
  cartCount: number
  onCart?: () => void
}

export function PageHeader({ title, onBack, onSearch, cartCount, onCart }: Props) {
  const t = useT()

  return (
    <header className="flex items-center gap-2 px-5 pt-8 sm:px-10">
      {onBack && (
        <button
          onClick={onBack}
          className="back-button"
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
      )}

      <h1
        /* Orqaga tugmasi, qidiruv va savat bilan birga uzun sarlavha
           telefonda sig'maydi — shuning uchun kichikroq boshlanadi. */
        className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight sm:text-3xl"
        style={{ color: 'var(--ink)' }}
      >
        {title}
      </h1>

      <div className="flex shrink-0 items-center gap-1">
        {onSearch && (
          <IconButton label={t('search.title')} onClick={onSearch}>
            <Search />
          </IconButton>
        )}
        <CartButton count={cartCount} onClick={onCart} />
      </div>
    </header>
  )
}
