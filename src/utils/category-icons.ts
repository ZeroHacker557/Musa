import {
  Beef, Cake, Carrot, ChefHat, CookingPot, Croissant, Drumstick, Egg,
  Fish, Grid2X2, Ham, IceCreamCone, Package, Pizza, Salad, Sandwich,
  Snowflake, Soup, Vegan, Wheat,
  type LucideIcon,
} from 'lucide-react'

/**
 * Kategoriya ikonkasi.
 *
 * Avval bazadagi `icon` maydoniga qaraydi (admin tanlagan), topilmasa
 * nom bo'yicha taxmin qiladi, u ham bo'lmasa umumiy qozon ishlatiladi.
 * Ilgari faqat oldindan yozilgan nomlar bilan solishtirilardi, shuning
 * uchun har qanday yangi kategoriya doim quti bo'lib qolardi (F-17).
 *
 * Ro'yxat MUSA assortimentiga moslangan: muzlatilgan yarim tayyor
 * mahsulotlar — chuchvara, manti, somsa, kotlet, naggets va h.k.
 */
const BY_KEY: Record<string, LucideIcon> = {
  all: Grid2X2,

  // Xamirli mahsulotlar
  dumpling: Soup,
  chuchvara: Soup,
  pelmeni: Soup,
  manti: CookingPot,
  somsa: Croissant,
  samsa: Croissant,
  hanum: CookingPot,
  xamir: Wheat,
  dough: Wheat,
  lagmon: Soup,
  ugra: Wheat,

  // Go'shtli mahsulotlar
  meat: Beef,
  gosht: Beef,
  beef: Beef,
  mol: Beef,
  chicken: Drumstick,
  tovuq: Drumstick,
  nugget: Drumstick,
  kotlet: Ham,
  cutlet: Ham,
  lulya: Ham,
  kabob: Ham,
  sausage: Ham,
  hotdog: Sandwich,
  burger: Sandwich,
  pizza: Pizza,

  // Boshqa
  fish: Fish,
  baliq: Fish,
  egg: Egg,
  tuxum: Egg,
  vegetable: Carrot,
  sabzavot: Carrot,
  salad: Salad,
  vegan: Vegan,
  dessert: Cake,
  shirinlik: Cake,
  muzqaymoq: IceCreamCone,
  frozen: Snowflake,
  muzlatilgan: Snowflake,
  set: ChefHat,
  box: Package,
}

const BY_NAME: [RegExp, LucideIcon][] = [
  [/chuchvara|pelmen|dumpling|пельмен|чучвар/i, Soup],
  [/manti|hanum|xonim|мант|ханум/i, CookingPot],
  [/somsa|samsa|самс/i, Croissant],
  [/lagʻmon|lagmon|ugra|лагман/i, Soup],
  [/xamir|dough|тест/i, Wheat],
  [/kotlet|lyulya|lʻulya|kabob|kolbasa|sosiska|котлет|люля|колбас|сосис/i, Ham],
  [/tovuq|nagget|nugget|chicken|товук|кур|наггет/i, Drumstick],
  [/goʻsht|gosht|mol|qoʻy|beef|meat|мяс|говяд/i, Beef],
  [/baliq|fish|рыб/i, Fish],
  [/burger|sendvich|hot ?dog|бургер|сэндвич/i, Sandwich],
  [/pitsa|pizza|пицц/i, Pizza],
  [/tuxum|egg|яйц/i, Egg],
  [/sabzavot|vegetable|овощ/i, Carrot],
  [/salat|salad|салат/i, Salad],
  [/shirinlik|dessert|tort|десерт|торт/i, Cake],
  [/muzqaymoq|morojen|морожен/i, IceCreamCone],
  [/muzlatilgan|frozen|заморож/i, Snowflake],
  [/toʻplam|set|combo|набор/i, ChefHat],
  [/barcha|hamma|все|all/i, Grid2X2],
]

/**
 * Bot yangi kategoriyaga doim "package" yozadi — bu "tanlanmagan" degani.
 * Shuning uchun uni e'tiborsiz qoldirib, nom bo'yicha aniqlashga o'tamiz.
 */
const UNSET_ICONS = new Set(['', 'package', 'Package'])

export function categoryIcon(icon?: string, name?: string): LucideIcon {
  if (icon && !UNSET_ICONS.has(icon.trim())) {
    const found = BY_KEY[icon.toLowerCase().trim()]
    if (found) return found
  }
  if (name) {
    for (const [pattern, Icon] of BY_NAME) {
      if (pattern.test(name)) return Icon
    }
  }
  return CookingPot
}
