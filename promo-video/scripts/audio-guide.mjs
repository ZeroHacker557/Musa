/**
 * Qo'llanma video ovozi: diktor + yengil musiqa + effektlar.
 *
 *   node scripts/audio-guide.mjs <diktor.mp3>
 *     → public/audio/guide-voice.wav, guide-music.wav, guide-sfx.wav, guide-mix.wav
 *
 * Musiqa va effektlar sintez (tashqi fayl yo'q). Diktor gapirganda musiqa
 * pasayadi (ffmpeg sidechaincompress). Effekt vaqtlari src/guide/timeline.ts,
 * tg.tsx va app.tsx dagi soniyalar bilan bir xil.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  BAR, BEAT, CHORDS, N, S16, SFX, SR, bass, bell, buf, clap, crash, delay, hat, kick,
  master, mixInto, n, pad, pluck, reverb, riser, setLength, sub, writeWav,
} from './synth.mjs'

const LENGTH = 73
setLength(LENGTH)
const ROOT = resolve(import.meta.dirname, '..')
const dir = join(ROOT, 'public', 'audio')
mkdirSync(dir, { recursive: true })

// Diktor: `--voice sardor` — vaqtlar Zilola bo'yicha yozilgan, src/guide/voices.json bilan suriladi
const argv = process.argv.slice(2)
const vi = argv.indexOf('--voice')
const VOICE = vi >= 0 ? argv.splice(vi, 2)[1] : 'zilola'
const ANCHORS = JSON.parse(readFileSync(join(ROOT, 'src', 'guide', 'voices.json'), 'utf8'))[VOICE]?.anchors
if (!ANCHORS) throw new Error(`Noma'lum diktor: ${VOICE}`)
const SUF = VOICE === 'zilola' ? '' : `-${VOICE}`
function warp(x) {
  if (!ANCHORS.length) return x
  if (x <= ANCHORS[0][0]) return x + ANCHORS[0][1] - ANCHORS[0][0]
  for (let i = 1; i < ANCHORS.length; i++) {
    const [a0, b0] = ANCHORS[i - 1]
    const [a1, b1] = ANCHORS[i]
    if (x <= a1) return a1 === a0 ? b1 : b0 + ((x - a0) * (b1 - b0)) / (a1 - a0)
  }
  return x + ANCHORS[ANCHORS.length - 1][1] - ANCHORS[ANCHORS.length - 1][0]
}

const PROG = ['C', 'G', 'Am', 'F']
const HOOK_END = warp(4.85)
const CTA = warp(65.9)
const FINAL = warp(71.35)

function music() {
  const drums = buf()
  const bassB = buf()
  const padB = buf()
  const plk = buf()
  const lead = buf()
  const fx = buf()
  const kicks = []

  // Kirish: sirli pad, puls va riser — 4.85 s da «drop»
  pad(padB, 0, HOOK_END, [n('A2'), n('E3'), n('A3'), n('C4')], 0.8, 600)
  for (let b = 0; b < 9; b++) hat(drums, b * BEAT + BEAT / 2, 0.18)
  riser(fx, 3.0, 1.85, 0.6)
  crash(drums, HOOK_END, 0.7)
  sub(bassB, HOOK_END, 0.7)

  // Asosiy groove: yengil, diktor ostida (melodiya yo'q)
  for (let t = HOOK_END, b = 0; t < CTA - 0.01; t += BAR, b++) {
    const c = PROG[b % 4]
    const notes = CHORDS[c].notes
    pad(padB, t, BAR, notes.map(n), 0.55, 1300)
    for (let q = 0; q < 4; q++) {
      const at = t + q * BEAT
      if (at >= CTA) break
      if (q % 2 === 0) { kick(drums, at, 0.75); kicks.push(at) }
      if (q % 2 === 1) clap(drums, at, 0.35)
      hat(drums, at + BEAT / 2, 0.32, q === 3 && b % 4 === 3)
      bass(bassB, at, BEAT * 0.6, n(CHORDS[c].bass), 0.38)
    }
    for (const [k, s] of [0, 3, 6, 8, 11, 14].entries()) {
      const at = t + s * S16
      if (at >= CTA) break
      const note = notes[k % 4].replace(/\d/, (d) => String(Number(d) + 1))
      pluck(plk, at, n(note), 0.42, k % 2 ? 0.35 : -0.35)
    }
    if (b % 8 === 7) crash(drums, t + BAR, 0.4)
  }

  // Yakun: yorqinroq — qo'ng'iroqcha melodiya va akkord stablar
  riser(fx, CTA - 1.2, 1.2, 0.5)
  crash(drums, CTA, 0.8)
  sub(bassB, CTA, 0.8)
  for (let t = CTA, b = 0; t < FINAL - 0.01; t += BAR, b++) {
    const c = PROG[b % 4]
    pad(padB, t, Math.min(BAR, FINAL - t), CHORDS[c].notes.map(n), 0.8, 2600)
    for (let q = 0; q < 4; q++) {
      const at = t + q * BEAT
      if (at >= FINAL) break
      kick(drums, at, 0.85); kicks.push(at)
      if (q % 2 === 1) clap(drums, at, 0.5)
      hat(drums, at + BEAT / 2, 0.4)
      bass(bassB, at, BEAT * 0.7, n(CHORDS[c].bass), 0.45)
    }
    for (const s of [0, 3, 6, 10]) if (t + s * S16 < FINAL) bell(lead, t + s * S16, n(CHORDS[c].notes[s % 4].replace(/\d/, (d) => String(Number(d) + 2))), 0.6, 0.6, s % 2 ? 0.3 : -0.3)
  }
  pad(padB, FINAL, 1.6, [...CHORDS.C.notes, 'G5', 'C6'].map(n), 1.1, 3200)
  for (const [i, note] of ['C5', 'E5', 'G5', 'C6'].entries()) bell(lead, FINAL + i * 0.03, n(note), 0.8, 1.4, i % 2 ? 0.3 : -0.3)
  kick(drums, FINAL, 1); kicks.push(FINAL)
  crash(drums, FINAL, 0.9)
  bass(bassB, FINAL, 1.2, n('C2'), 0.7)

  // Kick'da pad/bas/pluck nafas oladi
  const duck = new Float32Array(N).fill(1)
  for (const kt of kicks) {
    const k0 = Math.round(kt * SR)
    for (let i = 0; i < SR * 0.3 && k0 + i < N; i++) duck[k0 + i] = Math.min(duck[k0 + i], 1 - 0.5 * Math.exp(-i / (SR * 0.08)))
  }
  for (const b of [padB, bassB, plk]) for (let c = 0; c < 2; c++) for (let k = 0; k < N; k++) b[c][k] *= b === bassB ? 0.5 + 0.5 * duck[k] : duck[k]

  const mix = buf()
  mixInto(mix, drums, 0.8)
  mixInto(mix, bassB, 0.85)
  mixInto(mix, padB, 0.7)
  mixInto(mix, plk, 0.5)
  mixInto(mix, lead, 0.7)
  mixInto(mix, fx, 0.5)
  const send = buf()
  mixInto(send, padB, 0.5)
  mixInto(send, plk, 0.6)
  mixInto(send, lead, 0.8)
  mixInto(mix, reverb(send, { wet: 0.8 }), 1)
  const echo = buf(); mixInto(echo, plk, 1); mixInto(echo, lead, 0.7)
  mixInto(mix, delay(echo, BEAT * 0.75, 0.32, 0.25), 1)
  return mix
}

/** Effektlar: [soniya, nom, kuch, parametrlar]. */
const TAPS = [5.35, 6.85, 8.15, 9.65, 12.2, 20.85, 22.55, 25.35, 26.9, 27.5, 28.15, 28.85, 32.25, 33.55, 34.4, 38.25, 39.45, 44.3, 46.45, 47.7, 48.95, 50.45, 56.35, 65.4]
const CUES = [
  [0.0, 'wind', 0.35], [0.2, 'whoosh', 0.3, { d: 0.5 }], [0.15, 'pop', 0.4, { p: 0.8 }], [0.67, 'pop', 0.45, { p: 1.0 }],
  [1.9, 'whoosh', 0.45, { d: 0.4 }], [2.0, 'impact', 0.55], [2.5, 'pops', 0.35, { n: 4, step: 3 }],
  [3.45, 'shimmer', 0.45], [3.45, 'pops', 0.4, { n: 3, step: 5 }], [4.3, 'whoosh', 0.5, { d: 0.55 }],
  [5.6, 'ticks', 0.22, { n: 10, step: 2.4 }], [6.98, 'swish', 0.35],
  [8.32, 'pop', 0.35, { p: 1.1 }], [8.75, 'pop', 0.35, { p: 0.95 }], [10.45, 'pop', 0.4, { p: 1.0 }],
  [12.4, 'whoosh', 0.45, { d: 0.5 }], [13.0, 'shimmer', 0.35],
  [17.75, 'shimmer', 0.3], [18.75, 'pops', 0.25, { n: 4, step: 4 }],
  [20.95, 'swish', 0.3], [21.15, 'ticks', 0.22, { n: 9, step: 2 }], [22.75, 'swish', 0.35],
  [25.5, 'whoosh', 0.3, { d: 0.35 }], [25.95, 'pop', 0.45, { p: 1.2 }],
  [29.05, 'whoosh', 0.4, { d: 0.45 }], [29.3, 'pops', 0.3, { n: 3, step: 5 }], [32.45, 'swish', 0.35],
  [33.7, 'ticks', 0.2, { n: 5, step: 3 }], [34.55, 'ticks', 0.2, { n: 14, step: 1.7 }], [35.75, 'shimmer', 0.4],
  [38.4, 'whoosh', 0.35, { d: 0.4 }], [39.6, 'swish', 0.35], [40.85, 'pop', 0.5, { p: 0.75 }], [43.0, 'whoosh', 0.25, { d: 0.8 }], [44.45, 'swish', 0.3],
  [48.95, 'ticks', 0.15, { n: 8, step: 2.4 }], [49.6, 'ding', 0.35],
  [50.65, 'success', 0.5], [50.75, 'pops', 0.3, { n: 6, step: 2 }],
  [54.0, 'notif', 0.45], [55.3, 'notif', 0.45], [56.5, 'swish', 0.3], [56.7, 'car', 0.35], [58.4, 'car', 0.3],
  [60.2, 'ding', 0.4], [61.7, 'shimmer', 0.5], [61.7, 'wind', 0.25], [62.3, 'notif', 0.45],
  [64.15, 'whoosh', 0.35, { d: 0.4 }],
  [65.9, 'whoosh', 0.5, { d: 0.5 }], [66.05, 'impact', 0.55], [68.45, 'shimmer', 0.45], [68.45, 'pops', 0.35, { n: 5, step: 2 }],
  [69.6, 'pop', 0.5, { p: 1.1 }], [70.0, 'pop', 0.45, { p: 1.3 }],
]
// Yulduzlar: ohangi ko'tarilib boradi
for (let i = 0; i < 5; i++) CUES.push([64.45 + (i * 4) / 30, 'pop', 0.45, { p: 1 + i * 0.12 }])
for (const t of TAPS) CUES.push([t, 'click', 0.45])

