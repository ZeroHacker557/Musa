import {
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  Phone,
  MapPin,
  ArrowLeft,
  Headphones,
  Clock,
  CheckCircle2,
  Code2,
  ChefHat,
  IceCreamCone,
  Snowflake,
} from 'lucide-react'
import { useState } from 'react'
import { BRAND, DEVELOPER } from '../config/brand'
import { useT } from '../i18n'

type Props = {
  onBack: () => void
}

const faqs_uz = [
  {
    q: "MUSA mahsulotlari nimasi bilan ajralib turadi?",
    a: "MUSA — yarim tayyor mahsulotlar, muzqaymoq va siroklar ishlab chiqaradi. Xomashyo har kuni yangi, mahsulot tayyorlangan zahoti shok muzlatishdan o‘tadi. Sun’iy qo‘shimchalar va konservantlar ishlatilmaydi.",
  },
  {
    q: "Qanday mahsulotlar bor?",
    a: "Yarim tayyor: chuchvara, manti, somsa, kotlet, naggets, lyulya-kabob, xamir mahsulotlari. Shirinliklar: muzqaymoq va glazurlangan siroklar. To‘liq ro‘yxat va vaznlar katalogda ko‘rsatilgan.",
  },
  {
    q: "Mahsulot qanday yetkaziladi?",
    a: "Toshkent bo‘ylab 24 soat ichida, termo-qopda muzlatilgan holda. Buyurtma holati o‘zgarganda sizga avtomatik bildirishnoma keladi.",
  },
  {
    q: "Mahsulotni qanday saqlash kerak?",
    a: "Barcha mahsulotlar muzlatgichda −18°C haroratda saqlanadi — muzqaymoq va siroklar ham. Bir marta erigan mahsulotni qayta muzlatish tavsiya etilmaydi.",
  },
  {
    q: "Eng kam buyurtma miqdori bormi?",
    a: "Yo‘q, hatto bitta paketdan ham buyurtma berishingiz mumkin. Katta summadagi buyurtmalar bepul yetkaziladi — summa rasmiylashtirish sahifasida ko‘rsatiladi.",
  },
  {
    q: "To‘lov qanday amalga oshiriladi?",
    a: "Naqd pul (yetkazishda) yoki karta orqali o‘tkazma. Karta orqali to‘lasangiz, chekni botga yuboring — operator tekshirib tasdiqlaydi.",
  },
  {
    q: "Ulgurji xarid yoki hamkorlik mumkinmi?",
    a: "Ha. Do‘kon, kafe, restoran va distribyutorlar uchun alohida shartlar bor — quyidagi raqam yoki Telegram orqali bog‘laning.",
  },
  {
    q: "Promo kod qanday ishlatiladi?",
    a: "Buyurtma berish sahifasida «Promokod» maydoniga kodingizni kiriting va «Qo‘llash» tugmasini bosing. Chegirma avtomatik qo‘shiladi.",
  },
]

