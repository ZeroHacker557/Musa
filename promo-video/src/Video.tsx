import { HEIGHT, WIDTH } from './anim'
import { Flash } from './components'
import { FrameProvider, Seq } from './frame'
import { Hook } from './scenes/Hook'
import { Brand } from './scenes/Brand'
import { Products } from './scenes/Products'
import { Sets } from './scenes/Sets'
import { Features } from './scenes/Features'
import { Cta } from './scenes/Cta'

/**
 * 40 soniyalik kompozitsiya (30 kadr/s, 120 BPM — bir takt 60 kadr).
 *
 *   0–4 s    Ilmoq: «Kechki ovqatga hech narsa yo‘qmi?» → muz yoriladi
 *   4–8 s    MUSA logotipi va shior
 *   8–16 s   Mahsulotlar karuseli → 150+ mahsulot
 *   16–24 s  Setlar: yig'iladi, narx tushadi, tejash muhri
 *   24–34 s  Qulayliklar telefonda: Telegram · to'lov · kuryer · yetkazildi
 *   34–40 s  @musauz_bot va QR
 *
 * Sahnalar bir-birining ustiga chiqadi (keyingisi yuqorida) — o'tishlar
 * silliq bo'lsin. Ovoz effektlari vaqtlari: src/cues.json.
 */
export function Video({ frame }: { frame: number }) {
  return (
    <FrameProvider frame={frame}>
      <div style={{ position: 'relative', width: WIDTH, height: HEIGHT, overflow: 'hidden', background: '#06182e' }}>
        <Seq from={0} duration={122} z={1}><Hook /></Seq>
        {/* Har sahna keyingisining o'tishi tugaguncha ostida turadi — qora tirqish chiqmasin */}
        <Seq from={120} duration={140} z={2}><Brand /></Seq>
        <Seq from={240} duration={262} z={3}><Products /></Seq>
        <Seq from={480} duration={246} z={4}><Sets /></Seq>
        <Seq from={712} duration={310} z={5}><Features /></Seq>
        <Seq from={1020} duration={180} z={6}><Cta /></Seq>
        <Flash from={104} peak={118} to={136} />
      </div>
    </FrameProvider>
  )
}
