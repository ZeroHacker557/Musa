import { BRAND } from '../../config/brand'

/**
 * Logodagi sariq plita — ko'k MUSA yozuvi bilan.
 *
 * Alohida eksport qilinadi: hero kabi yirik joylarda yashil plitkasiz,
 * yolg'iz o'zi bezak sifatida ishlatiladi.
 */
export function BrandPlate({ width, className = '' }: { width: number; className?: string }) {
  return (
    <span
      className={'grid place-items-center ' + className}
      style={{
        width,
        height: width * 0.51,
        borderRadius: width * 0.15,
        background: 'linear-gradient(180deg, #fbe9a6 0%, #f2c94c 55%, #e0ad2c 100%)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.7)',
      }}
    >
      <b
        className="wordmark leading-none"
        style={{ fontSize: width * 0.31, letterSpacing: '0.02em', color: '#16359e' }}
      >
        {BRAND.name}
      </b>
    </span>
  )
}

type Props = {
  /** Belgi o'lchami (px). Yozuv shunga nisbatan masshtablanadi. */
  size?: number
  /** Yozuvsiz — faqat belgi (kichik joylar uchun). */
  markOnly?: boolean
  className?: string
}

/**
 * MUSA logotipi.
 *
 * Belgi logotipning o'zi kabi tuzilgan: yashil plitka ustida sariq
 * plita, uning ichida ko'k MUSA yozuvi. Rasm fayli emas, CSS bilan
 * chizilgan — shuning uchun istalgan o'lchamda aniq ko'rinadi va
 * qorong'i temada ham fon bilan qo'shilib ketmaydi (plitka ikkala
 * temada bir xil, favicon bilan mos tushadi).
 *
 * Haqiqiy logotip fayli kelganda: rasmni `src/images/musa-mark.png`
 * ga qo'ying va shu yerdagi <BrandPlate> o'rniga <img> qo'ying —
 * boshqa hech qayerda o'zgartirish kerak emas.
 */
export function BrandLogo({ size = 44, markOnly = false, className = '' }: Props) {
  return (
    <span className={'flex items-center gap-2.5 ' + className}>
      <span
        className="grid shrink-0 place-items-center"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: 'var(--brand)',
          boxShadow: 'var(--shadow-brand)',
        }}
        aria-label={BRAND.name}
        role="img"
      >
        <BrandPlate width={size * 0.74} />
      </span>

      {!markOnly && (
        <span className="min-w-0 leading-none">
          <b
            className="wordmark block"
            style={{ fontSize: size * 0.6, color: 'var(--ink)' }}
          >
            {BRAND.name}
          </b>
          <small
            className="mt-1 block truncate font-bold uppercase"
            style={{
              fontSize: Math.max(7, size * 0.17),
              letterSpacing: '0.1em',
              color: 'var(--brand)',
            }}
          >
            {BRAND.tagline}
          </small>
        </span>
      )}
    </span>
  )
}
