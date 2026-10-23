/**
 * Konkurs: ishtirokchilar, do'st takliflari, tanlov va g'oliblarga xabar.
 *   node --experimental-strip-types --no-warnings --import ./scripts/testing/register.mjs ./scripts/testing/giveaway.test.ts
 */
export {}
const g = globalThis as any
const { giveawayConfirm, giveawayDraw, giveawayExclude, giveawayGet, giveawaySave, giveawayUndo } = await import('../../api/_lib/actions/giveaway.ts')

const failures: string[] = []
function check(name: string, cond: boolean, extra: unknown = '') {
  console.log((cond ? 'OK   ' : 'XATO ') + name + (cond ? '' : '  -> ' + JSON.stringify(extra).slice(0, 400)))
  if (!cond) failures.push(name)
}
const admin = { uid: 'a', email: 'a@musa.uz', name: 'Ega', role: 'owner', active: true } as any
const START = '2026-10-24T00:00:00.000Z'
const ev = (id: number, at: string, source = 'organic', isNewUser = false) => ({ telegramUserId: id, source, isNewUser, createdAt: at })

function seed() {
  g.__sent = []
  g.__blocked = [303]
  g.__data = {
    'users/101': { id: 101, first_name: 'Aziza', username: 'aziza', language: 'uz', lastActive: '2026-10-24' },
    'users/202': { id: 202, first_name: 'Bobur', language: 'ru', lastActive: '2026-10-24' },
    'users/303': { id: 303, first_name: 'Jasur', username: 'jasur' },
    'users/404': { id: 404, first_name: 'Do‘st1', lastActive: '2026-10-25' },
    'users/405': { id: 405, first_name: 'Do‘st2', visitCount: 2 },
    'users/406': { id: 406, first_name: 'Soxta' },
    'users/999': { id: 999, first_name: 'Eski' },
    // Konkursdan OLDIN — hisoblanmaydi
    'start_events/e0': ev(999, '2026-10-23T10:00:00.000+00:00'),
    'start_events/e1': ev(101, '2026-10-24T08:00:00.000+00:00', 'insta', true),
    'start_events/e2': ev(101, '2026-10-24T09:00:00.000+00:00'),
    'start_events/e3': ev(202, '2026-10-24T10:00:00.000+00:00', 'organic', false),
    'start_events/e4': ev(303, '2026-10-24T11:00:00.000+00:00', 'blog_food', true),
    // Aziza taklif qilgan: 2 ta haqiqiy yangi do'st, 1 ta mini app ochmagan
    'start_events/e5': ev(404, '2026-10-25T08:00:00.000+00:00', 'ref_101', true),
    'start_events/e6': ev(405, '2026-10-25T09:00:00.000+00:00', 'ref_101', true),
    'start_events/e7': ev(406, '2026-10-25T10:00:00.000+00:00', 'ref_101', true),
    // Eski foydalanuvchi taklif havolasidan kirgan — hisoblanmaydi
    'start_events/e8': ev(999, '2026-10-25T11:00:00.000+00:00', 'ref_101', false),
    // O'zini o'zi taklif — hisoblanmaydi
    'start_events/e9': ev(202, '2026-10-25T12:00:00.000+00:00', 'ref_202', true),
  }
}

seed()
let threw = ''
try { await giveawaySave(admin, { title: 'Konkurs', startAt: '' }) } catch (e) { threw = (e as Error).message }
check('boshlanish vaqtisiz saqlanmaydi', threw.includes('Boshlanish'))

await giveawaySave(admin, { title: 'MUSA konkursi', prize: 'Sog‘lom O‘quv Mavsumi seti', startAt: START, winners: 3, referral: { enabled: true, cap: 10 } })
check('mini app uchun ochiq qismi yozildi', g.__data['settings/giveaway']?.referral === true && g.__data['settings/giveaway']?.startAt === START)

let s = await giveawayGet()
const by = (id: string) => s.participants.find((p: any) => p.id === id)
check('konkursdan oldingi START hisoblanmadi', !by('999') || by('999').starts === 1, by('999'))
check('Aziza: 2 START, 2 ta haqiqiy taklif → 3 imkoniyat', by('101')?.starts === 2 && by('101')?.refs === 2 && by('101')?.tickets === 3, by('101'))
check('o‘zini taklif qilish hisoblanmadi', by('202')?.refs === 0 && by('202')?.tickets === 1, by('202'))
check('ism va @username', by('101')?.name === 'Aziza' && by('101')?.username === 'aziza')
check('ishtirokchilar soni (do‘stlar ham START bosgan)', s.stats.people === 7, s.stats)

