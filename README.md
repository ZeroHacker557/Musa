# MUSA Shop — Telegram Mini App

MUSA (muzlatilgan mahsulotlar — yarim tayyor, muzqaymoq, sirok) uchun
Telegram mini app do'koni:
React + TypeScript + Tailwind CSS frontend, Vercel serverless API va aiogram
asosidagi Telegram bot.

## Brend

| Element | Qiymat |
| --- | --- |
| Asosiy rang | `#0A7A3D` (logo yashili) |
| Aksent | `#F2C94C` (logo sarig'i) / matn uchun `#A9760A` |
| Uchinchi rang | `#16359E` (logodagi ko'k yozuv) |
| Shriftlar | Archivo Black (sarlavha), Montserrat (matn) |
| Logotip | `src/images/musa-mark.webp` (belgi), `public/favicon-*.png` |
| Hero rasm | `src/images/hero-products.webp` |

Kompaniya ma'lumotlari (telefon, email, Telegram, bot username) bitta joyda:
[`src/config/brand.ts`](src/config/brand.ts). Bot tomonida — `bot/config.py`.

Ranglar `src/styles.css` dagi CSS o'zgaruvchilarida. Komponentlarda hex
yozilmaydi — faqat `var(--brand)` kabi tokenlar, shu tufayli qorong'i rejim
bitta blokda hal bo'ladi.

> Firebase loyihasi — `musa-onlineshop`, bot — [@musauz_bot](https://t.me/musauz_bot),
> mini app — `https://musa-delivery.vercel.app`. Maxfiy qiymatlar (bot tokeni,
> service account JSON) git'ga tushmaydi — [`DEPLOY.md`](./DEPLOY.md) ga qarang.

## Tuzilma

- `src/pages` — ekranlar: bosh sahifa, katalog, profil, buyurtmalar, mahsulot detali.
- `src/components/brand` — logotip komponenti.
- `src/components` — qayta ishlatiluvchi layout, UI, mahsulot va buyurtma komponentlari.
- `src/config/brand.ts` — brend va aloqa konstantalari.
- `src/config/categories.ts` — uchta asosiy yo'nalish (bosh sahifadagi kartalar va katalog menyusi).
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
