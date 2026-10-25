import { Gift, Loader2, Share2, Trophy } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import { apiPost } from '../../lib/api'
import { useI18n } from '../../i18n'
import { hapticSelection, hapticSuccess, openExternalLink } from '../../utils/telegram'
import type { Product } from '../../types/domain'

/**
 * Konkurs kartasi (bosh sahifa). Admin → «Konkurs» sozlaganda chiqadi:
 * sanoq, sovg'a, o'z holati (ochko, o'rin), TOP-3 va «Do'stlarni taklif
 * qilish». Ochko va reyting serverdan (api/promo.ts → giveawayBoard).
 * Mini app'ni START siz ochganlar «Qatnashish» bilan qo'shiladi.
 */

type Settings = { title: string; prize: string; startAt: string | null; endAt: string | null; winners: number; referral: boolean; finished?: boolean }
type Board = {
  active: boolean
  participants: number
  me: { points: number; refs: number; rank: number } | null
  top: { name: string; points: number }[]
}

const BOT = 'musauz_bot'
/** Kartadagi rasmlar — «Sog'lom O'quv Mavsumi» tarkibidan. */
const PICS = ['503162', '271876', '641125']
const MEDALS = ['🥇', '🥈', '🥉']

function useCountdown(endAt: string | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!endAt) return
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [endAt])
  if (!endAt) return null
  const left = Math.max(0, Date.parse(endAt) - now)
  return { days: Math.floor(left / 86_400_000), hours: Math.floor((left % 86_400_000) / 3_600_000), minutes: Math.floor((left % 3_600_000) / 60_000) }
}

export function GiveawayCard({ userId, products }: { userId: number | null; products: Product[] }) {
  const { t } = useI18n()
  const [data, setData] = useState<Settings | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [joining, setJoining] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [now] = useState(() => Date.now())

  // Ochiq sozlama (Rules: settings — kirgan foydalanuvchi) va o'z natijasi
  useEffect(() => {
    // Faqat dev: `?gwDemo` — serversiz namunaviy konkurs va reyting
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('gwDemo')) {
      void Promise.resolve().then(() => {
        setData({ title: 'MUSA konkursi', prize: 'Sog‘lom O‘quv Mavsumi seti', startAt: '2026-10-01T00:00:00Z', endAt: new Date(Date.now() + 14 * 86_400_000 + 5 * 3_600_000).toISOString(), winners: 5, referral: true })
        setBoard({ active: true, participants: 128, me: new URLSearchParams(location.search).get('gwDemo') === 'new' ? null : { points: 4, refs: 3, rank: 7 }, top: [{ name: 'Aziza', points: 12 }, { name: 'Jasur', points: 9 }, { name: 'Dilnoza', points: 7 }, { name: 'Sardor', points: 6 }, { name: 'Malika', points: 5 }] })
      })
      return
    }
    if (!userId) return
    let alive = true
    getDoc(doc(db, 'settings', 'giveaway'))
      .then((snap) => {
        if (!alive || !snap.exists()) return
        setData(snap.data() as Settings)
        return apiPost<Board>('/api/promo', { kind: 'giveaway' }).then((b) => { if (alive) setBoard(b) })
      })
      .catch(() => {})
    return () => { alive = false }
  }, [userId])

  const countdown = useCountdown(data?.endAt ?? null)
  const demo = import.meta.env.DEV && new URLSearchParams(location.search).has('gwDemo')
  if (!data || (!userId && !demo) || data.finished || !data.startAt) return null
  if (Date.parse(data.startAt) > now || (data.endAt && Date.parse(data.endAt) < now)) return null

  const link = `https://t.me/${BOT}?start=ref_${userId}`
  const invite = () => {
    hapticSelection()
    const text = t('giveaway.shareText', { prize: data.prize })
    openExternalLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`)
  }
  const join = async () => {
    setJoining(true)
    try {
      setBoard(await apiPost<Board>('/api/promo', { kind: 'giveaway', join: true }))
      hapticSuccess()
    } catch {
      // Tarmoq xatosi — tugma qayta bosiladi
    } finally {
      setJoining(false)
    }
  }

  const pics = PICS.map((id) => products.find((p) => String(p.id) === id)).filter((p): p is Product => !!p)
  const me = board?.me ?? null
  const top = board?.top ?? []

  return (
    <section className="px-5 pt-4 sm:px-10">
      <div className="gw2">
        <span className="gw2__ribbon" aria-hidden="true" />
        <span className="gw2__confetti" aria-hidden="true" />

        <div className="gw2__top">
          <span className="gw2__badge"><Gift size={14} /> {t('gw.badge')}</span>
          {countdown && (
            <span className="gw2__timer">
              ⏳ {countdown.days > 0 ? t('gw.leftDays', { d: countdown.days, h: countdown.hours }) : t('gw.leftHours', { h: countdown.hours, m: countdown.minutes })}
            </span>
          )}
        </div>

        <div className="gw2__hero">
          <div className="gw2__text">
            <p className="gw2__count">{t('gw.count', { count: data.winners })}</p>
            <h3 className="gw2__title">{t('gw.title')}</h3>
            <p className="gw2__prize">«{data.prize.replace(/\s*seti$/i, '')}»</p>
          </div>
          <div className="gw2__pics" aria-hidden="true">
            {pics.map((p, i) => (
              <span key={p.id} className={`gw2__pic gw2__pic--${i}`}>
                <img src={p.thumbs?.[0] || p.images?.[0]} alt="" loading="lazy" />
              </span>
            ))}
          </div>
        </div>

        {/* O'z holati */}
        {board && (me ? (
          <div className="gw2__me">
            <p className="gw2__joined">✅ {t('gw.joined')}</p>
            <div className="gw2__stats">
              <div><b>{me.points}</b><span>{t('gw.points')}</span></div>
              <div><b>{me.rank}</b><span>{t('gw.rank')}</span></div>
              <div><b>{board.participants}</b><span>{t('gw.people')}</span></div>
            </div>
          </div>
        ) : (
          <button className="gw2__join" onClick={join} disabled={joining}>
            {joining ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />} {t('gw.join')}
          </button>
        ))}

        {/* TOP-3 / to'liq reyting */}
        {top.length > 0 && (
          <div className="gw2__board">
            <button className="gw2__board-head" onClick={() => setShowAll((v) => !v)}>
              <Trophy size={15} /> {t('gw.top')}
              <span>{showAll ? '▲' : t('gw.all')}</span>
            </button>
            <ol>
              {top.slice(0, showAll ? 10 : 3).map((r, i) => (
                <li key={i} className={i < 3 ? 'is-medal' : ''}>
                  <span className="gw2__place">{MEDALS[i] ?? `${i + 1}.`}</span>
                  <span className="gw2__name">{r.name}</span>
                  <b>{r.points} {t('gw.pointsShort')}</b>
                </li>
              ))}
            </ol>
          </div>
        )}

        {data.referral && (
          <>
            <button className="gw2__invite" onClick={invite}>
              <Share2 size={18} /> {t('giveaway.invite')}
            </button>
            <p className="gw2__hint">{t('gw.hint')}</p>
          </>
        )}
      </div>
    </section>
  )
}
