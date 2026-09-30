/**
 * Uzluksiz setlar videosi uchun ovoz — ANIQ 15 s loop.
 *
 *   node scripts/audio-sets.mjs  →  public/audio/sets-mix.wav (+ sets-music, sets-sfx)
 *
 * 96 BPM: takt 2,5 s, har set 5 s = 2 takt. Loop 6 takt:
 *   C – G | Am – F | Dm – G  → yana C (G→C kadensiyasi ulanishni «yopadi»)
 * Har setning 2-taktida riser va baraban yugurishi (prizma burilishi),
 * keyingi set ochilganda crash.
 *
 * ULANISH SEZILMASLIGI UCHUN: 3 davr (45 s) sintez qilinadi va O'RTADAGI
 * 15 s kesib olinadi — reverb va effekt dumlari oxiridan boshiga xuddi
 * davom etayotgandek o'tadi. Effekt vaqtlari src/sets/SetsLoop.tsx ga mos.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  CHORDS, LEAD, SFX, SR, bass, bell, buf, clap, crash, delay, hat, kick,
  master, mixInto, n, pad, pluck, reverb, riser, setLength, sub, writeWav,
} from './synth.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const LOOP = 15
const SEG = 5
const CYCLES = 3
setLength(LOOP * CYCLES)

const BPM = 96
const BEAT = 60 / BPM
const BAR = BEAT * 4
const S16 = BEAT / 4

const CH = { ...CHORDS, Dm: { bass: 'D2', notes: ['D4', 'F4', 'A4', 'D5'] } }
const MEL = { ...LEAD, Dm: [[0, 'D6', 3], [3, 'A5', 3], [6, 'F5', 2], [8, 'A5', 4], [12, 'C6', 4]] }
/** Har set 2 takt. */
const SEG_CHORDS = [['C', 'G'], ['Am', 'F'], ['Dm', 'G']]

const SETS = JSON.parse(readFileSync(join(ROOT, 'src', 'sets-data.json'), 'utf8'))

/** Bir set (5 s = 150 kadr) ichidagi effektlar — kadr raqami bilan. */
function segmentCues(itemCount) {
  return [
    { f: 1, s: 'pop', g: 0.35, p: 1.0 },
    { f: 4, s: 'pop', g: 0.22, p: 1.15 },
    { f: 5, s: 'shimmer', g: 0.28 },
    { f: 8, s: 'pops', g: 0.24, n: itemCount, step: 1 },
    { f: 14, s: 'pop', g: 0.42, p: 1.25 },
    { f: 14, s: 'ticks', g: 0.13, n: 7, step: 2 },
    { f: 34, s: 'whoosh', g: 0.22, d: 0.3 },
    { f: 44, s: 'swish', g: 0.5 },
    { f: 54, s: 'ticks', g: 0.14, n: 9, step: 2 },
    { f: 72, s: 'ding', g: 0.65 },
    { f: 78, s: 'stamp', g: 0.8 },
    { f: 92, s: 'shimmer', g: 0.3 },
    { f: 110, s: 'whoosh', g: 0.3, d: 0.4 },
    { f: 124, s: 'whoosh', g: 0.6, d: 0.85 },
  ]
}

