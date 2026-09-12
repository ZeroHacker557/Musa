import { useMemo, useRef, useState } from 'react'
import { Grid2X2, Package } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ProductCard } from '../components/product/ProductCard'
import { ProductGridSkeleton } from '../components/ui/ProductCardSkeleton'
import { categoryIcon } from '../utils/category-icons'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { useT } from '../i18n'
import type { Category, Product, ProductActions } from '../types/domain'

/** Bir sahifada nechta mahsulot ko'rsatiladi (4-band). */
const PAGE_SIZE = 12

type Props = ProductActions & {
  products: Product[]
  categories: Category[]
  loading: boolean
  cartCount: number
  /** Bosh sahifadan kelgan kategoriya filtri. */
  initialCategory?: string | null
  onSearch: () => void
  onOpenCart: () => void
  onBack: () => void
}

export function CatalogPage({
  products, categories, loading, cartCount, initialCategory,
  onSearch, onOpenCart, onBack, ...actions
}: Props) {
  const t = useT()
  const ALL = t('common.all')

  const [active, setActive] = useState(initialCategory || ALL)
  const [visible, setVisible] = useState(PAGE_SIZE)

  // Kategoriya lentasi o'zi sekin surilib turadi
  const stripRef = useRef<HTMLDivElement>(null)

  const displayCategories = useMemo(
    () => [{ id: -1, name: ALL, icon: 'all' }, ...categories],
    [categories, ALL],
  )

  useAutoScroll(stripRef, { speed: 16, enabled: displayCategories.length > 3 })

  /*
   * Tartib admin panelda belgilanadi (`order` maydoni).
   * Narx bo'yicha saralash tugmalari olib tashlandi: mijoz uchun
   * ortiqcha tanlov edi, mahsulotlar tartibini esa do'kon o'zi
   * boshqargani ma'qul.
   */
  const shown = useMemo(() => {
    const filtered = products.filter((p) => active === ALL || p.category === active)
    return [...filtered].sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    )
  }, [products, active, ALL])

  // Kategoriya o'zgarsa ro'yxatni boshidan ko'rsatamiz
  const [lastKey, setLastKey] = useState(active)
  if (active !== lastKey) {
    setLastKey(active)
    setVisible(PAGE_SIZE)
  }

  const page = shown.slice(0, visible)
  const hasMore = shown.length > visible

  return (
    <>
      <PageHeader
        title={t('catalog.title')}
        onBack={onBack}
        onSearch={onSearch}
        onCart={onOpenCart}
        cartCount={cartCount}
      />

      {/* Kategoriyalar */}
      <section ref={stripRef} className="category-strip category-strip--compact scrollbar-none mt-5">
        {displayCategories.map((category) => {
          const Icon = category.name === ALL ? Grid2X2 : categoryIcon(category.icon, category.name)
          return (
            <button
              onClick={() => setActive(category.name)}
              key={category.id}
              className={'catalog-category ' + (active === category.name ? 'active' : '')}
            >
              <Icon size={21} />
              <span className="category-label">{category.name}</span>
            </button>
          )
        })}
      </section>

      {/* Mahsulotlar */}
      <section className="px-5 pb-32 pt-6 sm:px-10">
        <p style={{ color: 'var(--muted)' }}>{t('catalog.total', { count: shown.length })}</p>

        {loading ? (
          <ProductGridSkeleton />
        ) : page.length > 0 ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {page.map((product) => (
                <ProductCard key={product.id} product={product} {...actions} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-xs font-bold" style={{ color: 'var(--faint)' }}>
                  {t('catalog.showing', { shown: page.length, total: shown.length })}
                </p>
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="btn-ghost px-8 py-3"
                >
                  {t('catalog.loadMore')}
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            className="mt-8 rounded-2xl border border-dashed p-12 text-center"
            style={{ borderColor: 'var(--line)' }}
          >
            <span
              className="mx-auto grid size-16 place-items-center rounded-full"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
            >
              <Package size={30} />
            </span>
            <p className="mt-4 font-bold" style={{ color: 'var(--ink-2)' }}>
              {products.length === 0 ? t('home.emptyTitle') : t('catalog.emptyCategory')}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              {products.length === 0 ? t('home.emptyText') : t('catalog.emptyCategoryText')}
            </p>
            {products.length > 0 && active !== ALL && (
              <button
                onClick={() => setActive(ALL)}
                className="btn-ghost mx-auto mt-5 px-5 py-2.5 text-sm"
              >
                {t('common.all')}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  )
}
