import { Gift, Share2 } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import { useI18n } from '../../i18n'
import { hapticSelection, openExternalLink } from '../../utils/telegram'

/**
 * Konkurs kartasi (bosh sahifa). Admin → «Konkurs» sozlaganda ko'rinadi:
 * shartlar va «Do'stlarni taklif qilish» — shaxsiy havola
 * t.me/musauz_bot?start=ref_<id>. Taklif qilingan YANGI do'st konkursda
 * qo'shimcha imkoniyat beradi (api/_lib/actions/giveaway.ts).
 */

type Giveaway = { title: string; prize: string; startAt: string | null; endAt: string | null; winners: number; referral: boolean; finished?: boolean }

const BOT = 'musauz_bot'

export function GiveawayCard({ userId }: { userId: number | null }) {
  const { t } = useI18n()
  const [data, setData] = useState<Giveaway | null>(null)

  // Bir marta o'qiladi (Rules: settings — kirgan foydalanuvchi)
  useEffect(() => {
    if (!userId) return
    let alive = true
    getDoc(doc(db, 'settings', 'giveaway'))
      .then((snap) => { if (alive && snap.exists()) setData(snap.data() as Giveaway) })
      .catch(() => {})
    return () => { alive = false }
  }, [userId])

  const [now] = useState(() => Date.now())
  if (!data || !userId || data.finished || !data.startAt) return null
  if (Date.parse(data.startAt) > now || (data.endAt && Date.parse(data.endAt) < now)) return null

  const invite = () => {
    hapticSelection()
    const link = `https://t.me/${BOT}?start=ref_${userId}`
    const text = t('giveaway.shareText', { prize: data.prize })
    openExternalLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`)
  }

  return (
    <section className="px-5 pt-4 sm:px-10">
      <div className="gw-card">
        <div className="gw-card__head">
          <span className="gw-card__icon"><Gift size={24} /></span>
          <div className="min-w-0 flex-1">
            <b>{data.title}</b>
            <span>{t('giveaway.prize', { count: data.winners, prize: data.prize })}</span>
          </div>
        </div>
        {data.endAt && (
          <p className="gw-card__when">{t('giveaway.until', { date: new Date(data.endAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) })}</p>
        )}
        {data.referral && (
          <>
            <p className="gw-card__hint">{t('giveaway.referralHint')}</p>
            <button className="gw-card__btn" onClick={invite}>
              <Share2 size={18} /> {t('giveaway.invite')}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