function music() {
  const drums = buf()
  const bassB = buf()
  const padB = buf()
  const plk = buf()
  const lead = buf()
  const fx = buf()
  const kicks = []
  const segments = (LOOP * CYCLES) / SEG

  for (let sg = 0; sg < segments; sg++) {
    const setIdx = sg % 3
    const t0 = sg * SEG
    crash(drums, t0, 0.7)
    sub(bassB, t0, 0.75)
    for (let bi = 0; bi < 2; bi++) {
      const t = t0 + bi * BAR
      const c = SEG_CHORDS[setIdx][bi]
      const turn = bi === 1
      pad(padB, t, BAR, CH[c].notes.map(n), 0.85, turn ? 2600 : 2000)
      for (let e = 0; e < 8; e++) {
        const oct = e % 4 === 3 ? 2 : 1
        bass(bassB, t + e * (BEAT / 2), (BEAT / 2) * 0.9, n(CH[c].bass) * oct, 0.75)
      }
      for (let q = 0; q < 4; q++) {
        kick(drums, t + q * BEAT, 1)
        kicks.push(t + q * BEAT)
        if (q % 2 === 1) clap(drums, t + q * BEAT, 0.8)
        hat(drums, t + q * BEAT + BEAT / 2, 0.55, q === 3 && turn)
        hat(drums, t + q * BEAT + BEAT / 4, 0.18)
        hat(drums, t + q * BEAT + (3 * BEAT) / 4, 0.22)
      }
      for (const [k, s] of [0, 3, 6, 8, 11, 14].entries()) {
        const note = CH[c].notes[k % 4].replace(/\d/, (d) => String(Number(d) + 1))
        pluck(plk, t + s * S16, n(note), 0.55, k % 2 ? 0.35 : -0.35)
      }
      // Melodiya: har set o'z tembrida (qo'ng'iroq / oktava yuqori / pluck)
      for (const [s, note, l] of MEL[c]) {
        if (turn && s >= 8) continue // burilish taktining 2-yarmi — riserga joy
        if (setIdx === 0) bell(lead, t + s * S16, n(note), 0.85, Math.max(0.35, l * S16 * 1.6), 0.1)
        else if (setIdx === 1) bell(lead, t + s * S16, n(note) * 2, 0.55, Math.max(0.3, l * S16 * 1.2), -0.1)
        else pluck(lead, t + s * S16, n(note), 0.9, 0.15)
      }
      if (turn) {
        riser(fx, t + BAR / 2, BAR / 2, 0.85)
        for (const s of [10, 14]) pad(padB, t + s * S16, S16 * 1.2, CH[c].notes.map((x) => n(x) * 2), 0.5, 4000)
        for (let k = 0; k < 8; k++) clap(drums, t + BAR - BEAT + (k * S16) / 2, 0.2 + k * 0.05)
      }
    }
  }

  // Sidechain «pompa»
  const N = drums[0].length
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
  const dl = buf()
  mixInto(dl, plk, 1)
  mixInto(dl, lead, 0.7)
  mixInto(mix, delay(dl, BEAT * 0.75, 0.38, 0.32), 1)
  return mix
}

function sfx() {
  const out = buf()
  const segments = (LOOP * CYCLES) / SEG
  for (let sg = 0; sg < segments; sg++) {
    const set = SETS[sg % 3]
    for (const c of segmentCues(set.items.length)) SFX[c.s](out, sg * SEG + c.f / 30, c.g ?? 0.5, c)
  }
  mixInto(out, reverb(out, { room: 0.7, wet: 0.35 }), 1)
  return out
}

/** O'rtadagi davr — [LOOP, 2·LOOP) soniya. */
const middle = (b) => b.map((ch) => ch.slice(LOOP * SR, 2 * LOOP * SR))

const t0 = Date.now()
const dir = join(ROOT, 'public', 'audio')
mkdirSync(dir, { recursive: true })
const LOOPED = { fades: false }
const musicOnly = master(middle(music()), 0.85, LOOPED)
const sfxOnly = master(middle(sfx()), 0.85, LOOPED)
writeWav(join(dir, 'sets-music.wav'), musicOnly)
writeWav(join(dir, 'sets-sfx.wav'), sfxOnly)
const mix = [new Float32Array(LOOP * SR), new Float32Array(LOOP * SR)]
for (let c = 0; c < 2; c++) for (let k = 0; k < mix[c].length; k++) mix[c][k] = musicOnly[c][k] * 0.6 + sfxOnly[c][k] * 0.62
writeWav(join(dir, 'sets-mix.wav'), master(mix, 0.8, LOOPED))
console.log('Tayyor:', dir, ((Date.now() - t0) / 1000).toFixed(1), 's')
