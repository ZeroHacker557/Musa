# MUSA Shop — Telegram Mini App

MUSA (yarim tayyor mahsulotlar) uchun Telegram mini app do'koni:
React + TypeScript + Tailwind CSS frontend, Vercel serverless API va aiogram
asosidagi Telegram bot.

## Brend

| Element | Qiymat |
| --- | --- |
| Asosiy rang | `#0A7A3D` (logo yashili) |
| Aksent | `#F2C94C` (logo sarig'i) / matn uchun `#A9760A` |
| Uchinchi rang | `#16359E` (logodagi ko'k yozuv) |
| Shriftlar | Archivo Black (sarlavha), Montserrat (matn) |
| Logotip | `src/components/brand/BrandLogo.tsx` — CSS bilan chizilgan, rasm fayli kerak emas |
| Hero rasm | Hozircha yo'q — `src/pages/HomePage.tsx` da logotip plitasi turibdi |

Kompaniya ma'lumotlari (telefon, email, Telegram, bot username) bitta joyda:
[`src/config/brand.ts`](src/config/brand.ts). Bot tomonida — `bot/config.py`.

Ranglar `src/styles.css` dagi CSS o'zgaruvchilarida. Komponentlarda hex
yozilmaydi — faqat `var(--brand)` kabi tokenlar, shu tufayli qorong'i rejim
bitta blokda hal bo'ladi.

> ⚠️ Loyihada `TODO(MUSA)` deb belgilangan bo'sh joy tutuvchi qiymatlar bor
> (Firebase config, bot username, telefon, karta). Ishga tushirishdan oldin
> [`DEPLOY.md`](./DEPLOY.md) → "0. MUSA ga o'tish" bo'limidagi ro'yxatni
> to'ldiring. Ularni topish uchun: `grep -rn "TODO(MUSA)" src bot`.

## Tuzilma

- `src/pages` — ekranlar: bosh sahifa, katalog, profil, buyurtmalar, mahsulot detali.
- `src/components/brand` — logotip komponenti.
- `src/components` — qayta ishlatiluvchi layout, UI, mahsulot va buyurtma komponentlari.
- `src/config/brand.ts` — brend va aloqa konstantalari.
- `src/hooks` — ilovaning UI holati va biznes harakatlari.
- `src/i18n` — o'zbekcha (asosiy) va ruscha lug'atlar.
- `src/types` — markazlashtirilgan TypeScript domen turlari.
- `api/` — Vercel serverless funksiyalari (auth, orders, reviews, promo).
- `bot/` — aiogram bot va admin panel.
- `public/images/products` — mahsulot rasmlari (bot admin paneli orqali ham yuklanadi).

## Buyruqlar

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

Mahsulotlar bazadan (Firestore) keladi va bot admin paneli orqali qo'shiladi —
`src/data.ts` bo'sh ro'yxat qaytaradi.
