import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { fetchSplashAd } from '../../lib/firebase'
import type { Product } from '../../types/domain'
import { markAdSeen, shouldShowAd, type AdLink, type SplashAd as Ad } from '../../utils/splash-ad'
import { getTelegram, hapticFeedback, hapticSelection } from '../../utils/telegram'
import { SplashAdView } from './SplashAdView'

type Props = {
  products: Product[]
  onOpenCategory: (category: string) => void
  onOpenProduct: (product: Product) => void
  /** Reklama ko'rinib turganda boshqa takliflar (manzil) chiqmasin. */
  onVisibleChange?: (visible: boolean) => void
}

/** Ochilish animatsiyasidan keyin birinchi rasm shuncha vaqtda yuklanmasa, reklama bu safar chiqmaydi. */
const FIRST_IMAGE_WAIT_MS = 3000

/** index.html dagi ochilish animatsiyasi tugashini kutadi. */
function splashDone(): Promise<void> {
  if (!document.documentElement.hasAttribute('data-splash')) return Promise.resolve()
  return new Promise((resolve) => window.addEventListener('musa:splash-done', () => resolve(), { once: true }))
}

/** Birinchi slayd rasmi bo'lsa — oldindan yuklab olamiz, qora ekran chaqnamasin. */
function preloadFirst(ad: Ad): Promise<boolean> {
  const first = ad.slides[0]
  if (first.type !== 'image') return Promise.resolve(true)
  return new Promise((resolve) => {
    const image = new Image()
    const timer = window.setTimeout(() => resolve(false), FIRST_IMAGE_WAIT_MS)
    image.onload = () => { window.clearTimeout(timer); resolve(true) }
    image.onerror = () => { window.clearTimeout(timer); resolve(false) }
    image.src = first.url
  })
}

/**
 * Ilova ochilganda chiqadigan reklama (admin panel → «Reklama banneri»).
 *
 * Tartib: reklama ochilish animatsiyasi bilan PARALLEL yuklanadi,
 * animatsiya tugagach chiqadi. Qanchalik tez-tez chiqishini admin
 * belgilaydi (har safar / kuniga bir / bir marta) — hisob shu
 * qurilmada saqlanadi.
 *
 * Reklama do'konni hech qachon to'sib qolmaydi: o'qib bo'lmasa,
 * rasm yuklanmasa yoki o'chirilgan bo'lsa — shunchaki chiqmaydi.
 */
export function SplashAd({ products, onOpenCategory, onOpenProduct, onVisibleChange }: Props) {
  const t = useT()
  const [ad, setAd] = useState<Ad | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [loaded] = await Promise.all([fetchSplashAd(), splashDone()])
      if (cancelled || !loaded || !shouldShowAd(loaded)) return
      if (!(await preloadFirst(loaded)) || cancelled) return
      markAdSeen(loaded)
      setAd(loaded)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => onVisibleChange?.(ad !== null), [ad, onVisibleChange])

  if (!ad) return null

  const act = (link: AdLink) => {
    hapticFeedback('medium')
    if (link.kind === 'category') return onOpenCategory(link.category)
    if (link.kind === 'product') {
      const product = products.find((p) => String(p.id) === link.productId)
      if (product) onOpenProduct(product)
      return
    }
    const tg = getTelegram()
    const isTelegramLink = /^https?:\/\/t\.me\//i.test(link.url)
    if (isTelegramLink && tg?.openTelegramLink) tg.openTelegramLink(link.url)
    else if (tg?.openLink) tg.openLink(link.url)
    else window.open(link.url, '_blank', 'noopener')
  }

  return (
    <SplashAdView
      ad={ad}
      labels={{
        skip: t('ad.skip'), close: t('ad.close'), mute: t('ad.mute'), unmute: t('ad.unmute'),
      }}
      onClose={() => setAd(null)}
      onAction={act}
      onTap={hapticSelection}
    />
  )
}
