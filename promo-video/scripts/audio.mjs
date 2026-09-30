/**
 * Musiqa va ovoz effektlarini SINTEZ qiladi — tashqi fayl yo'q, mualliflik
 * huquqi muammosi yo'q.
 *
 *   node scripts/audio.mjs  →  public/audio/music.wav, sfx.wav, mix.wav
 *
 * Musiqa: 120 BPM, C major, C–G–Am–F. Takt = 2 s (video 60 kadr).
 *   0–4 s   sirli boshlanish (Am, puls, riser)
 *   4–8 s   logotip: yorqin pad + arpedjio, 8 s ga «drop» tayyorlanadi
 *   8–24 s  to'liq groove: kick, clap, hat, bas, pad, pluck, melodiya
 *   24–34 s groove davom etadi, 32–34 s pauza va riser
 *   34–38 s yakuniy qism: akkord stablar
 *   38 s    yakuniy akkord, dum (reverb) bilan tugaydi
 * Ovoz effektlari vaqti: src/cues.json (kadr raqami bilan).
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  BAR, BEAT, CHORDS, LEAD, N, PROG, S16, SFX, SR, bass, bell, buf, clap, crash, delay, hat, kick,
  master, mixInto, n, pad, pluck, reverb, riser, setLength, sub, writeWav,
} from './synth.mjs'

setLength(40)
const ROOT = resolve(import.meta.dirname, '..')

function music() {
  const drums = buf()
  const bassB = buf()
  const padB = buf()
  const plk = buf()
  const lead = buf()
  const fx = buf()
  const kicks = []
  const bar = (b) => b * BAR

  // 0–4 s: sirli boshlanish
  pad(padB, 0, 4, [n('A2'), n('E3'), n('A3'), n('C4')], 0.9, 520)
  for (let b = 0; b < 8; b++) {
    kick(drums, b * BEAT, 0.35)
    kicks.push(b * BEAT)
  }
  for (let s = 0; s < 16; s++) hat(drums, s * BEAT / 2 + BEAT / 2, 0.25)
  riser(fx, 2.2, 1.8, 0.7)

  // 4 s: urg'u
  crash(drums, 4, 0.9)
  sub(bassB, 4, 0.9)
  // 4–8 s: yorqin logotip qismi
  ;[['C', 2], ['F', 3]].forEach(([c, b]) => {
    pad(padB, bar(b), BAR, CHORDS[c].notes.map(n), 1.0, 1800)
    // Cho'zilgan g'o'ng'illash emas — chorak notalar bilan yengil puls
    for (let q = 0; q < 4; q++) bass(bassB, bar(b) + q * BEAT, BEAT * 0.7, n(CHORDS[c].bass), 0.4)
  })
  for (let s = 0; s < 32; s++) {
    const t = 4 + s * S16
    const c = s < 16 ? 'C' : 'F'
    const notes = CHORDS[c].notes
    pluck(plk, t, n(notes[s % 4].replace(/\d/, (d) => String(Number(d) + 1))) * 1, 0.55 + 0.3 * (s / 32), s % 2 ? 0.4 : -0.4)
  }
  for (let b = 0; b < 8; b++) { hat(drums, 4 + b * BEAT + BEAT / 2, 0.35) }
  kick(drums, 4, 0.8); kicks.push(4)
  kick(drums, 6, 0.7); kicks.push(6)
  riser(fx, 6, 2, 0.9)
  for (let k = 0; k < 8; k++) clap(drums, 7 + k * (BEAT / 4), 0.25 + k * 0.06)

  // 8–38 s: groove
  for (let b = 4; b < 19; b++) {
    const c = PROG[(b - 4) % 4]
    const t = bar(b)
    const build = b === 16 // 32–34 s: nafas olish, riser
    const cta = b >= 17
    pad(padB, t, BAR, CHORDS[c].notes.map(n), cta ? 1.0 : 0.85, cta ? 2600 : 2000)
    for (let e = 0; e < 8; e++) {
      if (build && e >= 4) continue
      const oct = e % 4 === 3 ? 2 : 1
      bass(bassB, t + e * (BEAT / 2), BEAT / 2 * 0.9, n(CHORDS[c].bass) * oct, 0.75)
    }
    for (let q = 0; q < 4; q++) {
      if (build && q >= 2) continue
      kick(drums, t + q * BEAT, 1)
      kicks.push(t + q * BEAT)
      if (q % 2 === 1) clap(drums, t + q * BEAT, 0.8)
      hat(drums, t + q * BEAT + BEAT / 2, 0.55, q === 3 && b % 2 === 1)
      hat(drums, t + q * BEAT + BEAT / 4, 0.18)
      hat(drums, t + q * BEAT + (3 * BEAT) / 4, 0.22)
    }
    // Pluck arpedjio (sinkopali)
    for (const [k, s] of [0, 3, 6, 8, 11, 14].entries()) {
      const note = CHORDS[c].notes[k % 4].replace(/\d/, (d) => String(Number(d) + 1))
      pluck(plk, t + s * S16, n(note), 0.55, k % 2 ? 0.35 : -0.35)
    }
    // Melodiya — 16–24 s va yakuniy qismda
    if ((b >= 8 && b < 12) || cta) {
      for (const [s, note, l] of LEAD[c]) bell(lead, t + s * S16, n(note), 0.9, Math.max(0.35, l * S16 * 1.6), 0.1)
    }
    if (cta) for (const s of [2, 6, 10, 14]) pad(padB, t + s * S16, S16 * 1.2, CHORDS[c].notes.map((x) => n(x) * 2), 0.5, 4000)
    if (b === 11) for (let k = 0; k < 8; k++) clap(drums, t + BAR - BEAT + k * S16 / 2, 0.2 + k * 0.05)
  }
  riser(fx, 32, 2, 1)
  crash(drums, 8, 0.8)
  crash(drums, 24, 0.7)
  crash(drums, 34, 0.9)
  sub(bassB, 8, 0.8)
  sub(bassB, 34, 0.9)

  // 38 s: yakuniy akkord
  pad(padB, 38, 1.6, [...CHORDS.C.notes, 'G5', 'C6'].map(n), 1.3, 3200)
  for (const [i, note] of ['C5', 'E5', 'G5', 'C6'].entries()) bell(lead, 38 + i * 0.03, n(note), 0.9, 1.4, i % 2 ? 0.3 : -0.3)
  kick(drums, 38, 1.1); kicks.push(38)
  crash(drums, 38, 1)
  sub(bassB, 38, 1, 2)
  bass(bassB, 38, 1.2, n('C2'), 0.8)

  // Sidechain: kick'da pad va bas pasayadi (nafas oluvchi «pompa»)
  const duck = new Float32Array(N).fill(1)
  for (const kt of kicks) {
    const k0 = Math.round(kt * SR)
    for (let i = 0; i < SR * 0.3 && k0 + i < N; i++) duck[k0 + i] = Math.min(duck[k0 + i], 1 - 0.6 * Math.exp(-i / (SR * 0.08)))
  }
  for (const b of [padB, bassB, plk]) for (let c = 0; c < 2; c++) for (let k = 0; k < N; k++) b[c][k] *= b === bassB ? 0.5 + 0.5 * duck[k] : duck[k]

  const mix = buf()
  mixInto(mix, drums, 0.9)
  mixInto(mix, bassB, 0.9)
  mixInto(mix, padB, 0.8)
  mixInto(mix, plk, 0.55)
  mixInto(mix, lead, 0.7)
  mixInto(mix, fx, 0.6)
  const send = buf()
  mixInto(send, padB, 0.5)
  mixInto(send, plk, 0.6)
  mixInto(send, lead, 0.8)
  mixInto(send, drums, 0.08)
  mixInto(mix, reverb(send, { wet: 0.9 }), 1)
  mixInto(mix, delay(buf2(plk, lead), BEAT * 0.75, 0.38, 0.32), 1)
  return mix
}
function buf2(a, b) { const o = buf(); mixInto(o, a, 1); mixInto(o, b, 0.7); return o }

function sfx() {
  const cues = JSON.parse(readFileSync(join(ROOT, 'src', 'cues.json'), 'utf8'))
  const out = buf()
  for (const c of cues) {
    const fn = SFX[c.s]
    if (!fn) throw new Error(`Noma'lum effekt: ${c.s}`)
    fn(out, c.f / 30, c.g ?? 0.5, c)
  }
  const wet = reverb(out, { room: 0.7, wet: 0.35 })
  mixInto(out, wet, 1)
  return out
}

const t0 = Date.now()
const dir = join(ROOT, 'public', 'audio')
mkdirSync(dir, { recursive: true })
const m = music()
console.log('musiqa tayyor', ((Date.now() - t0) / 1000).toFixed(1), 's')
const s = sfx()
console.log('effektlar tayyor', ((Date.now() - t0) / 1000).toFixed(1), 's')

const musicOnly = master(m.map((ch) => ch.slice()), 0.85)
const sfxOnly = master(s.map((ch) => ch.slice()), 0.85)
writeWav(join(dir, 'music.wav'), musicOnly)
writeWav(join(dir, 'sfx.wav'), sfxOnly)
// Aralashma: musiqa zich (RMS baland), effektlar siyrak — cho'qqilari teng
// bo'lsa effektlar musiqa ustida aniq eshitiladi
const mix = buf()
mixInto(mix, musicOnly, 0.6)
mixInto(mix, sfxOnly, 0.62)
writeWav(join(dir, 'mix.wav'), master(mix, 0.93))
console.log('Tayyor:', dir, ((Date.now() - t0) / 1000).toFixed(1), 's')
