import { ArrowRight, Loader2, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { AD_LIMITS, type AdLink, type SplashAd } from '../../utils/splash-ad'

export type SplashAdLabels = {
  skip: string
  close: string
  mute: string
  unmute: string
}

type Props = {
  ad: SplashAd
  labels: SplashAdLabels
  /** Admin paneldagi telefon ko'rinishi: `fixed` emas, ota blok ichida. */
  preview?: boolean
  /**
   * Qaysi slayddan boshlansin — faqat birinchi chizishda o'qiladi.
   * Admin boshqa slaydni tanlasa, ko'rinish `key` bilan qayta yaratiladi.
   */
  startIndex?: number
  onClose: () => void
  onAction: (link: AdLink) => void
  onTap?: () => void
}

/** Bosib turish shu vaqtdan oshsa — pauza, aks holda oddiy bosish. */
const HOLD_MS = 200
/** Shundan ko'p siljisa — bosish emas, surish. */
const MOVE_PX = 12
/** Shundan ko'p gorizontal surilsa — slayd almashadi. */
const SWIPE_PX = 45
/** Slayd shu vaqtda yuklanmasa, o'tkazib yuboriladi. */
const STALL_MS = 8000
const EXIT_MS = 220

/**
 * Butun ekranli reklama slayderi — «stories» uslubida.
 *
 *   • tepada har slayd uchun chiziq, to'lib boradi;
 *   • ekranning o'ng yarmini bosish yoki chapga surish — keyingi slayd,
 *     chap yarmini bosish yoki o'ngga surish — oldingisi (alohida strelka
 *     tugmalari ATAYLAB yo'q — ekranni bosishning o'zi yetarli);
 *   • bosib turish — pauza (qo'yib yuborilsa davom etadi);
 *   • pastda havola tugmasi (slaydda bo'lsa) va «O'tkazib yuborish».
 *
 * Rasm belgilangan soniya turadi, video o'z uzunligicha (eng ko'pi
 * 30 soniya) va ovozsiz boshlanadi — brauzerlar ovozli avto-ijroni
 * bloklaydi. Yuklanmagan slayd jim o'tkazib yuboriladi: reklama
 * hech qachon mijozni do'kondan to'sib qolmasligi kerak.
 */
export function SplashAdView({ ad, labels, preview = false, startIndex = 0, onClose, onAction, onTap }: Props) {
  const slides = ad.slides
  const [index, setIndex] = useState(() => Math.min(startIndex, Math.max(0, slides.length - 1)))
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [fit, setFit] = useState<'cover' | 'contain'>('cover')
  const [leaving, setLeaving] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const elapsed = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const held = useRef(false)
  /** Barmoq qayerdan bosildi — surish va bosishni ajratish uchun. */
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const slide = slides[index]
  const isLast = index >= slides.length - 1

  const close = useCallback(() => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(onClose, preview ? 0 : EXIT_MS)
  }, [leaving, onClose, preview])

  const goTo = useCallback((target: number) => {
    let next = target
    if (next >= slides.length) {
      if (!preview) return close()
      next = 0
    }
    next = Math.max(0, next)
    elapsed.current = 0
    setProgress(0)
    if (next === index) {
      // O'sha slayd (birinchisida chapga bosish yoki bitta slaydli ko'rinish):
      // media qayta yuklanmaydi — faqat vaqt boshidan boshlanadi
      if (videoRef.current) videoRef.current.currentTime = 0
      return
    }
    setReady(false)
    setIndex(next)
  }, [slides.length, preview, close, index])

  /* ── Vaqt: rasm soniyalar bo'yicha, video o'z vaqti bo'yicha ── */
  useEffect(() => {
    if (!slide || !ready || paused || leaving) return
    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const delta = now - last
      last = now
      let value: number
      if (slide.type === 'video') {
        const video = videoRef.current
        const length = Math.min(video?.duration || AD_LIMITS.maxVideoSeconds, AD_LIMITS.maxVideoSeconds)
        value = video && length > 0 ? video.currentTime / length : 0
      } else {
        elapsed.current += delta
        value = elapsed.current / (slide.seconds * 1000)
      }
      if (value >= 1) {
        setProgress(1)
        goTo(index + 1)
        return
      }
      setProgress(value)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [slide, ready, paused, leaving, index, goTo])

  /* ── Video pauza/davom ── */
  useEffect(() => {
    const video = videoRef.current
    if (!video || slide?.type !== 'video') return
    if (paused || !ready || leaving) video.pause()
    else void video.play().catch((error: unknown) => {
      // Faqat avto-ijro RAD ETILSA keyingi slaydga o'tamiz (kam uchraydi —
      // ovozsiz video odatda o'ynaydi). AbortError — shunchaki pauza
      // play() ni to'xtatgani (bosib turish), bu xato emas.
      if ((error as { name?: string } | null)?.name === 'NotAllowedError') goTo(index + 1)
    })
  }, [paused, ready, leaving, slide, index, goTo])

  /* ── Yuklanmay qolgan slayd ── */
  useEffect(() => {
    if (ready || !slide) return
    const timer = window.setTimeout(() => goTo(index + 1), STALL_MS)
    return () => window.clearTimeout(timer)
  }, [ready, slide, index, goTo])

  /* ── Keyingi rasmni oldindan yuklab qo'yamiz — o'tishda kutish bo'lmasin ── */
  useEffect(() => {
    const next = slides[index + 1]
    if (next?.type === 'image') new Image().src = next.url
  }, [slides, index])

  /* ── Ilova fonga o'tsa — pauza; Escape — yopish; klaviatura strelkalari — slaydlar ── */
  useEffect(() => {
    if (preview) return
    const onVisibility = () => setPaused(document.hidden)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') goTo(index + 1)
      else if (e.key === 'ArrowLeft') goTo(index - 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('keydown', onKey)
    }
  }, [preview, close, goTo, index])

  const onMediaSize = (width: number, height: number) => {
    // Tik (telefon) formatidagi media ekranni to'ldiradi, keng formatdagisi
    // kesilmay to'liq ko'rinadi — orqasida xiralashtirilgan nusxasi
    setFit(width > 0 && height > 0 && width / height > 0.8 ? 'contain' : 'cover')
  }

  /** Oldingi/keyingi slayd — bosish va surish shu yerdan o'tadi. */
  const step = (by: -1 | 1) => {
    onTap?.()
    goTo(index + by)
  }

  /* ── O'ng yarmi — keyingi, chap yarmi — oldingi; surish; bosib turish — pauza ── */
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    held.current = false
    pointerStart.current = { x: e.clientX, y: e.clientY }
    holdTimer.current = window.setTimeout(() => {
      held.current = true
      setPaused(true)
    }, HOLD_MS)
  }

  const onPointerMove = (e: PointerEvent) => {
    const from = pointerStart.current
    if (!from || held.current) return
    // Barmoq siljiy boshladi — bu surish, pauza emas
    if (Math.abs(e.clientX - from.x) > MOVE_PX || Math.abs(e.clientY - from.y) > MOVE_PX) {
      if (holdTimer.current) window.clearTimeout(holdTimer.current)
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    const from = pointerStart.current
    pointerStart.current = null
    if (held.current) {
      held.current = false
      setPaused(false)
      return
    }
    if (!from) return

    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    // Chapga surish — keyingi (kitob varag'idek), o'ngga surish — oldingi
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) return step(dx < 0 ? 1 : -1)
    // Sal siljib qolgan, lekin surish ham emas — hech narsa qilmaymiz
    if (Math.abs(dx) > MOVE_PX || Math.abs(dy) > MOVE_PX) return

    const rect = e.currentTarget.getBoundingClientRect()
    step(e.clientX - rect.left < rect.width / 2 ? -1 : 1)
  }

  const onPointerCancel = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    pointerStart.current = null
    held.current = false
    setPaused(false)
  }

  if (!slide) return null

  return (
    <div
      className={'splash-ad' + (preview ? ' splash-ad--preview' : '') + (leaving ? ' leaving' : '')}
      role="dialog"
      aria-modal={!preview}
      // Ostidagi sahifalar orasida surish (use-swipe-nav) ishga tushmasin
      data-no-swipe
    >
      <div
        className="splash-ad__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(e) => { if (e.buttons) onPointerCancel() }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {slide.type === 'image' ? (
          <>
            {fit === 'contain' && (
              <div className="splash-ad__backdrop" style={{ backgroundImage: `url("${slide.url}")` }} />
            )}
            <img
              key={slide.id}
              className={'splash-ad__media is-' + fit + (ready ? ' is-ready' : '')}
              src={slide.url}
              alt=""
              draggable={false}
              onLoad={(e) => {
                onMediaSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                setReady(true)
              }}
              onError={() => goTo(index + 1)}
            />
          </>
        ) : (
          <video
            key={slide.id}
            ref={(el) => {
              videoRef.current = el
              // iOS ovozsiz avto-ijroga `muted` ATRIBUTI bo'lsagina ruxsat beradi,
              // React esa faqat xususiyatni qo'yadi (facebook/react#10389).
              // Atribut faqat boshlang'ich holat — ovoz tugmasiga xalaqit bermaydi.
              if (el) el.defaultMuted = true
            }}
            className={'splash-ad__media is-' + fit + (ready ? ' is-ready' : '')}
            src={slide.url}
            muted={muted}
            // autoPlay ATAYLAB: iOS `preload` ni e'tiborsiz qoldiradi va
            // ijro so'ralmaguncha videoni yuklamaydi — slayd «yuklanmadi»
            // deb o'tib ketardi. Ovozsiz + inline bo'lgani uchun ruxsat bor.
            autoPlay
            playsInline
            preload="auto"
            disablePictureInPicture
            onLoadedMetadata={(e) => onMediaSize(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
            onCanPlay={() => setReady(true)}
            onEnded={() => goTo(index + 1)}
            onError={() => goTo(index + 1)}
          />
        )}

        <div className="splash-ad__shade" aria-hidden="true" />

        {!ready && (
          <div className="splash-ad__loading" aria-hidden="true">
            <Loader2 size={30} className="animate-spin" />
          </div>
        )}
      </div>

      {/* Tepada: har slayd uchun chiziq */}
      <div className="splash-ad__bars" aria-hidden="true">
        {slides.map((s, i) => (
          <span key={s.id} className="splash-ad__bar">
            <i style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} />
          </span>
        ))}
      </div>

      {slide.type === 'video' && (
        <button
          className="splash-ad__round"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? labels.unmute : labels.mute}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      )}

      <div className="splash-ad__bottom">
        {slide.button && (
          <button
            className="splash-ad__cta"
            onClick={() => {
              if (preview) return
              onAction(slide.button!.link)
              close()
            }}
          >
            <span className="truncate">{slide.button.text}</span>
            <ArrowRight size={19} />
          </button>
        )}
        <button className="splash-ad__skip" onClick={close}>
          {isLast ? labels.close : labels.skip}
        </button>
      </div>
    </div>
  )
}
