type Props = {
  src: string
  alt: string
  loading?: 'lazy' | 'eager'
  onError?: () => void
}

/**
 * Mahsulot rasmi — HAR QANDAY nisbatda to'liq ko'rinadi.
 *
 * `contain`: rasm hech qayeridan qirqilmaydi (keng muzqaymoq batonchasi
 * ham, chetiga tegib turgan mahsulot ham to'liq chiqadi).
 *
 * Bo'sh qolgan joy TEKIS rang bilan to'ladi — xiralashtirilgan fon emas.
 * Rang `--surface`: yorug' temada oq, qorong'i temada karta rangi.
 * Mahsulot fotolari odatda oq fonda bo'ladi, shuning uchun yorug' temada
 * rasm cheti bilan quti orasida chok ko'rinmaydi.
 */
export function ProductImage({ src, alt, loading = 'lazy', onError }: Props) {
  return (
    <span className="product-image">
      <img
        className="product-image__main"
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onError={onError}
      />
    </span>
  )
}
