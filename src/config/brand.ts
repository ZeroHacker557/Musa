/**
 * MUSA brend va kompaniya ma'lumotlari — bitta manba.
 *
 * Bot username, domen va aloqa raqamlari shu yerda turadi; ilovaning
 * qolgan qismi faqat shu konstantalarga murojaat qiladi. Yangi bot
 * tokeni / domen kelganda o'zgartiriladigan yagona fayl (bot tomonida
 * esa bot/config.py).
 *
 * ⚠️ TODO(MUSA): quyida "TODO(MUSA)" deb belgilangan qiymatlar bo'sh joy
 * tutuvchi — haqiqiy emas. Ishga tushirishdan OLDIN ularni to'ldiring va
 * DEPLOY.md → "0. MUSA ga o'tish" ro'yxatini tekshiring.
 */
export const BRAND = {
  name: 'MUSA',
  legalName: 'MUSA',
  tagline: 'Yarim tayyor mahsulotlar',
  taglineRu: 'Полуфабрикаты',

  /** Telegram bot — mini app shu bot ichida ochiladi. */
  botUsername: 'musa_shop_bot', // TODO(MUSA): @BotFather dagi haqiqiy username

  /** Mijozlar xizmati. */
  phone: '+998 00 000 00 00', // TODO(MUSA): haqiqiy raqam
  phoneHref: 'tel:+998000000000', // TODO(MUSA): haqiqiy raqam
  email: 'info@musa.uz', // TODO(MUSA): haqiqiy email
  telegram: '@musa_uz', // TODO(MUSA): haqiqiy kanal
  telegramHref: 'https://t.me/musa_uz', // TODO(MUSA): haqiqiy kanal

  /** Ish vaqti va manzil — bot javoblarida ham ishlatiladi. */
  city: "Toshkent, O'zbekiston",
  workHours: '09:00 — 20:00',
} as const

/**
 * Ilovani ishlab chiqqan dasturchi — "Yordam" sahifasidagi alohida blok.
 * Texnik savollar MUSA mijozlar xizmatiga emas, shu manzillarga tushadi.
 */
export const DEVELOPER = {
  name: 'Abubakr.A',
  phone: '+998 97 400 98 77',
  phoneHref: 'tel:+998974009877',
  telegram: '@for_name',
  telegramHref: 'https://t.me/for_name',
  email: 'abubakrfrontend@gmail.com',
} as const

export const BOT_URL = `https://t.me/${BRAND.botUsername}`
