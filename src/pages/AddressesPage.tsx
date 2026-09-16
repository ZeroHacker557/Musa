import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, Loader2, LocateFixed, MapPin, Maximize2, Minimize2, Pencil, Plus, Trash2 } from 'lucide-react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { updateUserProfile } from '../lib/firebase'
import { auth } from '../lib/auth'
import { hapticFeedback, hapticSuccess, requestLocation } from '../utils/telegram'
import { reverseGeocode } from '../utils/geocode'
import { useI18n, useT } from '../i18n'
import type { Address, UserProfile } from '../types/domain'
import type { TranslationKey } from '../i18n'

/**
 * Manzil nomi uchun tayyor variantlar.
 *
 * Mijozlar «Manzil nomi» maydonida adashib qolishardi — bu nima
 * degani, nima yozish kerak? Endi nom O'ZI qo'yiladi (ro'yxatdagi
 * birinchi ishlatilmagan variant) va bir bosishda almashtiriladi.
 */
const NAME_PRESETS: TranslationKey[] = [
  'address.nameHome', 'address.nameWork', 'address.nameFriend', 'address.nameDacha',
]

// Leaflet standart ikonkasi bundler bilan ishlamaydi — qo'lda beramiz
L.Marker.prototype.options.icon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const TASHKENT = { lat: 41.2995, lng: 69.2401 }

function MapUpdater({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([center.lat, center.lng], map.getZoom())
  }, [center, map])
  return null
}

function MapEvents({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
      hapticFeedback('light')
    },
  })
  return null
}

type Props = {
  profile: UserProfile | null
  onBack: () => void
  onNotify: (msg: string) => void
  /**
   * Sahifa qaysi maqsadda ochildi (bosh sahifadagi taklifdan):
   * 'here' — joylashuv darhol so'raladi, 'other' — xaritadan tanlanadi.
   */
  intent?: 'here' | 'other' | null
}