const faqs_ru = [
  {
    q: "Чем отличается продукция MUSA?",
    a: "MUSA производит полуфабрикаты, мороженое и сырки. Сырьё свежее каждый день, продукт сразу после приготовления проходит шоковую заморозку. Без искусственных добавок и консервантов.",
  },
  {
    q: "Какие есть продукты?",
    a: "Полуфабрикаты: пельмени, манты, самса, котлеты, наггетсы, люля-кебаб, тестовые изделия. Десерты: мороженое и глазированные сырки. Полный список и вес указаны в каталоге.",
  },
  {
    q: "Как доставляется заказ?",
    a: "По Ташкенту — в течение 24 часов, в термосумке и замороженном виде. При изменении статуса заказа вы получите уведомление.",
  },
  {
    q: "Как хранить продукт?",
    a: "Все продукты хранятся в морозильной камере при −18°C — мороженое и сырки тоже. Повторная заморозка размороженного продукта не рекомендуется.",
  },
  {
    q: "Есть ли минимальный заказ?",
    a: "Нет, заказать можно даже один пакет. Крупные заказы доставляются бесплатно — сумма указана на странице оформления.",
  },
  {
    q: "Как осуществляется оплата?",
    a: "Наличными при доставке или переводом на карту. При оплате картой отправьте чек боту — оператор проверит и подтвердит.",
  },
  {
    q: "Возможна ли оптовая закупка или сотрудничество?",
    a: "Да. Для магазинов, кафе, ресторанов и дистрибьюторов действуют отдельные условия — свяжитесь по телефону или в Telegram ниже.",
  },
  {
    q: "Как использовать промокод?",
    a: "На странице оформления заказа введите код в поле «Промокод» и нажмите «Применить». Скидка добавится автоматически.",
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition active:opacity-70"
      >
        <span className="font-semibold text-sm leading-snug" style={{ color: 'var(--ink)' }}>
          {q}
        </span>
        <span className="shrink-0" style={{ color: 'var(--brand)' }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      {open && (
        <div
          className="px-5 pb-4 text-sm leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          {a}
        </div>
      )}
    </div>
  )
}

export function SupportPage({ onBack }: Props) {
  const t = useT()
  // detect lang from localStorage
  const lang = (localStorage.getItem('musaShopLang') ?? 'uz') as 'uz' | 'ru'
  const faqs = lang === 'ru' ? faqs_ru : faqs_uz

  const contacts = [
    {
      id: 'phone',
      icon: Phone,
      label: lang === 'ru' ? 'Телефон' : 'Telefon',
      value: BRAND.phone,
      href: BRAND.phoneHref,
      color: 'var(--brand)',
      bg: 'var(--brand-soft)',
    },
    {
      id: 'telegram',
      icon: MessageCircle,
      label: 'Telegram',
      value: BRAND.telegram,
      href: BRAND.telegramHref,
      color: '#0ea5e9',
      bg: 'rgba(14,165,233,0.12)',
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Email',
      value: BRAND.email,
      href: `mailto:${BRAND.email}`,
      color: 'var(--gold)',
      bg: 'var(--gold-soft)',
    },
  ]

  const devContacts = [
    { icon: Phone, value: DEVELOPER.phone, href: DEVELOPER.phoneHref },
    { icon: MessageCircle, value: DEVELOPER.telegram, href: DEVELOPER.telegramHref },
    { icon: Mail, value: DEVELOPER.email, href: `mailto:${DEVELOPER.email}` },
  ]

  const about = lang === 'ru'
    ? [
        { icon: Snowflake, title: 'Шоковая заморозка', text: 'Продукт замораживается сразу после приготовления.' },
        { icon: ChefHat, title: 'Свежее сырьё', text: 'Мясо, тесто и молочные продукты — свежие каждый день.' },
        { icon: IceCreamCone, title: 'Широкий ассортимент', text: 'Полуфабрикаты, мороженое и глазированные сырки.' },
      ]
    : [
        { icon: Snowflake, title: 'Shok muzlatish', text: "Mahsulot tayyorlangan zahoti −18°C da muzlatiladi." },
        { icon: ChefHat, title: 'Yangi xomashyo', text: "Go‘sht, xamir va sut mahsulotlari har kuni yangi." },
        { icon: IceCreamCone, title: 'Keng assortiment', text: 'Yarim tayyor mahsulotlar, muzqaymoq va siroklar.' },
      ]

  const features = lang === 'ru'
    ? [
        { icon: Clock, text: `Приём заказов ${BRAND.workHours}` },
        { icon: CheckCircle2, text: 'Быстрый ответ' },
        { icon: MapPin, text: BRAND.city },
      ]
    : [
        { icon: Clock, text: `Buyurtmalar ${BRAND.workHours}` },
        { icon: CheckCircle2, text: 'Tez javob' },
        { icon: MapPin, text: BRAND.city },
      ]

  return (
    <>
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 pt-8 pb-5 sm:px-10"
        style={{ animation: 'fadeInUp 0.3s ease' }}
      >
        <button
          onClick={onBack}
          className="grid size-10 shrink-0 place-items-center rounded-xl transition active:scale-90"
          style={{ background: 'var(--surface-2)', color: 'var(--ink)' }}
          aria-label={t('common.back')}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold leading-tight" style={{ color: 'var(--ink)' }}>
            {lang === 'ru' ? 'Помощь и поддержка' : "Yordam va qo'llab-quvvatlash"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {lang === 'ru' ? 'Мы всегда рядом' : "Biz doim siz bilan"}
          </p>
        </div>
      </header>

      {/* Hero Card */}
      <section className="px-5 sm:px-10" style={{ animation: 'fadeInUp 0.35s ease 0.05s both' }}>
        <div
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, #0a7a3d 0%, #04331c 100%)',
          }}
        >
          {/* Decorative circles */}
          <div
            className="absolute -right-8 -top-8 size-32 rounded-full opacity-20"
            style={{ background: 'white' }}
          />
          <div
            className="absolute -bottom-6 right-10 size-20 rounded-full opacity-10"
            style={{ background: 'white' }}
          />

          <div className="relative z-10">
            <div
              className="inline-grid size-14 place-items-center rounded-2xl mb-4"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <Headphones size={28} color="white" />
            </div>
            <h2 className="wordmark text-xl text-white leading-tight">
              {lang === 'ru' ? `Служба заботы ${BRAND.name}` : `${BRAND.name} mijozlar xizmati`}
            </h2>
            <p className="mt-1.5 text-sm text-white opacity-80">
              {lang === 'ru'
                ? 'Свяжитесь с нами любым удобным способом'
                : "Qulay usul orqali biz bilan bog'laning"}
            </p>

            {/* Feature badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              {features.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}
                >
                  <Icon size={12} />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Cards */}
      <section
        className="px-5 pt-6 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Контакты' : "Bog'lanish"}
        </h2>
        <div className="flex flex-col gap-3">
          {contacts.map(({ id, icon: Icon, label, value, href, color, bg }) => (
            <a
              key={id}
              id={`support-contact-${id}`}
              href={href}
              target={id !== 'phone' ? '_blank' : undefined}
              rel="noreferrer"
              className="flex items-center gap-4 rounded-2xl border p-4 transition active:scale-[0.98] hover:opacity-90"
              style={{ borderColor: 'var(--line)', background: 'var(--surface)', textDecoration: 'none' }}
            >
              <span
                className="grid size-12 shrink-0 place-items-center rounded-2xl"
                style={{ background: bg, color }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  {label}
                </p>
                <p className="mt-0.5 truncate font-bold text-sm" style={{ color: 'var(--ink)' }}>
                  {value}
                </p>
              </div>
              <span
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold"
                style={{ background: bg, color }}
              >
                {lang === 'ru' ? 'Написать' : 'Yozish'}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* MUSA haqida */}
      <section
        className="px-5 pt-7 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.12s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? `О ${BRAND.name}` : `${BRAND.name} haqida`}
        </h2>
        <div
          className="rounded-2xl border p-2"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          {about.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3 p-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
              >
                <Icon size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dasturchi — texnik savollar shu yerga */}
      <section
        className="px-5 pt-7 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.14s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Разработчик' : 'Dasturchi'}
        </h2>
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid size-12 shrink-0 place-items-center rounded-2xl"
              style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}
            >
              <Code2 size={22} />
            </span>
            <div className="min-w-0">
              <p className="font-bold" style={{ color: 'var(--ink)' }}>{DEVELOPER.name}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {lang === 'ru'
                  ? 'Разработка приложения и технические вопросы'
                  : "Ilova dasturchisi — texnik savollar bo'yicha"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {devContacts.map(({ icon: Icon, value, href }) => (
              <a
                key={value}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition active:scale-[0.98]"
                style={{ background: 'var(--surface-2)', textDecoration: 'none' }}
              >
                <Icon size={17} style={{ color: 'var(--gold)' }} />
                <span className="truncate text-sm font-semibold" style={{ color: 'var(--ink-2)' }}>
                  {value}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="px-5 pt-7 pb-32 sm:px-10"
        style={{ animation: 'fadeInUp 0.4s ease 0.15s both' }}
      >
        <h2 className="section-title mb-4">
          {lang === 'ru' ? 'Часто задаваемые вопросы' : "Ko'p so'raladigan savollar"}
        </h2>
        <div className="flex flex-col gap-3">
          {faqs.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>

        {/* Footer note */}
        <div
          className="mt-6 rounded-2xl border p-4 text-center"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {lang === 'ru'
              ? 'Не нашли ответ? Напишите нам — мы ответим в течение нескольких минут.'
              : "Javob topa olmadingizmi? Bizga yozing — bir necha daqiqa ichida javob beramiz."}
          </p>
        </div>
      </section>
    </>
  )
}