function sfx() {
  const out = buf()
  for (const [t, name, g, opts] of CUES) {
    const fn = SFX[name]
    if (!fn) throw new Error(`Noma'lum effekt: ${name}`)
    fn(out, warp(t), g, opts ?? {})
  }
  mixInto(out, reverb(out, { room: 0.6, wet: 0.25 }), 1)
  return out
}

const voiceSrc = argv[0] || join(dir, `guide-voice${SUF}.wav`)
if (!existsSync(voiceSrc)) throw new Error(`Diktor fayli topilmadi: ${voiceSrc}`)
const voice = join(dir, `guide-voice${SUF}.wav`)
if (resolve(voiceSrc) !== resolve(voice)) {
  // 44.1 kHz stereo, uzunligi videoga teng (oxiri jimlik)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', voiceSrc, '-af', `apad,atrim=0:${LENGTH}`, '-ar', String(SR), '-ac', '2', voice])
}

const t0 = Date.now()
writeWav(join(dir, `guide-music${SUF}.wav`), master(music(), 0.8))
writeWav(join(dir, `guide-sfx${SUF}.wav`), master(sfx(), 0.8))
console.log('musiqa va effektlar', ((Date.now() - t0) / 1000).toFixed(1), 's')

/*
 * Aralashtirish: diktor asosiy. Musiqa diktor ovozi bilan siqiladi
 * (sidechain) — gap paytida pasayadi, pauzada biroz ko'tariladi.
 */
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-i', voice, '-i', join(dir, `guide-music${SUF}.wav`), '-i', join(dir, `guide-sfx${SUF}.wav`),
  '-filter_complex', [
    '[0:a]highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=3dB,asplit=2[v][key]',
    '[1:a]volume=0.32[m]',
    '[m][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[md]',
    '[2:a]volume=0.5[s]',
    // Ijtimoiy tarmoqlar me'yori: -14 LUFS, cho'qqi -1.5 dB
    '[v][md][s]amix=inputs=3:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.89:level=false[out]',
  ].join(';'),
  '-map', '[out]', '-ar', String(SR), '-ac', '2', join(dir, `guide-mix${SUF}.wav`),
])
console.log('Tayyor:', join(dir, `guide-mix${SUF}.wav`))
