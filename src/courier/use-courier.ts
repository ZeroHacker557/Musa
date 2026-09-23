import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/api'
import type { TranslationKey } from '../i18n'
import { getTelegram, hapticError, hapticSuccess, requestLocation } from '../utils/telegram'
import { deliverOrder, fetchOverview, takeOrder, type CourierOverview } from './api'
import type { Point } from './route'

/** Ekran ochiq turganda ro'yxat shu oraliqda yangilanadi. */
const POLL_MS = 15_000
/** Joylashuv shu oraliqda qayta o'qiladi — kuryer yurib boradi. */
const LOCATION_MS = 90_000

export type Feedback = { kind: 'success' | 'error'; text: string }

/**
 * Kuryer sahifasining ma'lumoti: ro'yxat, olish va yetkazish.
 *
 * Jonli obuna o'rniga so'rov bilan yangilanadi: kuryer ilovaga Telegram
 * ID si bilan kiradi, Firestore qoidalari esa buyurtmalarni faqat
 * xodim roliga ochadi. Shuning uchun hammasi server (api/courier.ts)
 * orqali, ekran ko'rinib turganda har 15 soniyada va ilovaga
 * qaytilganda.
 */
export function useCourierData(onNotCourier: () => void) {
  const [data, setData] = useState<CourierOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const notCourier = useRef(onNotCourier)
  useEffect(() => {
    notCourier.current = onNotCourier
  })

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const next = await fetchOverview()
      setData(next)
      setError(null)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_COURIER') {
        notCourier.current()
        return
      }
      setError(e instanceof Error ? e.message : 'Xato')
    } finally {
      if (manual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    // Birinchi yuklash — effekt ichida sinxron setState chaqirilmasin
    const first = setTimeout(() => void load(), 0)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    // Telegram oynasi yig'ilib, qayta ochilganda
    const tg = getTelegram()
    tg?.onEvent?.('activated', onVisible)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      tg?.offEvent?.('activated', onVisible)
    }
  }, [load])

  return { data, error, refreshing, busyId, setBusyId, load }
}

export type OrderActions = {
  take: (id: string) => Promise<Feedback>
  deliver: (id: string) => Promise<Feedback>
}

/** Olish va yetkazish — natija matni chaqiruvchiga qaytadi (tarjima bilan). */
export function createOrderActions(
  t: (key: TranslationKey, values?: Record<string, string | number>) => string,
  reload: () => Promise<void>,
  setBusyId: (id: string | null) => void,
): OrderActions {
  const run = async (
    id: string,
    call: () => Promise<{ outcome: string; courierName?: string | null }>,
    good: string[],
  ): Promise<Feedback> => {
    setBusyId(id)
    try {
      const result = await call()
      const key: Record<string, TranslationKey> = {
        claimed: 'courier.outcomeClaimed',
        already: 'courier.outcomeAlready',
        taken: 'courier.outcomeTaken',
        closed: 'courier.outcomeClosed',
        not_found: 'courier.outcomeNotFound',
        done: 'courier.outcomeDone',
        not_yours: 'courier.outcomeNotYours',
      }
      const ok = good.includes(result.outcome)
      if (ok) hapticSuccess()
      else hapticError()
      return {
        kind: ok ? 'success' : 'error',
        text: t(key[result.outcome] || 'courier.outcomeNotFound', {
          who: result.courierName || t('courier.otherCourier'),
        }),
      }
    } catch (e) {
      hapticError()
      return { kind: 'error', text: e instanceof Error ? e.message : 'Xato' }
    } finally {
      setBusyId(null)
      await reload()
    }
  }

  return {
    take: (id) => run(id, () => takeOrder(id), ['claimed', 'already']),
    deliver: (id) => run(id, () => deliverOrder(id), ['done', 'already']),
  }
}

export type LocationState =
  | { status: 'loading'; point: Point | null }
  | { status: 'ok'; point: Point }
  | { status: 'off'; point: null; openSettings?: () => void }

/**
 * Kuryerning joylashuvi — marshrutning boshlang'ich nuqtasi.
 *
 * Ruxsat bo'lmasa sahifa baribir ishlaydi: tartib eng eski buyurtmadan
 * boshlanadi va tepada «Yoqish» tugmasi turadi.
 */
export function useCourierLocation() {
  const [state, setState] = useState<LocationState>({ status: 'loading', point: null })

  const read = useCallback(async () => {
    const result = await requestLocation()
    if (result.ok) setState({ status: 'ok', point: { lat: result.lat, lng: result.lng } })
    else {
      setState((prev) =>
        // Oldin aniqlangan joy bo'lsa, vaqtinchalik xatoda uni yo'qotmaymiz
        prev.status === 'ok' ? prev : { status: 'off', point: null, openSettings: result.openSettings },
      )
    }
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void read(), 0)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void read()
    }, LOCATION_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [read])

  const retry = useCallback(() => {
    if (state.status === 'off' && state.openSettings) state.openSettings()
    setState((prev) => ({ status: 'loading', point: prev.point }) as LocationState)
    void read()
  }, [read, state])

  return { location: state, retry }
}
