import { useEffect, useState } from 'react'
import {
  ArrowLeft, Banknote, Check, Copy, CreditCard, Loader2, MapPin,
  MessageSquare, Phone, Send, ShoppingBag, Tag, User, UserRound,
} from 'lucide-react'
import { formatPrice } from '../data'
import { getImageUrl, hapticFeedback } from '../utils/telegram'
import { getPaymentSettings, getDeliverySettings } from '../lib/firebase'
import { apiPost, ApiError } from '../lib/api'
import { useT } from '../i18n'
import type { AppPage, DeliverySettings, OrderForm, PaymentSettings, Product, UserProfile } from '../types/domain'

type AppliedPromo = {
  code: string
  discountPercent: number
  discount: number
  total: number
}

type Props = {
  profile: UserProfile | null
  cartProducts: { product: Product; quantity: number; size?: string; color?: string; cartKey: string }[]
  cartTotal: number
  orderForm: OrderForm
  onUpdateForm: (field: keyof OrderForm, value: unknown) => void
  onSubmit: () => Promise<boolean>
  isSubmitting: boolean
  onBack: () => void
  onNavigate: (page: AppPage) => void
}

export function CheckoutPage({
  profile, cartProducts, cartTotal, orderForm, onUpdateForm, onSubmit, isSubmitting, onBack, onNavigate,
}: Props) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  /* Qabul qiluvchi boshqa odammi — qo'shimcha maydonlar shunga qarab ochiladi */
  const [otherRecipient, setOtherRecipient] = useState(
    Boolean(orderForm.recipientName || orderForm.recipientPhone),
  )
  const [promoInput, setPromoInput] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null)
  const [promoError, setPromoError] = useState('')
  const [payment, setPayment] = useState<PaymentSettings | null>(null)
  const [delivery, setDelivery] = useState<DeliverySettings | null>(null)

  const addresses = profile?.addresses || []

  useEffect(() => {
    let alive = true
    getPaymentSettings().then((s) => alive && setPayment(s))
    getDeliverySettings().then((s) => alive && setDelivery(s))
    return () => { alive = false }
  }, [])

  // Profil ma'lumotlari bilan avtomatik to'ldirish.
  // Render paytida emas, effekt ichida — aks holda React ogohlantiradi (F-11).
  useEffect(() => {
    if (!profile) return
    if (!orderForm.name && profile.first_name) {
      onUpdateForm('name', `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`)
    }
    if (!orderForm.phone && profile.phone) {
      onUpdateForm('phone', profile.phone)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const discount = appliedPromo?.discount ?? 0
  const discountedSubtotal = Math.max(cartTotal - discount, 0)
  const deliveryFee =
    delivery === null || (delivery.freeFrom > 0 && discountedSubtotal >= delivery.freeFrom)
      ? 0
      : delivery.fee
  const finalTotal = discountedSubtotal + deliveryFee

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    setPromoLoading(true)
    setPromoError('')
    try {
      const result = await apiPost<AppliedPromo>('/api/promo', { code, subtotal: cartTotal })
      setAppliedPromo(result)
      onUpdateForm('promoCode', result.code)
    } catch (error) {
      setAppliedPromo(null)
      onUpdateForm('promoCode', undefined)
      setPromoError(error instanceof ApiError ? error.message : t('reviews.error'))
    } finally {
      setPromoLoading(false)
    }
  }

  const handleClearPromo = () => {
    setAppliedPromo(null)
    setPromoInput('')
    setPromoError('')
    onUpdateForm('promoCode', undefined)
  }

  const isValid = Boolean(orderForm.name.trim() && orderForm.phone.trim() && orderForm.address.trim())
  const canSubmit = isValid && !isSubmitting

  return (
    <>
      <header className="flex items-center gap-3 px-5 pt-8 sm:px-10 page-animate">
        <button onClick={onBack} className="icon-button" aria-label={t('common.back')}>
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>{t('checkout.title')}</h1>
      </header>

      <div className="px-5 pb-32 pt-6 sm:px-10 page-animate">
        {/* Buyurtma tarkibi */}
        <section className="rounded-2xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          <h3 className="flex items-center gap-2 font-bold" style={{ color: 'var(--ink)' }}>
            <ShoppingBag size={18} style={{ color: 'var(--brand)' }} />
            {t('checkout.summary', { count: cartProducts.length })}
          </h3>

          <div className="mt-3 space-y-3">
            {cartProducts.map(({ product, quantity, size, color, cartKey }) => (
              <div key={cartKey} className="flex items-center gap-3">
                <img
                  src={product.images[0] ? getImageUrl(product.images[0]) : ''}
                  alt={product.name}
                  loading="lazy"
                  className="size-14 shrink-0 rounded-xl border object-contain p-1"
                  style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" style={{ color: 'var(--ink)' }}>{product.name}</p>
                  {(size || color) && (
                    <p className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
                      {size}{size && color && ' · '}{color}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    {quantity} × {formatPrice(product.price)}
                  </p>
                </div>
                <b className="text-sm" style={{ color: 'var(--ink)' }}>{formatPrice(product.price * quantity)}</b>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
            {/* Promokod */}
            <div className="mb-3 flex items-start gap-2">
              <div className="flex-1">
                <div
                  className="field h-11 py-0"
                  style={{ borderColor: appliedPromo ? 'var(--success)' : promoError ? 'var(--danger)' : 'var(--line)' }}
                >
                  <Tag size={16} style={{ color: appliedPromo ? 'var(--success)' : 'var(--faint)' }} />
                  <input
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); setAppliedPromo(null) }}
                    placeholder={t('checkout.promoPlaceholder')}
                    className="text-sm font-bold"
                    style={{ color: appliedPromo ? 'var(--success)' : 'var(--ink)' }}
                    readOnly={!!appliedPromo}
                  />
                </div>
                {promoError && (
                  <p className="mt-1 pl-1 text-[11px] font-bold" style={{ color: 'var(--danger)' }}>{promoError}</p>
                )}
                {appliedPromo && (
                  <p className="mt-1 pl-1 text-[11px] font-bold" style={{ color: 'var(--success)' }}>
                    {t('checkout.promoApplied', { percent: appliedPromo.discountPercent })}
                  </p>
                )}
              </div>
              {!appliedPromo ? (
                <button
                  onClick={handleApplyPromo}
                  disabled={!promoInput.trim() || promoLoading}
                  className="btn-primary h-11 w-24 text-sm"
                >
                  {promoLoading ? <Loader2 size={16} className="animate-spin" /> : t('checkout.promoApply')}
                </button>
              ) : (
                <button onClick={handleClearPromo} className="btn-ghost h-11 w-24 text-sm">
                  {t('checkout.promoClear')}
                </button>
              )}
            </div>

            {/* Hisob-kitob */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted)' }}>{t('checkout.products')}</span>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{formatPrice(cartTotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--muted)' }}>
                    {t('checkout.discount')} {appliedPromo ? `(${appliedPromo.discountPercent}%)` : ''}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--success)' }}>-{formatPrice(discount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span style={{ color: 'var(--muted)' }}>{t('checkout.delivery')}</span>
                {delivery === null ? (
                  <span className="skeleton h-4 w-16" />
                ) : deliveryFee === 0 ? (
                  <span className="font-bold" style={{ color: 'var(--success)' }}>{t('checkout.deliveryFree')}</span>
                ) : (
                  <span className="font-bold" style={{ color: 'var(--ink)' }}>{formatPrice(deliveryFee)}</span>
                )}
              </div>

              {delivery !== null && delivery.freeFrom > 0 && deliveryFee > 0 && (
                <p className="pt-1 text-[11px]" style={{ color: 'var(--faint)' }}>
                  {t('checkout.freeFrom', { amount: formatPrice(delivery.freeFrom) })}
                </p>
              )}

              <div className="flex items-center justify-between border-t pt-2.5" style={{ borderColor: 'var(--line)' }}>
                <span className="font-bold" style={{ color: 'var(--ink)' }}>{t('checkout.total')}</span>
                <b className="text-lg" style={{ color: 'var(--brand)' }}>{formatPrice(finalTotal)}</b>
              </div>
            </div>
          </div>
        </section>

        {/* Yetkazib berish ma'lumotlari */}
        <section className="mt-6">
          <h3 className="mb-4 font-bold" style={{ color: 'var(--ink)' }}>{t('checkout.deliveryInfo')}</h3>
          <div className="space-y-5">
            <div>
              <label className="field-label">
                {t('checkout.name')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="field">
                <User size={19} className="shrink-0" style={{ color: 'var(--faint)' }} />
                <input
                  value={orderForm.name}
                  onChange={(e) => onUpdateForm('name', e.target.value)}
                  placeholder={t('checkout.namePlaceholder')}
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                {t('checkout.phone')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="field">
                <Phone size={19} className="shrink-0" style={{ color: 'var(--faint)' }} />
                <input
                  value={orderForm.phone}
                  onChange={(e) => onUpdateForm('phone', e.target.value)}
                  placeholder="+998 90 123 45 67"
                  type="tel"
                  inputMode="tel"
                  className="text-sm"
                />
              </div>
            </div>

            <div>
              <label className="field-label">
                {t('checkout.address')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>

              {addresses.length === 0 ? (
                <div
                  className="rounded-2xl border p-4 text-center"
                  style={{ borderColor: 'var(--line)', background: 'var(--surface-2)' }}
                >
                  <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>{t('checkout.noAddresses')}</p>
                  <button onClick={() => onNavigate('addresses')} className="btn-ghost mx-auto px-4 py-2 text-sm">
                    {t('checkout.addAddress')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses.map((addr) => {
                    const isSelected = orderForm.address === addr.address
                    return (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          onUpdateForm('address', addr.address)
                          onUpdateForm('location', addr.location)
                          hapticFeedback('light')
                        }}
                        /* 2px chegara va yon chiziq — 1px juda nozik edi,
                           mijoz qaysi manzil tanlanganini ilg'amasdi. */
                        className={'address-option ' + (isSelected ? 'selected' : '')}
                      >
                        <div
                          className="grid size-10 shrink-0 place-items-center rounded-full"
                          style={{
                            background: isSelected ? 'var(--surface)' : 'var(--surface-3)',
                            color: isSelected ? 'var(--brand)' : 'var(--muted)',
                          }}
                        >
                          <MapPin size={19} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold" style={{ color: isSelected ? 'var(--brand)' : 'var(--ink)' }}>
                            {addr.name}
                          </p>
                          <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>{addr.address}</p>
                        </div>
                        <span
                          className="grid size-6 shrink-0 place-items-center self-center rounded-full border-2 transition"
                          style={{
                            borderColor: isSelected ? 'var(--brand)' : 'var(--line)',
                            background: isSelected ? 'var(--brand)' : 'transparent',
                            color: 'var(--brand-ink)',
                          }}
                          aria-hidden="true"
                        >
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </span>
                      </button>
                    )
                  })}
                  <button
                    onClick={() => onNavigate('addresses')}
                    className="mt-2 w-full rounded-2xl border border-dashed py-3 text-sm font-bold transition"
                    style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
                  >
                    {t('checkout.addAnotherAddress')}
                  </button>
                </div>
              )}
            </div>

            {/* Buyurtmani boshqa odam oladimi */}
            <div>
              <button
                type="button"
                onClick={() => {
                  // O'chirilganda maydonlar tozalanadi — aks holda
                  // ko'rinmay turgan eski qiymat buyurtmaga tushardi
                  if (otherRecipient) {
                    onUpdateForm('recipientName', '')
                    onUpdateForm('recipientPhone', '')
                  }
                  setOtherRecipient((v) => !v)
                }}
                className="flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition"
                style={{
                  borderColor: otherRecipient ? 'var(--brand)' : 'var(--line)',
                  background: otherRecipient ? 'var(--brand-soft)' : 'var(--surface)',
                }}
              >
                <span
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition"
                  style={{
                    borderColor: otherRecipient ? 'var(--brand)' : 'var(--line)',
                    background: otherRecipient ? 'var(--brand)' : 'transparent',
                    color: 'var(--brand-ink)',
                  }}
                >
                  {otherRecipient && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <b className="block text-sm" style={{ color: 'var(--ink)' }}>
                    {t('checkout.otherRecipient')}
                  </b>
                  <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                    {t('checkout.otherRecipientHint')}
                  </span>
                </span>
              </button>

              {otherRecipient && (
                <div className="mt-3 space-y-3" style={{ animation: 'fadeInUp 0.25s ease' }}>
                  <div className="field">
                    <UserRound size={19} className="shrink-0" style={{ color: 'var(--faint)' }} />
                    <input
                      value={orderForm.recipientName || ''}
                      onChange={(e) => onUpdateForm('recipientName', e.target.value)}
                      placeholder={t('checkout.recipientName')}
                    />
                  </div>
                  <div className="field">
                    <Phone size={19} className="shrink-0" style={{ color: 'var(--faint)' }} />
                    <input
                      type="tel"
                      inputMode="tel"
                      value={orderForm.recipientPhone || ''}
                      onChange={(e) => onUpdateForm('recipientPhone', e.target.value)}
                      placeholder={t('checkout.recipientPhone')}
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="field-label">
                {t('checkout.comment')} <span style={{ color: 'var(--faint)' }}>({t('common.optional')})</span>
              </label>
              <div className="field items-start">
                <MessageSquare size={19} className="mt-0.5 shrink-0" style={{ color: 'var(--faint)' }} />
                <textarea
                  value={orderForm.comment}
                  onChange={(e) => onUpdateForm('comment', e.target.value)}
                  placeholder={t('checkout.commentPlaceholder')}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* To'lov usuli */}
        <section className="mt-6">
          <h3 className="mb-4 font-bold" style={{ color: 'var(--ink)' }}>{t('checkout.paymentMethod')}</h3>

          <div className="flex gap-3">
            {([
              { id: 'Naqd' as const, Icon: Banknote, label: t('checkout.cash'), sub: t('checkout.cashSub') },
              { id: 'Karta' as const, Icon: CreditCard, label: t('checkout.card'), sub: t('checkout.cardSub') },
            ]).map(({ id, Icon, label, sub }) => {
              const selected = orderForm.paymentMethod === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onUpdateForm('paymentMethod', id)}
                  className="flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 py-4 transition"
                  style={{
                    borderColor: selected ? 'var(--brand)' : 'var(--line)',
                    background: selected ? 'var(--brand-soft)' : 'var(--surface)',
                  }}
                >
                  <Icon size={25} style={{ color: selected ? 'var(--brand)' : 'var(--muted)' }} />
                  <span className="text-sm font-bold" style={{ color: selected ? 'var(--brand)' : 'var(--ink)' }}>
                    {label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--faint)' }}>{sub}</span>
                </button>
              )
            })}
          </div>

          {orderForm.paymentMethod === 'Karta' && (
            <div
              className="mt-4 rounded-2xl border-2 p-4"
              style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-soft)', animation: 'fadeInUp 0.25s ease' }}
            >
              <p className="mb-3 text-sm font-bold" style={{ color: 'var(--brand)' }}>{t('checkout.cardDetails')}</p>

              <div
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                style={{ background: 'var(--surface)', borderColor: 'var(--line)' }}
              >
                <div className="min-w-0">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('checkout.cardNumber')}</p>
                  {payment ? (
                    <>
                      <p className="font-mono text-sm font-bold" style={{ color: 'var(--ink)' }}>{payment.cardNumber}</p>
                      <p className="mt-0.5 truncate text-xs font-bold" style={{ color: 'var(--muted)' }}>{payment.cardOwner}</p>
                    </>
                  ) : (
                    <p className="skeleton mt-1 h-4 w-40" />
                  )}
                </div>
                <button
                  type="button"
                  disabled={!payment?.cardNumber}
                  onClick={() => payment && handleCopy(payment.cardNumber)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl transition active:scale-90 disabled:opacity-40"
                  style={{
                    background: copied ? 'var(--success-soft)' : 'var(--surface-3)',
                    color: copied ? 'var(--success)' : 'var(--brand)',
                  }}
                  aria-label={t('checkout.cardNumber')}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>

              <p className="mt-3 rounded-xl p-3 text-xs leading-relaxed" style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}>
                {t('checkout.cardNote')}
              </p>
            </div>
          )}
        </section>

        <button onClick={() => { if (!isSubmitting) onSubmit() }} disabled={!canSubmit} className="btn-primary mt-8 w-full py-4">
          {isSubmitting ? (
            <><Loader2 size={20} className="animate-spin" />{t('checkout.submitting')}</>
          ) : (
            <><Send size={20} />{t('checkout.submit')}</>
          )}
        </button>

        <p className="mt-3 text-center text-xs" style={{ color: 'var(--faint)' }}>{t('checkout.disclaimer')}</p>
      </div>
    </>
  )
}