export function AddressesPage({ profile, onBack, onNotify, intent = null }: Props) {
  const t = useT()
  const { lang } = useI18n()
  // useMemo: har renderdagi yangi bo'sh massiv quyidagi memolarni qayta hisoblatmasin
  const addresses = useMemo(() => profile?.addresses || [], [profile?.addresses])

  /**
   * Manzil qo'shish bosqichi.
   *
   *   null     — ro'yxat
   *   'choose' — «men turgan joy» yoki «boshqa joy» tanlovi
   *   'form'   — maydonlar va xarita
   *
   * Tanlov alohida bosqich qilingan: ko'pchilik hozir turgan joyiga
   * buyurtma beradi va ularga xaritani titkilash shart emas.
   */
  const [step, setStep] = useState<null | 'choose' | 'form'>(intent ? 'form' : null)
  /**
   * Tahrirlanayotgan manzil identifikatori; `null` — yangi manzil.
   *
   * Bitta forma ikkala ish uchun ishlaydi: mijoz saqlangan manzilga
   * bossa maydonlar to'ldirilgan holda ochiladi va xarita o'sha
   * nuqtaga uchadi — belgini surib qo'yish kifoya.
   */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mapFull, setMapFull] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newFullAddress, setNewFullAddress] = useState('')
  const [mapCenter, setMapCenter] = useState(TASHKENT)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  /** Xaritadan manzil matni olinmoqda. */
  const [geocoding, setGeocoding] = useState(false)
  /** Manzil matni xaritadan to'ldirildi (mijoz tekshirib chiqsin). */
  const [autoFilled, setAutoFilled] = useState(false)
  /** Mijoz manzil matnini o'zi yozdimi — unda ustiga yozmaymiz. */
  const typedAddress = useRef(false)
  /** Maydondagi joriy matn (effekt ichida o'qish uchun). */
  const fullRef = useRef('')
  /**
   * Joylashuv MIJOZ tomonidan belgilandimi.
   *
   * Saqlangan manzil tahrirga ochilganda ham `location` to'ladi, lekin
   * u allaqachon ma'lum — bekorga so'rov yubormaymiz.
   */
  const userPicked = useRef(false)
  /**
   * Xaritadan olingan, lekin AVTOMATIK qo'yilmagan manzil.
   *
   * Mijozning o'z matni bor bo'lsa uni bosib o'tmaymiz: yangi joyning
   * manzili shunchaki taklif qilinadi, qo'yish-qo'ymaslik mijozning ishi.
   */
  const [suggestion, setSuggestion] = useState<string | null>(null)

  /** Bo'sh maydonga qo'yiladigan nom: ishlatilmagan birinchi variant. */
  const suggestedName = useMemo(() => {
    const used = new Set(addresses.map((a) => a.name.trim().toLowerCase()))
    const free = NAME_PRESETS.map((key) => t(key)).find((name) => !used.has(name.toLowerCase()))
    return free || `${t('address.name')} ${addresses.length + 1}`
  }, [addresses, t])

  const handleCurrentLocation = async () => {
    if (locating) return
    setLocating(true)
    try {
      const result = await requestLocation()
      if (result.ok) {
        const coords = { lat: result.lat, lng: result.lng }
        userPicked.current = true
        setMapCenter(coords)
        setLocation(coords)
        hapticFeedback('medium')
        return
      }
      if (result.reason === 'denied') {
        onNotify(t('address.locationDenied'))
        // Telegram rad etilgan ruxsatni qayta so'ramaydi — sozlamalarni ochamiz
        result.openSettings?.()
      } else if (result.reason === 'timeout') {
        onNotify(t('address.locationTimeout'))
      } else {
        onNotify(t('address.locationFailed'))
      }
    } finally {
      setLocating(false)
    }
  }

  /** Forma maydonlarini boshlang'ich holatga qaytaradi. */
  const resetForm = () => {
    setNewName('')
    setNewFullAddress('')
    setLocation(null)
    setAutoFilled(false)
    setGeocoding(false)
    setEditingId(null)
    setSuggestion(null)
    typedAddress.current = false
    userPicked.current = false
    fullRef.current = ''
  }

  /** Xaritada yangi nuqta belgilandi. */
  const handlePickOnMap = (point: { lat: number; lng: number }) => {
    userPicked.current = true
    setLocation(point)
  }

  /** Taklif qilingan manzilni maydonga qo'yish. */
  const applySuggestion = () => {
    if (!suggestion) return
    fullRef.current = suggestion
    setNewFullAddress(suggestion)
    setAutoFilled(true)
    setSuggestion(null)
    hapticFeedback('light')
  }

  /** Saqlangan manzilni tahrirlash — maydonlar to'ldirilgan holda ochiladi. */
  const startEdit = (addr: Address) => {
    setEditingId(addr.id)
    setNewName(addr.name)
    setNewFullAddress(addr.address)
    fullRef.current = addr.address
    userPicked.current = false
    setSuggestion(null)
    setLocation(addr.location)
    setMapCenter(addr.location)
    // Mijozning o'z matni saqlanadi: xaritadan kelgan matn uni bosib
    // ketmasin. Maydon bo'shatilsa — yana avtomatik to'ldiriladi.
    typedAddress.current = true
    setAutoFilled(false)
    setStep('form')
    hapticFeedback('light')
  }

  /**
   * Formani ochish. Nom O'ZI yoziladi — mijozga faqat manzilni
   * tasdiqlash qoladi. «Shu yer» bo'lsa joylashuv ham darhol so'raladi.
   */
  const startForm = async (mode: 'here' | 'other') => {
    setEditingId(null)
    setNewName((current) => current.trim() || suggestedName)
    setStep('form')
    if (mode === 'here') await handleCurrentLocation()
  }

  // Taklifdan «shu yer» bilan kelingan bo'lsa — joylashuvni darhol so'raymiz
  const started = useRef(false)
  useEffect(() => {
    if (!intent || started.current) return
    started.current = true
    void startForm(intent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent])

  /*
   * Joy belgilangach manzil matnini xaritadan olamiz.
   *
   * Mijozlar bu maydonni turlicha to'ldirishardi va kuryer topa
   * olmasdi. Endi ko'cha va uy raqami tayyor keladi, mijoz faqat
   * mo'ljalni qo'shadi. O'zi yozgan bo'lsa — tegilmaydi.
   */
  useEffect(() => {
    // Saqlangan manzil ochilganda so'rov yubormaymiz — manzil tayyor
    if (!location || !userPicked.current) return
    const ctrl = new AbortController()
    // Nominatim siyosati: tez-tez so'ramaslik. Xaritada bir necha marta
    // bosilsa faqat oxirgi nuqta so'raladi.
    const timer = window.setTimeout(async () => {
      setGeocoding(true)
      const text = await reverseGeocode(location.lat, location.lng, lang, ctrl.signal)
      if (ctrl.signal.aborted) return
      setGeocoding(false)
      if (!text) return
      // Mijoz o'zi yozgan bo'lsa ustiga yozmaymiz — taklif qilamiz
      if (typedAddress.current && fullRef.current.trim()) {
        setSuggestion(text.trim() === fullRef.current.trim() ? null : text)
        return
      }
      fullRef.current = text
      setNewFullAddress(text)
      setAutoFilled(true)
    }, 550)
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
  }, [location, lang])

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newFullAddress.trim() || !location) {
      onNotify(t('address.fillAll'))
      return
    }

    const uid = auth.currentUser?.uid
    if (!uid) {
      // Firebase seansi yo'q. Ilgari bu yerda jim `return` turardi —
      // tugma bosilardi-yu hech narsa bo'lmasdi va sabab ko'rinmasdi.
      onNotify(t('error.notSignedIn'))
      return
    }
    if (!profile) {
      // Profil hali o'qilmagan: hozir yozsak mavjud manzillar o'chib ketadi
      onNotify(t('common.loading'))
      return
    }

    setLoading(true)
    try {
      // Tahrirda ID o'zgarmaydi: buyurtmada tanlangan manzilga ishora
      // uzilib qolmasin
      const next: Address[] = editingId
        ? addresses.map((a) =>
            a.id === editingId
              ? { ...a, name: newName.trim(), address: newFullAddress.trim(), location }
              : a,
          )
        : [
            ...addresses,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: newName.trim(),
              address: newFullAddress.trim(),
              location,
            },
          ]

      await updateUserProfile(Number(uid), { addresses: next })
      const wasEditing = editingId !== null
      setStep(null)
      resetForm()
      hapticSuccess()
      onNotify(t(wasEditing ? 'address.updated' : 'address.saved'))
    } catch (error) {
      console.error('[Manzil] saqlanmadi:', error)
      onNotify(t('error.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAddress = async (id: string) => {
    const uid = auth.currentUser?.uid
    if (!uid) {
      onNotify(t('error.notSignedIn'))
      return
    }
    try {
      await updateUserProfile(Number(uid), { addresses: addresses.filter((a) => a.id !== id) })
      hapticFeedback('light')
      onNotify(t('address.deleted'))
    } catch (error) {
      console.error('[Manzil] o\'chirilmadi:', error)
      onNotify(t('error.saveFailed'))
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 px-5 pt-8 sm:px-10">
        <button
          onClick={() => {
            // Tahrirdan to'g'ri ro'yxatga, yangi manzildan tanlovga,
            // tanlovdan ro'yxatga, ro'yxatdan sahifadan chiqamiz
            if (step === 'form') {
              setStep(editingId ? null : 'choose')
              resetForm()
            } else if (step === 'choose') setStep(null)
            else onBack()
          }}
          className="back-button"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--ink)' }}>
          {step ? t(editingId ? 'address.edit' : 'address.new') : t('address.title')}
        </h1>
      </header>

      {step === 'choose' ? (
        /*
         * Manzil turini tanlash.
         *
         * Ko'pchilik mijoz hozir turgan joyiga buyurtma beradi va ular
         * uchun xaritani titkilash ortiqcha ish. Shuning uchun avval
         * shu savol beriladi: «shu yerdami yoki boshqa joyga?».
         */
        <div className="flex flex-col gap-3 px-5 pb-32 pt-6 sm:px-10 page-animate">
          <p className="mb-1 text-sm" style={{ color: 'var(--muted)' }}>
            {t('address.chooseMode')}
          </p>

          <button
            type="button"
            className="mode-card"
            onClick={() => { void startForm('here') }}
          >
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
            >
              <LocateFixed size={22} />
            </span>
            <span className="min-w-0">
              <b className="block text-base" style={{ color: 'var(--ink)' }}>
                {t('address.here')}
              </b>
              <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                {t('address.hereHint')}
              </span>
            </span>
          </button>

          <button type="button" className="mode-card" onClick={() => { void startForm('other') }}>
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl"
              style={{ background: 'var(--royal-soft)', color: 'var(--royal)' }}
            >
              <MapPin size={22} />
            </span>
            <span className="min-w-0">
              <b className="block text-base" style={{ color: 'var(--ink)' }}>
                {t('address.other')}
              </b>
              <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                {t('address.otherHint')}
              </span>
            </span>
          </button>
        </div>
      ) : step === 'form' ? (
        <form onSubmit={handleSaveAddress} className="kb-safe px-5 pt-6 sm:px-10 page-animate">
          <div className="space-y-5">
            <div>
              <label className="field-label">
                {t('address.name')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="field">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('address.namePlaceholder')}
                  /* Nomi allaqachon turibdi — bosilganda hammasi
                     belgilanadi: o'chirish bilan ovora bo'lmasin */
                  onFocus={(e) => e.currentTarget.select()}
                  required
                />
              </div>
              {/* Bir bosishda nom: mijoz nima yozishni o'ylab qolmasin */}
              <div className="name-chips">
                {NAME_PRESETS.map((key) => {
                  const label = t(key)
                  const active = newName.trim().toLowerCase() === label.toLowerCase()
                  return (
                    <button
                      key={key}
                      type="button"
                      className={'name-chip ' + (active ? 'active' : '')}
                      onClick={() => { setNewName(label); hapticFeedback('light') }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs" style={{ color: 'var(--faint)' }}>{t('address.nameHint')}</p>
            </div>

            <div>
              <label className="field-label">
                {t('address.full')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div className="field">
                <input
                  value={newFullAddress}
                  onChange={(e) => {
                    // Bo'shatib yuborsa yana xaritadan to'ldirsa bo'ladi
                    typedAddress.current = e.target.value.trim().length > 0
                    fullRef.current = e.target.value
                    setAutoFilled(false)
                    setNewFullAddress(e.target.value)
                  }}
                  placeholder={t('address.fullPlaceholder')}
                  required
                />
              </div>
              {/* Xaritadan olingan manzil — mijoz tekshirib, mo'ljal qo'shadi */}
              {geocoding ? (
                <p className="addr-status" style={{ color: 'var(--muted)' }}>
                  <Loader2 size={13} className="animate-spin" />
                  {t('address.autoFilling')}
                </p>
              ) : autoFilled ? (
                <p className="addr-status" style={{ color: 'var(--brand)' }}>
                  <Check size={13} />
                  {t('address.autoFilled')}
                </p>
              ) : null}

              {/* Yangi joyning manzili — mijozning o'z matnini bosib o'tmaymiz */}
              {suggestion && (
                <button type="button" className="addr-suggest" onClick={applySuggestion}>
                  <MapPin size={13} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{suggestion}</span>
                  <b className="shrink-0">{t('address.useSuggestion')}</b>
                </button>
              )}
            </div>

            <div>
              <label className="field-label">
                {t('address.pickOnMap')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div
                className={'map-box ' + (mapFull ? 'map-box--full' : '')}
                style={{ borderColor: location ? 'var(--brand)' : 'var(--line)' }}
              >
                <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={12} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                  <MapUpdater center={mapCenter} />
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  {location && <Marker position={location} />}
                  <MapEvents onPick={handlePickOnMap} />
                </MapContainer>

                <button
                  type="button"
                  onClick={handleCurrentLocation}
                  disabled={locating}
                  className="absolute bottom-4 right-4 z-[400] grid size-12 place-items-center rounded-xl transition active:scale-95 disabled:opacity-70"
                  style={{ background: 'var(--surface)', color: 'var(--brand)', boxShadow: 'var(--shadow-md)' }}
                  aria-label={t('address.myLocation')}
                  aria-busy={locating}
                >
                  {locating ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <LocateFixed size={22} />
                  )}
                </button>

                {/* Kichik oynada aniq nuqta tanlash qiyin — to'liq ekran kerak */}
                <button
                  type="button"
                  onClick={() => setMapFull((v) => !v)}
                  className="absolute right-4 top-4 z-[400] grid size-10 place-items-center rounded-xl transition active:scale-95"
                  style={{ background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'var(--shadow-md)' }}
                  aria-label={mapFull ? t('common.close') : t('address.expandMap')}
                >
                  {mapFull ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
              </div>
              {/*
                Xaritadagi kichik ikonka ko'pchilikka ko'rinmay qolardi —
                shuning uchun pastda to'liq yozuvli tugma turadi.
              */}
              <button
                type="button"
                onClick={handleCurrentLocation}
                disabled={locating}
                className="btn-ghost mt-3 w-full justify-center py-3 text-sm"
              >
                {locating ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />}
                {t('address.useCurrent')}
              </button>

              <p
                className="mt-2 text-center text-xs font-bold"
                style={{ color: location ? 'var(--brand)' : 'var(--faint)' }}
              >
                {location ? t('address.picked') : t('address.notPicked')}
              </p>
              <p className="mt-1 text-center text-xs" style={{ color: 'var(--faint)' }}>
                {t('address.mapHint')}
              </p>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary mt-8 w-full py-4">
            {loading ? t('common.saving') : t('common.save')}
          </button>
        </form>
      ) : (
        <div className="px-5 pb-32 pt-6 sm:px-10 page-animate">
          {addresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div
                className="mb-4 grid size-16 place-items-center rounded-full"
                style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}
              >
                <MapPin size={26} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--ink-2)' }}>{t('address.empty')}</h3>
              <p className="mt-1 max-w-[240px] text-sm" style={{ color: 'var(--muted)' }}>{t('address.emptyText')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="address-row">
                  {/* Butun qator bosiladi — nom, manzil va joylashuv tahrirlanadi */}
                  <button
                    type="button"
                    className="address-row__main"
                    onClick={() => startEdit(addr)}
                    aria-label={`${addr.name} — ${t('address.edit')}`}
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full"
                      style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                    >
                      <MapPin size={19} />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <b className="block truncate font-bold" style={{ color: 'var(--ink)' }}>{addr.name}</b>
                      <span className="mt-0.5 block truncate text-xs font-medium" style={{ color: 'var(--muted)' }}>
                        {addr.address}
                      </span>
                    </span>
                    <span className="address-row__edit" aria-hidden="true">
                      <Pencil size={15} />
                    </span>
                  </button>

                  <button
                    onClick={() => handleDeleteAddress(addr.id)}
                    className="address-row__delete"
                    aria-label={t('address.deleteAction')}
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {addresses.length > 0 && (
            <p className="mt-3 text-center text-xs" style={{ color: 'var(--faint)' }}>
              {t('address.editHint')}
            </p>
          )}

          <button
            onClick={() => { resetForm(); setStep('choose') }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4 font-bold transition"
            style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            <Plus size={20} />
            {t('address.add')}
          </button>
        </div>
      )}
    </>
  )
}
