import { Heart, Minus, Plus, ShoppingCart, Star } from 'lucide-react'
import { flyToCart } from '../../utils/fly-to-cart'
import { heartBurst } from '../../utils/burst'
import { markHero } from '../../utils/view-transition'
import { useState } from 'react'
import { formatPrice } from '../../data'
import { productThumb } from '../../utils/product-image'
import { ProductImage } from './ProductImage'
import { useT } from '../../i18n'
import type { Product, ProductActions } from '../../types/domain'

type Props = ProductActions & { product: Product; compact?: boolean }

export function ProductCard({ product, onOpen, onAddToCart, cartQtyOf, onChangeQty, likedIds, onToggleLike, compact = false }: Props) {
  const t = useT()
  const favourite = likedIds.includes(product.id)
  // Kartochkada kichik nusxa: ekranda ~170px, katta faylga hojat yo'q
  const imgSrc = productThumb(product)
  const [imgError, setImgError] = useState(false)
  const soldOut = product.stock === 0
  const qty = cartQtyOf(product)
  const weight = product.sizes?.[0]
  // Set: nechta mahsulot va alohida olinganda qancha bo'lardi
  const setCount = product.bundleItems?.reduce((sum, line) => sum + line.quantity, 0) ?? 0
  const setValue = product.bundleValue && product.bundleValue > product.price ? product.bundleValue : null
  // Set kartochkasi toza turadi: yurakcha va chegirma foizi faqat set sahifasining ichida
  const isSet = setCount > 0 || Boolean(product.bundle?.length)

  return (
    // data-fly-source — savatga uchadigan rasm shu kartadan olinadi;
    // data-product-id — orqaga qaytishda rasm shu kartaga qaytib kiradi
    <article className={'product-card group ' + (compact ? 'compact' : '')} data-fly-source data-product-id={product.id}>
      {!isSet && (
        <button
          className={'product-card-like ' + (favourite ? 'liked' : '')}
          onClick={(e) => {
            e.stopPropagation()
            // Qo'shilayotganda — yurakchalar sochiladi (olib tashlashda emas)
            if (!favourite) heartBurst(e.currentTarget)
            onToggleLike(product.id)
          }}
          aria-label={t('favorites.title')}
          aria-pressed={favourite}
        >
          <Heart size={18} fill={favourite ? 'currentColor' : 'none'} />
        </button>
      )}

      {soldOut ? (
        <span className="product-card-badge muted">{t('product.soldOut')}</span>
      ) : product.discount && !isSet ? (
        <span className="product-card-badge">{product.discount}</span>
      ) : null}

      <button
        className="product-card-body"
        onClick={(e) => {
          // Rasm shu yerdan mahsulot sahifasiga kattalashib o'tadi
          markHero(e.currentTarget.querySelector('.product-card-image'))
          onOpen(product)
        }}
      >
        <div className={'product-card-image ' + (soldOut ? 'sold-out' : '')}>
          {imgSrc && !imgError ? (
            <ProductImage src={imgSrc} alt={product.name} onError={() => setImgError(true)} />
          ) : (
            <div className="product-card-placeholder">
              <ShoppingCart size={36} />
            </div>
          )}
        </div>

        <div className="product-card-info">
          <h3 className="product-card-name">{product.name}</h3>
          {/* Vazni bo'lmasa ham joy qoladi — qatordagi kartochkalar bir tekis turadi */}
          <p className="product-card-weight">
            {/* Setda vazn o'rniga — ichida nechta mahsulot borligi */}
            {setCount > 0 ? t('product.setItems', { n: setCount }) : weight}
          </p>
          {!compact && (
            <p className="product-card-rating">
              <Star size={14} fill="var(--warning)" style={{ color: 'var(--warning)' }} />
              {product.rating.toFixed(1)} ({product.reviews})
            </p>
          )}
        </div>
      </button>

      <div className="product-card-footer">
        <div className="product-card-price-block">
          <p className="product-card-price">{formatPrice(product.price)}</p>
          {product.oldPrice && !compact ? (
            <p className="product-card-old-price">{formatPrice(product.oldPrice)}</p>
          ) : setValue && !compact ? (
            // Set — tarkibni alohida olsa qancha bo'lardi
            <p className="product-card-old-price">{formatPrice(setValue)}</p>
          ) : null}
        </div>
        {/* Savatga qo'shilgan bo'lsa — shu yerning o'zida «− soni +».
            Mijoz savatni ochmay turib sonini o'zgartira oladi. */}
        {qty > 0 ? (
          <div className="qty-stepper" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChangeQty(product, -1) }}
              aria-label={t('cart.decrease')}
            >
              <Minus size={16} />
            </button>
            {/* key: son o'zgarganda element qayta chiziladi va animatsiya takrorlanadi */}
            <span key={qty} aria-live="polite">{qty}</span>
            <button
              type="button"
              disabled={soldOut}
              onClick={(e) => { e.stopPropagation(); flyToCart(e.currentTarget); onChangeQty(product, 1) }}
              aria-label={t('cart.increase')}
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <button
            className="add-button"
            disabled={soldOut}
            onClick={(e) => { e.stopPropagation(); flyToCart(e.currentTarget); onAddToCart(product) }}
            aria-label={soldOut ? t('product.soldOut') : t('product.addToCart')}
          >
            <ShoppingCart size={18} />
          </button>
        )}
      </div>
    </article>
  )
}
