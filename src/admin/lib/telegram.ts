/**
 * Admin panelni Telegram mini app sifatida ochish.
 *
 * Bot adminlarga «🛠 Admin panel» tugmasini ko'rsatadi (bot/bot.py) va
 * u shu sahifani (`admin.html`) Telegram ichida ochadi. Panel oddiy
 * brauzerda ham, Telegram ichida ham bir xil ishlaydi — bu modul
 * faqat Telegram ichida bo'lganda qo'shimcha sozlamalarni qo'llaydi:
 *
 *   • to'liq ekran (kompyuterda deraza butun ekranni egallaydi);
 *   • pastga surganda oyna yopilib ketmasligi;
 *   • tepadagi Telegram boshqaruv tugmalari ostida qolmaslik uchun
 *     xavfsiz zona (`--adm-inset-top`).
 *
 * Kirish (email/parol) o'zgarmaydi: Firebase seansi brauzer xotirasida
 * saqlanadi, shuning uchun admin bir marta kiradi va keyingi
 * ochilishlarda to'g'ridan-to'g'ri panelga tushadi.
 */

type SafeArea = { top?: number; bottom?: number; left?: number; right?: number }

type TelegramWebApp = {
  initData?: string
  version?: string
  isVersionAtLeast?: (v: string) => boolean
  ready?: () => void
  expand?: () => void
  requestFullscreen?: () => void
  exitFullscreen?: () => void
  isFullscreen?: boolean
  disableVerticalSwipes?: () => void
  safeAreaInset?: SafeArea
  contentSafeAreaInset?: SafeArea
  onEvent?: (event: string, handler: () => void) => void
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } }
}

export function getTelegram(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
}

/** Panel Telegram ichida ochilganmi (imzolangan initData bilan). */
export function isInTelegram(): boolean {
  return Boolean(getTelegram()?.initData)
}

/** Imzolangan initData — serverda Telegram ID ni tasdiqlash uchun. */
export function getInitData(): string {
  return getTelegram()?.initData || ''
}

/** Telegram ichidagi foydalanuvchi ismi (faqat ko'rsatish uchun). */
export function telegramUserLabel(): string {
  const user = getTelegram()?.initDataUnsafe?.user
  if (!user) return ''
  return user.username ? `@${user.username}` : user.first_name || ''
}

function applyInsets(tg: TelegramWebApp) {
  // To'liq ekranda Telegram o'z tugmalarini sahifa USTIGA chizadi.
  // `contentSafeAreaInset` — aynan o'sha tugmalar egallagan balandlik.
  const top = (tg.safeAreaInset?.top ?? 0) + (tg.contentSafeAreaInset?.top ?? 0)
  const bottom = (tg.safeAreaInset?.bottom ?? 0) + (tg.contentSafeAreaInset?.bottom ?? 0)
  const root = document.documentElement
  root.style.setProperty('--adm-inset-top', `${Math.round(top)}px`)
  root.style.setProperty('--adm-inset-bottom', `${Math.round(bottom)}px`)
}

/**
 * Telegram ichida bo'lsa panelni moslaydi. Brauzerda hech narsa qilmaydi.
 * `admin.html` yuklanishi bilan bir marta chaqiriladi.
 */
export function initAdminTelegram() {
  const tg = getTelegram()
  if (!tg || !tg.initData) return

  document.documentElement.classList.add('in-telegram')

  try {
    tg.ready?.()
    tg.expand?.()

    // Kompyuterda oyna butun ekranga chiqadi (Bot API 8.0+).
    // Eski mijozlarda e'tiborsiz qoldiriladi — panel baribir ochiladi.
    if (tg.isVersionAtLeast?.('8.0')) tg.requestFullscreen?.()

    // Ro'yxatni pastga surganda oyna yopilib ketmasin (7.7+)
    if (tg.isVersionAtLeast?.('7.7')) tg.disableVerticalSwipes?.()

    // Panel va sarlavha rangini `applyTheme` (src/utils/theme.ts) qo'yadi —
    // u tanlangan mavzuga qarab ishlaydi, shuning uchun bu yerda tegmaymiz.
  } catch (error) {
    // Telegram versiyasi qo'llab-quvvatlamasa — panel oddiy oynada ishlaydi
    console.warn('[admin/telegram] sozlab bo‘lmadi:', error)
  }

  applyInsets(tg)
  for (const event of ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged']) {
    tg.onEvent?.(event, () => applyInsets(tg))
  }
}
