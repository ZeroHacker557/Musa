import { useMemo, useRef, useState } from 'react'
import { Grid2X2, Package } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ProductCard } from '../components/product/ProductCard'
import { ProductGridSkeleton } from '../components/ui/ProductCardSkeleton'
import { TextSkeleton } from '../components/ui/LoadingSkeletons'
import { categoryIcon } from '../utils/category-icons'
import { shortCategoryName } from '../config/categories'
import { useAutoScroll } from '../hooks/use-auto-scroll'
import { useT } from '../i18n'
import type { Category, Product, ProductActions, Section } from '../types/domain'
import { groupBySection, sortForAll } from '../utils/catalog-groups'

/** Bir sahifada nechta mahsulot ko'rsatiladi (4-band). */

type Props = ProductActions & {
  products: Product[]
  categories: Category[]
  /** Kategoriya ichidagi bo'limlar — sarlavha bilan ajratiladi. */
  sections: Section[]
  loading: boolean
  /** Bosh sahifadan kelgan kategoriya filtri. */
  initialCategory?: string | null
  onSearch: () => void
  /** Tepadagi yurak — savat pastdagi menyuga ko'chgan. */
  onFavorites: () => void
  onBack: () => void
}

export function CatalogPage({
  products, categories, sections, loading, initialCategory,
  onSearch, onFavorites, onBack, ...actions
}: Props) {
  const t = useT()
  const ALL = t('common.all')

  const [active, setActive] = useState(initialCategory || ALL)

  // Kategoriya lentasi o'zi sekin surilib turadi
  const stripRef = useRef<HTMLDivElement>(null)

  const displayCategories = useMemo(
    () => [{ id: -1, name: ALL, icon: 'all' }, ...categories],
    [categories, ALL],
  )

  useAutoScroll(stripRef, { speed: 16, enabled: displayCategories.length > 3 })

  /*
   * Tartib admin panelda belgilanadi: kategoriya → bo'lim → mahsulot.
   *
   * «Ko'proq ko'rsatish» tugmasi olib tashlandi — mijoz pastga aylantirib
   * hamma mahsulotni ko'radi. Kartochkalar kichik nusxa (thumb) va
   * `loading="lazy"` bilan yuklangani uchun uzun ro'yxat ham tez.
   */
  const shown = useMemo(
    () =>
      active === ALL
        ? sortForAll(products, categories, sections)
        : products.filter((p) => p.category === active),
    [products, categories, sections, active, ALL],
  )

  // Tanlangan kategoriyada bo'limlar sarlavha bilan ajratiladi
  const groups = useMemo(
    () => (active === ALL ? null : groupBySection(shown, sections, active)),
    [shown, sections, active, ALL],
  )
  const hasSections = Boolean(groups?.some((group) => group.section))

  return (
    <>
      <PageHeader
        title={t('catalog.title')}
        onBack={onBack}
        onSearch={onSearch}
        onFavorites={onFavorites}
      />

      {/* Kategoriyalar */}
      <section ref={stripRef} className="category-pills scrollbar-none mt-4">
        {displayCategories.map((category) => {
          const Icon = category.name === ALL ? Grid2X2 : categoryIcon(category.icon, category.name)
          const selected = active === category.name
          return (
            <button
              onClick={() => setActive(category.name)}
              key={category.id}
              aria-pressed={selected}
              className={'category-pill ' + (selected ? 'active' : '')}
            >
              <Icon size={22} />
              <span className="category-pill__label">{shortCategoryName(category.name)}</span>
            </button>
          )
        })}
      </section>

      {/* Mahsulotlar */}
      <section className="px-5 pb-32 pt-2 sm:px-10">
        {/* Mahsulotlar kelguncha «Jami 0 ta» emas, skelet */}
        {loading ? (
          <TextSkeleton className="h-5 w-40" />
        ) : (
          <p style={{ color: 'var(--muted)' }}>{t('catalog.total', { count: shown.length })}</p>
        )}

        {loading ? (
          <ProductGridSkeleton />
        ) : shown.length > 0 ? (
          hasSections && groups ? (
            groups.map((group) => (
              <div key={group.section?.id ?? 'rest'} className="catalog-group">
                <h2 className="catalog-group__title">
                  <span className="catalog-group__name">
                    {group.section ? group.section.name : t('catalog.otherProducts')}
                  </span>
                  <span className="catalog-group__count">{group.products.length}</span>
                  <span className="catalog-group__line" aria-hidden="true" />
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {group.products.map((product) => (
                    <ProductCard key={product.id} product={product} {...actions} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((product) => (
                <ProductCard key={product.id} product={product} {...actions} />
              ))}
            </div>
          )
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