// Taklif o'chirilsa — hamma 1 imkoniyat
await giveawaySave(admin, { title: 'MUSA konkursi', startAt: START, winners: 3, referral: { enabled: false, cap: 10 } })
s = await giveawayGet()
check('taklif o‘chiq — Aziza 1 imkoniyat', by('101')?.tickets === 1)
await giveawaySave(admin, { title: 'MUSA konkursi', prize: 'Sog‘lom O‘quv Mavsumi seti', startAt: START, winners: 3, referral: { enabled: true, cap: 1 } })
s = await giveawayGet()
check('chegara 1 — Aziza 2 imkoniyat', by('101')?.tickets === 2)

// Chiqarish
await giveawayExclude(admin, { id: '406' })
s = await giveawayGet()
check('chiqarilgan ishtirokchi belgilandi', by('406')?.excluded === true && s.stats.people === 6)

// Tanlov: takrorlanmaydi, chiqarilgan tanlanmaydi
const winners = new Set<string>()
for (let i = 0; i < 3; i++) {
  const r = await giveawayDraw(admin)
  winners.add(r.winner.id)
  check(`${i + 1}-g‘olib barabanda bor`, r.wheel.some((w: any) => w.id === r.winner.id) && r.number === i + 1)
}
check('3 ta turli g‘olib, chiqarilgani yo‘q', winners.size === 3 && !winners.has('406'), [...winners])
threw = ''
try { await giveawayDraw(admin) } catch (e) { threw = (e as Error).message }
check('g‘oliblar soni to‘lgach yana tanlanmaydi', threw.includes('aniqlandi'), threw)
await giveawayUndo()
s = await giveawayGet()
check('oxirgisini bekor qilish', s.draws.length === 2)
await giveawayDraw(admin)

// Adolat: 2000 marta — 2 imkoniyatli odam ~2 barobar ko'p tanlanadi
g.__data['giveaways/current'].config.winners = 1
let aziza = 0, bobur = 0
for (let i = 0; i < 2000; i++) {
  g.__data['giveaways/current'].draws = []
  const r = await giveawayDraw(admin)
  if (r.winner.id === '101') aziza++
  if (r.winner.id === '202') bobur++
}
check('ehtimol imkoniyatga mutanosib (Aziza ≈ 2× Bobur)', aziza / bobur > 1.6 && aziza / bobur < 2.5, { aziza, bobur })
g.__data['giveaways/current'].config.winners = 3
g.__data['giveaways/current'].draws = [
  { id: '101', name: 'Aziza', username: 'aziza', tickets: 2, at: 'x', by: 'Ega' },
  { id: '202', name: 'Bobur', username: null, tickets: 1, at: 'x', by: 'Ega' },
  { id: '303', name: 'Jasur', username: 'jasur', tickets: 1, at: 'x', by: 'Ega' },
]

// Tasdiqlash
const c = await giveawayConfirm(admin)
const msgs = g.__sent.filter((m: any) => m.kind === 'message')
check('2 ta xabar ketdi, bloklagan 1 ta — xato', c.sent === 2 && c.failed === 1, c)
check('o‘zbekcha xabar ism va sovg‘a bilan', msgs.find((m: any) => m.chatId === 101)?.text.includes('Tabriklaymiz, Aziza') && msgs.find((m: any) => m.chatId === 101)?.text.includes('Sog‘lom O‘quv Mavsumi seti'))
check('ruscha foydalanuvchiga ruscha', msgs.find((m: any) => m.chatId === 202)?.text.includes('Поздравляем'))
threw = ''
try { await giveawayConfirm(admin) } catch (e) { threw = (e as Error).message }
check('ikkinchi marta yuborilmaydi', threw.includes('allaqachon') && g.__sent.filter((m: any) => m.kind === 'message').length === 2)
check('mini app kartasi yopildi', g.__data['settings/giveaway']?.finished === true)
threw = ''
try { await giveawayDraw(admin) } catch (e) { threw = (e as Error).message }
check('tasdiqlangandan keyin tanlov yo‘q', threw.includes('yakunlangan'))

console.log('\nNATIJA:', failures.length ? `${failures.length} ta xato` : 'hammasi joyida')
process.exit(failures.length ? 1 : 0)
