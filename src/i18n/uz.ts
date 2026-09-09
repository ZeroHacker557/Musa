/**
 * O'zbekcha lug'at — asosiy (source of truth).
 * Boshqa tillar shu kalitlar to'plamiga amal qiladi.
 *
 * Matnlar MUSA — muzlatilgan mahsulotlar do'koni uchun yozilgan:
 * yarim tayyor mahsulotlar, muzqaymoq va siroklar. "O'lcham"
 * o'rniga vazn (gramm/kg), "rang" o'rniga mahsulot turi ishlatiladi.
 */
export const uz = {
  // ── Umumiy ──
  'common.currency': "so'm",
  'common.all': 'Barchasi',
  'common.cancel': 'Bekor qilish',
  'common.save': 'Saqlash',
  'common.saving': 'Saqlanmoqda...',
  'common.back': 'Orqaga',
  'common.loading': 'Yuklanmoqda...',
  'common.retry': 'Qayta urinish',
  'common.close': 'Yopish',
  'common.pcs': 'dona',
  'common.soon': 'tez orada!',
  'common.optional': 'ixtiyoriy',
  'common.required': 'majburiy',

  // ── Brend ──
  'brand.tagline': 'Muzlatilgan mahsulotlar',
  'brand.slogan': "Uydagidek ta'm — tez va oson",

  // ── Navigatsiya ──
  'nav.home': 'Bosh sahifa',
  'nav.catalog': 'Katalog',
  'nav.favorites': 'Sevimlilar',
  'nav.orders': 'Buyurtmalar',
  'nav.profile': 'Profil',

  // ── Bosh sahifa ──
  'home.searchPlaceholder': 'Mahsulot yoki turkum qidiring...',
  'home.heroBadge': 'Yangi va sifatli',
  'home.heroTitle': "Uydagidek ta'm — bir necha daqiqada",
  'home.heroSubtitle': 'Yarim tayyor mahsulotlar, muzqaymoq va siroklar.',
  'home.heroCta': 'Buyurtma berish',
  'home.lines': "Yo'nalishlar",
  'home.popular': 'Mashhur mahsulotlar',
  'home.seeAll': "Barchasini ko'rish",
  'home.emptyTitle': 'Mahsulotlar tez orada!',
  'home.emptyText': "Admin mahsulot qo'shganda shu yerda ko'rinadi.",

  'benefit.delivery': 'Tez yetkazish',
  'benefit.deliverySub': "Toshkent bo'ylab 24 soat",
  'benefit.payment': "Xavfsiz to'lov",
  'benefit.paymentSub': 'Naqd yoki karta',
  'benefit.support': '24/7 aloqa',
  'benefit.supportSub': 'Har doim siz bilan',
  'benefit.natural': 'Tabiiy tarkib',
  'benefit.naturalSub': "Sun'iy qo'shimchalarsiz",

  // ── Katalog ──
  'catalog.title': 'Mahsulotlar katalogi',
  'catalog.filters': 'Filtrlar',
  'catalog.sortCheap': 'Arzon narx',
  'catalog.sortExpensive': 'Qimmat narx',
  'catalog.total': 'Jami {count} ta mahsulot',
  'catalog.emptyCategory': 'Bu turkumda mahsulot topilmadi',
  'catalog.emptyCategoryText': 'Boshqa turkumni tanlang.',
  'catalog.filterSummary': 'Turkum: {category} • Narx: {sort}',
  'catalog.sortAsc': 'arzondan qimmatga',
  'catalog.sortDesc': 'qimmatdan arzonga',
  'catalog.priceRange': 'Narx oralig‘i',
  'catalog.priceFrom': 'dan',
  'catalog.priceTo': 'gacha',
  'catalog.size': 'Vazn',
  'catalog.color': 'Turi',
  'catalog.inStockOnly': 'Faqat sotuvdagilar',
  'catalog.reset': 'Tozalash',
  'catalog.apply': "Qo'llash",
  'catalog.activeFilters': '{count} ta filtr',
  'catalog.loadMore': 'Ko‘proq ko‘rsatish',
  'catalog.showing': '{shown} / {total}',

  // ── Mahsulot ──
  'product.title': 'Mahsulot',
  'product.fastDelivery': 'Muzlatilgan holda yetkaziladi',
  'product.chooseColor': 'Turini tanlang',
  'product.chooseSize': 'Vaznni tanlang',
  'product.about': 'Mahsulot haqida',
  'product.addToCart': "Savatchaga qo'shish",
  'product.soldOut': "Sotuvda yo'q",
  'product.soldOutLong': "Hozircha sotuvda yo'q",
  'product.lowStock': 'Omborda {count} dona qoldi',
  'product.ratingCount': '{count} ta baho',
  'product.addedToCart': "{name} savatga qo'shildi",

  // ── Sharhlar ──
  'reviews.title': 'Sharhlar',
  'reviews.rateThis': 'Mahsulotni baholang:',
  'reviews.placeholder': "O'z fikringizni yozib qoldiring...",
  'reviews.submit': 'Sharh qoldirish',
  'reviews.submitting': 'Yuborilmoqda...',
  'reviews.empty': "Hozircha sharhlar yo'q. Birinchi bo'lib baholang!",
  'reviews.needRating': 'Iltimos, yulduzchalar orqali baholang',
  'reviews.error': 'Xatolik yuz berdi',
  'reviews.notPurchased': 'Sharh qoldirish uchun avval mahsulotni sotib olishingiz kerak',
  'reviews.alreadyLeft': 'Siz bu mahsulotga sharh qoldirgansiz',
  'reviews.thanks': 'Sharhingiz uchun rahmat!',
  'reviews.myTitle': 'Mening sharhlarim',
  'reviews.myEmpty': "Sharhlar yo'q",
  'reviews.myEmptyText': 'Siz hali birorta mahsulotga sharh qoldirmagansiz.',
  'reviews.productId': 'Mahsulot ID: {id}',

  // ── Savat ──
  'cart.title': 'Savatcha',
  'cart.kinds': '{count} xil mahsulot',
  'cart.empty': "Savatchangiz bo'sh",
  'cart.emptyText': 'Yoqtirgan mahsulotlaringizni tanlang.',
  'cart.total': 'Jami',
  'cart.checkout': 'Buyurtma berish',
  'cart.size': 'Vazn',
  'cart.color': 'Turi',
  'cart.goToCatalog': "Mahsulotlarni ko‘rish",

  // ── Qidiruv ──
  'search.placeholder': 'Qidirish...',
  'search.results': '"{query}" bo‘yicha natijalar',
  'search.title': 'Qidiruv',
  'search.notFound': 'Hech narsa topilmadi',
  'search.notFoundText': "Boshqa kalit so'z bilan qidirib ko'ring.",

  // ── Rasmiylashtirish ──
  'checkout.title': 'Buyurtma berish',
  'checkout.summary': 'Buyurtma ({count} dona)',
  'checkout.promoPlaceholder': "Promokod (agar bo'lsa)",
  'checkout.promoApply': "Qo'llash",
  'checkout.promoClear': 'Bekor q.',
  'checkout.promoApplied': 'Kiritildi: {percent}% chegirma!',
  'checkout.products': 'Mahsulotlar',
  'checkout.discount': 'Chegirma',
  'checkout.delivery': 'Yetkazib berish',
  'checkout.deliveryFree': 'Bepul',
  'checkout.freeFrom': '{amount}dan yuqori buyurtmalar bepul yetkaziladi',
  'checkout.total': 'Jami:',
  'checkout.deliveryInfo': 'Yetkazib berish ma’lumotlari',
  'checkout.name': 'Ismingiz',
  'checkout.namePlaceholder': "To'liq ismingizni kiriting",
  'checkout.phone': 'Telefon raqam',
  'checkout.address': 'Yetkazish manzili',
  'checkout.noAddresses': "Sizda hali saqlangan manzillar yo'q",
  'checkout.addAddress': "+ Yangi manzil qo'shish",
  'checkout.addAnotherAddress': "+ Boshqa manzil qo'shish",
  'checkout.comment': 'Izoh',
  'checkout.commentPlaceholder': "Qo'shimcha izoh...",
  'checkout.paymentMethod': "To'lov usuli",
  'checkout.cash': 'Naqd pul',
  'checkout.cashSub': 'Yetkazganda',
  'checkout.card': 'Karta',
  'checkout.cardSub': "O'tkazma",
  'checkout.cardDetails': "Karta ma'lumotlari:",
  'checkout.cardNumber': 'Karta raqami',
  'checkout.cardNote':
    "Formani to'ldirganingizdan so'ng bot orqali sizga xabar keladi. To'lov chekini botga yuboring, admin tekshirib tasdiqlaydi.",
  'checkout.submit': 'Buyurtma berish',
  'checkout.submitting': 'Yuborilmoqda...',
  'checkout.disclaimer':
    "Buyurtma berish tugmasini bosganingizda, ma'lumotlaringiz MUSA savdo bo'limiga yuboriladi.",
  'checkout.fillAll': "Iltimos, barcha maydonlarni to'ldiring",
  'checkout.cartEmpty': "Savatingiz bo'sh",
  'checkout.failed': "Buyurtma yuborilmadi. Internetni tekshirib, qayta urinib ko'ring",
  'checkout.success': 'Buyurtma muvaffaqiyatli berildi!',
  'checkout.successTitle': 'Buyurtma qabul qilindi!',
  'checkout.successText':
    "Buyurtmangiz MUSA omboriga tushdi. Tez orada operatorimiz siz bilan bog'lanadi.",
  'checkout.viewOrders': "Buyurtmalarimni ko'rish",

  // ── Buyurtmalar ──
  'orders.title': 'Buyurtmalarim',
  'orders.newest': 'Eng yangi',
  'orders.oldest': 'Eng eski',
  'orders.details': 'Tafsilotlar',
  'orders.hide': 'Yashirish',
  'orders.itemCount': '{count} dona',
  'orders.empty': "Buyurtmalar hali yo'q",
  'orders.emptyText': 'Birinchi buyurtmangizni bering!',
  'orders.emptyFilter': "Bu bo'limda buyurtma topilmadi",
  'orders.emptyFilterText': "Boshqa bo'limni tanlang.",
  'orders.authFailed': "Buyurtmalarni ko'rsatib bo'lmadi",
  'orders.authFailedText':
    "Hisobingizga ulanib bo'lmadi. Buyurtmalaringiz saqlanib turibdi — ilovani yopib, Telegram orqali qaytadan oching.",
  'orders.paid': "To'landi",
  'orders.sendReceipt': "To'lov chekini yuborish",
  'orders.resendReceipt': 'Qayta chek yuborish',
  'orders.tabAll': 'Barchasi',
  'orders.tabNew': 'Yangi',
  'orders.tabAccepted': 'Qabul qilindi',
  'orders.tabCancelled': 'Bekor qilingan',
  'orders.cancel': 'Buyurtmani bekor qilish',
  'orders.cancelling': 'Bekor qilinmoqda...',
  'orders.cancelConfirm': "Buyurtmani bekor qilasizmi? Bu amalni ortga qaytarib bo'lmaydi.",
  'orders.cancelled': 'Buyurtma bekor qilindi',

  'status.Yangi': 'Yangi',
  'status.Qabul qilindi': 'Qabul qilindi',
  'status.Yetkazilmoqda': 'Yetkazilmoqda',
  'status.Yetkazildi': 'Yetkazildi',
  'status.Bekor qilingan': 'Bekor qilingan',
  'status.Rad etildi': 'Rad etildi',

  // ── Sevimlilar ──
  'favorites.title': 'Sevimlilar',
  'favorites.empty': "Sevimli mahsulotlar hali yo'q",
  'favorites.emptyText': "Yoqtirgan mahsulotlaringizni ❤️ tugmasi bilan qo'shing.",

  // ── Profil ──
  'profile.title': 'Profil',
  'profile.connected': 'Telegram orqali ulangan',
  'profile.statOrders': 'Buyurtmalar',
  'profile.statActive': 'Faol',
  'profile.statDone': 'Bajarilgan',
  'profile.lastOrder': 'Oxirgi buyurtma',
  'profile.account': 'Hisob',
  'profile.personal': "Shaxsiy ma'lumotlar",
  'profile.personalSub': 'Ismingiz va raqamingiz',
  'profile.addresses': 'Yetkazib berish manzillarim',
  'profile.addressesSub': 'Saqlangan manzillar',
  'profile.history': 'Buyurtmalar tarixi',
  'profile.historySub': 'Barcha buyurtmalar',
  'profile.reviews': 'Baholash va sharhlar',
  'profile.reviewsSub': 'Siz qoldirgan baholar',
  'profile.theme': "Ko'rinish",
  'profile.themeSub': "Yorug' yoki qorong'i rejim",
  'theme.light': "Yorug'",
  'theme.dark': "Qorong'i",
  'profile.language': 'Til',
  'profile.languageSub': "Ilova tilini o'zgartirish",
  'profile.help': "Yordam va qo'llab-quvvatlash",
  'profile.helpSub': 'Savollar va javoblar',
  'profile.firstName': 'Ismingiz',
  'profile.lastName': 'Familiyangiz',
  'profile.phone': 'Telefon raqamingiz',
  'profile.saved': "Ma'lumotlar muvaffaqiyatli saqlandi!",
  'profile.nameRequired': 'Ism va telefon raqamini kiritish majburiy',
  'profile.userNotFound': 'Telegram foydalanuvchisi topilmadi',

  // ── Til ──
  'language.title': 'Tilni tanlang',
  'language.uz': "O'zbekcha",
  'language.ru': 'Ruscha',
  'language.changed': "Til o'zgartirildi",

  // ── Manzillar ──
  'address.title': 'Mening manzillarim',
  'address.new': 'Yangi manzil',
  'address.name': 'Manzil nomi',
  'address.namePlaceholder': 'Masalan: Uy, Ishxona',
  'address.full': "To'liq manzil",
  'address.fullPlaceholder': "Ko'cha, uy raqami, mo'ljal",
  'address.pickOnMap': 'Xaritadan tanlang',
  'address.mapHint': 'Xarita ustiga bosib manzilni belgilang',
  'address.empty': "Manzillar yo'q",
  'address.emptyText': "Siz hali yetkazib berish manzilini qo'shmagansiz",
  'address.add': "Yangi manzil qo'shish",
  'address.saved': 'Manzil saqlandi!',
  'address.deleted': "Manzil o'chirildi",
  'address.fillAll': "Iltimos, barcha maydonlarni to'ldiring va xaritadan joy tanlang",
  'address.myLocation': 'Qayerdaman',
  'address.locationFailed': "Lokatsiyani aniqlab bo'lmadi. Xaritadan qo'lda belgilang.",
  'address.locationDenied':
    "Lokatsiyaga ruxsat berilmagan. Telegram sozlamalaridan ruxsat bering yoki xaritadan qo'lda belgilang.",
  'address.locationTimeout':
    "Lokatsiya aniqlanmadi — signal zaif bo'lishi mumkin. Qayta urinib ko'ring yoki xaritadan belgilang.",

  // ── Bildirishnomalar ──
  'notifications.title': 'Bildirishnomalar',
  'notifications.empty': "Bildirishnomalar yo'q",
  'notifications.emptyText': 'Hozircha sizga hech qanday xabar kelmagan.',

  // ── Xatolar ──
  'error.notSignedIn':
    "Hisobingizga ulanib bo'lmadi. Ilovani yopib, bot orqali qaytadan oching.",
  'error.saveFailed': "Saqlab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.",

  // ── Telegram to'sig'i ──
  'gate.title': 'Telegram orqali oching',
  'gate.text':
    "MUSA do'koni Telegram ilovasi ichida ishlaydi. Buyurtma berish uchun botni oching va «Katalogni ochish» tugmasini bosing.",
  'gate.button': "Telegram'da ochish",
} as const

export type TranslationKey = keyof typeof uz
