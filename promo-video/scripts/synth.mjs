/**
 * Sintezator kutubxonasi — cholg'ular, ovoz effektlari, reverb, master.
 * scripts/audio.mjs (40 s reklama) va scripts/audio-sets.mjs (uzluksiz
 * setlar) shu yerdan foydalanadi. Tashqi fayl yo'q — hammasi sintez.
 *
 * Uzunlik `setLength(soniya)` bilan beriladi (bufferlar yaratilishidan oldin).
 */
import { writeFileSync } from 'node:fs'

export const SR = 44100
export let N = SR * 40
export function setLength(sec) { N = Math.round(SR * sec) }
export const BPM = 120
export const BEAT = 60 / BPM
export const BAR = BEAT * 4
export const S16 = BEAT / 4

// ─── Asosiy yordamchilar ──────────────────────────────────────

export const buf = () => [new Float32Array(N), new Float32Array(N)]
export const midi = (m) => 440 * Math.pow(2, (m - 69) / 12)
export const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
export const n = (name) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name)
  return midi(12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] ? 1 : 0))
}

let seed = 12345
export const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2147483648 - 1
}
/** 0..1 — takrorlanadigan (Math.random emas), har safar bir xil ovoz. */
export const rnd = () => (noise() + 1) / 2

export function add(out, t0, i, l, r) {
  const k = Math.round(t0 * SR) + i
  if (k < 0 || k >= N) return
  out[0][k] += l
  out[1][k] += r
}
export const panLR = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)]

/** RBJ biquad — kesish chastotasi har 32 namunada yangilanadi. */
export class Biquad {
  constructor(type = 'lp') { this.type = type; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(1000, 0.707) }
  set(fc, q) {
    fc = Math.min(Math.max(fc, 20), SR * 0.45)
    const w = 2 * Math.PI * fc / SR
    const cos = Math.cos(w)
    const alpha = Math.sin(w) / (2 * q)
    let b0, b1, b2
    if (this.type === 'lp') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0 }
    else if (this.type === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0 }
    else { b0 = alpha; b1 = 0; b2 = -alpha } // bp
    const a0 = 1 + alpha
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0
    this.a1 = -2 * cos / a0; this.a2 = (1 - alpha) / a0
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y
    return y
  }
}

/** PolyBLEP arra — yumshoq, tiniq (aliasing kam). */
export function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1 }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1 }
  return 0
}
export function makeSaw(freq, detune = 0) {
  let ph = rnd()
  const inc = (freq * Math.pow(2, detune / 1200)) / SR
  return () => { ph += inc; if (ph >= 1) ph -= 1; return 2 * ph - 1 - blep(ph, inc) }
}

// ─── Reverb (Freeverb) ────────────────────────────────────────

export function reverb(input, { room = 0.84, damp = 0.35, wet = 0.3 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]
  const alls = [556, 441, 341, 225]
  const out = buf()
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch ? 23 : 0
    const cb = combs.map((l) => ({ b: new Float32Array(l + spread), i: 0, f: 0 }))
    const ab = alls.map((l) => ({ b: new Float32Array(l + spread), i: 0 }))
    const y = out[ch]
    for (let k = 0; k < N; k++) {
      const inp = (input[0][k] + input[1][k]) * 0.015
      let s = 0
      for (const c of cb) {
        const o = c.b[c.i]
        c.f = o * (1 - damp) + c.f * damp
        c.b[c.i] = inp + c.f * room
        c.i = (c.i + 1) % c.b.length
        s += o
      }
      for (const a of ab) {
        const o = a.b[a.i]
        a.b[a.i] = s + o * 0.5
        a.i = (a.i + 1) % a.b.length
        s = o - s
      }
      y[k] = s * wet
    }
  }
  return out
}

/** Ping-pong kechikish. */
export function delay(input, time, fb = 0.35, wet = 0.3) {
  const d = Math.round(time * SR)
  const out = buf()
  const bl = new Float32Array(d)
  const br = new Float32Array(d)
  let i = 0
  for (let k = 0; k < N; k++) {
    const l = bl[i]
    const r = br[i]
    bl[i] = input[0][k] * 0.7 + r * fb
    br[i] = input[1][k] * 0.3 + l * fb
    i = (i + 1) % d
    out[0][k] = l * wet
    out[1][k] = r * wet
  }
  return out
}

export const mixInto = (dst, src, g = 1) => { for (let c = 0; c < 2; c++) for (let k = 0; k < N; k++) dst[c][k] += src[c][k] * g }

// ─── Cholg'ular ───────────────────────────────────────────────

export function kick(out, t0, g = 1) {
  let ph = 0
  const len = Math.round(0.5 * SR)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = 44 + 120 * Math.exp(-t * 30)
    ph += (2 * Math.PI * f) / SR
    const env = Math.exp(-t * 6.2)
    const click = noise() * Math.exp(-t * 400) * 0.25
    const v = Math.tanh((Math.sin(ph) * env + click) * 1.6) * g * 0.9
    add(out, t0, i, v, v)
  }
}

export function clap(out, t0, g = 1) {
  const bp = new Biquad('bp'); bp.set(1300, 0.9)
  const len = Math.round(0.35 * SR)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    let env = Math.exp(-(t - 0.022) * 14) * (t > 0.022 ? 1 : 0)
    for (const o of [0, 0.009, 0.017]) if (t >= o && t < o + 0.012) env = Math.max(env, Math.exp(-(t - o) * 250))
    const v = bp.p(noise()) * env * g * 1.4
    add(out, t0, i, v, v)
  }
}

export function hat(out, t0, g = 1, open = false) {
  const hp = new Biquad('hp'); hp.set(8000, 0.7)
  const len = Math.round((open ? 0.35 : 0.07) * SR)
  const [l, r] = panLR(0.25)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const v = hp.p(noise()) * Math.exp(-t * (open ? 9 : 55)) * g * 0.5
    add(out, t0, i, v * l, v * r)
  }
}

export function crash(out, t0, g = 1) {
  const hp = new Biquad('hp'); hp.set(4500, 0.6)
  const len = Math.round(2.4 * SR)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const e = Math.exp(-t * 2.2) * (1 - Math.exp(-t * 300))
    add(out, t0, i, hp.p(noise()) * e * g * 0.45, hp.p(noise()) * e * g * 0.45)
  }
}

export function bass(out, t0, dur, freq, g = 1) {
  const s1 = makeSaw(freq)
  const lp = new Biquad('lp')
  let ph = 0
  const len = Math.round(dur * SR)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    if (i % 32 === 0) lp.set(180 + 900 * Math.exp(-t * 18), 1.1)
    ph += (2 * Math.PI * freq) / SR
    const env = Math.min(1, t * 300) * Math.min(1, (dur - t) * 60)
    const v = (lp.p(s1()) * 0.6 + Math.sin(ph) * 0.45) * env * g * 0.42
    add(out, t0, i, v, v)
  }
}

export function pad(out, t0, dur, freqs, g = 1, cutoff = 1400) {
  const len = Math.round((dur + 0.8) * SR)
  for (const [ni, fr] of freqs.entries()) {
    const voices = [-9, 0, 9].map((d) => ({ osc: makeSaw(fr, d), lp: new Biquad('lp'), pan: d / 12 + (ni - 1) * 0.15 }))
    for (const vce of voices) {
      const [l, r] = panLR(Math.max(-1, Math.min(1, vce.pan)))
      for (let i = 0; i < len; i++) {
        const t = i / SR
        if (i % 32 === 0) vce.lp.set(cutoff * (1 + 0.15 * Math.sin(t * 2.1)), 0.8)
        const env = Math.min(1, t / 0.35) * (t > dur ? Math.exp(-(t - dur) * 5) : 1)
        const v = vce.lp.p(vce.osc()) * env * g * 0.07
        add(out, t0, i, v * l, v * r)
      }
    }
  }
}

export function pluck(out, t0, freq, g = 1, pan = 0) {
  const s = makeSaw(freq)
  const s2 = makeSaw(freq * 2, 5)
  const lp = new Biquad('lp')
  const len = Math.round(0.5 * SR)
  const [l, r] = panLR(pan)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    if (i % 32 === 0) lp.set(500 + 5200 * Math.exp(-t * 22), 1.4)
    const v = lp.p(s() * 0.7 + s2() * 0.25) * Math.exp(-t * 9) * Math.min(1, t * 800) * g * 0.35
    add(out, t0, i, v * l, v * r)
  }
}

export function bell(out, t0, freq, g = 1, decay = 1.2, pan = 0) {
  const parts = [[1, 1, 1], [2, 0.45, 0.6], [3.01, 0.25, 0.4], [4.2, 0.12, 0.3]]
  const len = Math.round(decay * 2 * SR)
  const [l, r] = panLR(pan)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    let v = 0
    for (const [m, a, dk] of parts) v += Math.sin(2 * Math.PI * freq * m * t + 0.3 * Math.sin(2 * Math.PI * 5 * t) * (m === 1 ? 0.02 : 0)) * a * Math.exp(-t / (decay * dk))
    v *= Math.min(1, t * 2000) * g * 0.22
    add(out, t0, i, v * l, v * r)
  }
}

export function riser(out, t0, dur, g = 1) {
  const bp = new Biquad('bp')
  let ph = 0
  const len = Math.round(dur * SR)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const p = t / dur
    if (i % 32 === 0) bp.set(300 * Math.pow(25, p), 2)
    ph += (2 * Math.PI * (180 * Math.pow(8, p))) / SR
    const v = (bp.p(noise()) * 1.4 + Math.sin(ph) * 0.18) * p * p * g * 0.5
    add(out, t0, i, v, v)
  }
}

export function sub(out, t0, g = 1, dur = 1.6) {
  let ph = 0
  const len = Math.round(dur * SR)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    ph += (2 * Math.PI * (36 + 30 * Math.exp(-t * 6))) / SR
    const v = Math.sin(ph) * Math.exp(-t * 2.8) * Math.min(1, t * 400) * g * 0.5
    add(out, t0, i, v, v)
  }
}

// ─── Musiqa aranjirovkasi ─────────────────────────────────────

export const CHORDS = {
  C: { bass: 'C2', notes: ['C4', 'E4', 'G4', 'C5'] },
  G: { bass: 'G1', notes: ['B3', 'D4', 'G4', 'B4'] },
  Am: { bass: 'A1', notes: ['C4', 'E4', 'A4', 'C5'] },
  F: { bass: 'F1', notes: ['C4', 'F4', 'A4', 'C5'] },
}
export const PROG = ['C', 'G', 'Am', 'F']
export const LEAD = {
  C: [[0, 'G5', 3], [3, 'E5', 3], [6, 'G5', 2], [8, 'C6', 4], [12, 'B5', 4]],
  G: [[0, 'B5', 3], [3, 'G5', 3], [6, 'D6', 2], [8, 'B5', 8]],
  Am: [[0, 'C6', 3], [3, 'A5', 3], [6, 'E5', 2], [8, 'A5', 4], [12, 'G5', 4]],
  F: [[0, 'A5', 3], [3, 'F5', 3], [6, 'C6', 2], [8, 'A5', 4], [12, 'G5', 4]],
}

// ─── Ovoz effektlari ──────────────────────────────────────────

export const SFX = {
  whoosh(out, t0, g, { d = 0.45 } = {}) {
    const bp = new Biquad('bp')
    const len = Math.round(d * SR)
    for (let i = 0; i < len; i++) {
      const t = i / SR
      const p = t / d
      if (i % 32 === 0) bp.set(350 + 3800 * Math.pow(Math.sin(Math.PI * p), 2), 1.1)
      const [l, r] = panLR(-0.7 + 1.4 * p)
      const v = bp.p(noise()) * Math.pow(Math.sin(Math.PI * p), 1.6) * g * 1.3
      add(out, t0, i, v * l, v * r)
    }
  },
  swish(out, t0, g) { SFX.whoosh(out, t0, g * 1.2, { d: 0.18 }) },
  pop(out, t0, g, { p = 1 } = {}) {
    let ph = 0
    const len = Math.round(0.14 * SR)
    for (let i = 0; i < len; i++) {
      const t = i / SR
      ph += (2 * Math.PI * (320 + 900 * Math.exp(-t * 45)) * p) / SR
      const v = (Math.sin(ph) * Math.exp(-t * 28) + noise() * Math.exp(-t * 900) * 0.2) * g * 0.8
      add(out, t0, i, v, v)
    }
  },
  pops(out, t0, g, { n: count = 6, step = 2 } = {}) {
    for (let k = 0; k < count; k++) SFX.pop(out, t0 + (k * step) / 30, g, { p: 1 + k * 0.08 })
  },
  click(out, t0, g) {
    const hp = new Biquad('hp'); hp.set(2500, 0.7)
    const len = Math.round(0.04 * SR)
    for (let i = 0; i < len; i++) {
      const t = i / SR
      const v = (Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 350) + hp.p(noise()) * Math.exp(-t * 700) * 0.6) * g * 0.7
      add(out, t0, i, v, v)
    }
  },
  tick(out, t0, g) {
    const len = Math.round(0.015 * SR)
    for (let i = 0; i < len; i++) {
      const t = i / SR
      const v = Math.sin(2 * Math.PI * 3300 * t) * Math.exp(-t * 500) * g
      add(out, t0, i, v, v)
    }
  },
  ticks(out, t0, g, { n: count = 10, step = 2 } = {}) {
    for (let k = 0; k < count; k++) SFX.tick(out, t0 + (k * step) / 30, g)
  },
  ding(out, t0, g) {
    SFX.click(out, t0, g * 0.8)
    bell(out, t0 + 0.035, n('A6'), g * 3.2, 1.4, 0.15)
    bell(out, t0 + 0.035, n('E7'), g * 1.4, 0.9, -0.15)
  },
  notif(out, t0, g) {
    bell(out, t0, n('A5'), g * 2.6, 0.35)
    bell(out, t0 + 0.11, n('E6'), g * 2.6, 0.5)
  },
  success(out, t0, g) {
    for (const [i, note] of ['C6', 'E6', 'G6', 'C7'].entries()) bell(out, t0 + i * 0.065, n(note), g * 2.4, 0.7, i % 2 ? 0.3 : -0.3)
  },
  chatter(out, t0, g) {
    // Tishlar taqillashi (🥶)
    for (let k = 0; k < 11; k++) {
      const len = Math.round(0.018 * SR)
      const pitch = 850 + (k % 2) * 180
      for (let i = 0; i < len; i++) {
        const t = i / SR
        const v = (Math.sin(2 * Math.PI * pitch * t) * 0.6 + noise() * 0.3) * Math.exp(-t * 260) * g * 0.6
        add(out, t0 + k * 0.042, i, v, v)
      }
    }
  },
  crack(out, t0, g) {
    const hp = new Biquad('hp'); hp.set(2200, 0.8)
    for (let k = 0; k < 28; k++) {
      const at = t0 + Math.pow(rnd(), 2) * 0.32
      const amp = 0.3 + rnd() * 0.9
      const len = Math.round(0.012 * SR)
      const [l, r] = panLR(rnd() * 1.4 - 0.7)
      for (let i = 0; i < len; i++) {
        const v = hp.p(noise()) * Math.exp(-(i / SR) * 600) * amp * g * 1.2
        add(out, at, i, v * l, v * r)
      }
    }
    let ph = 0
    for (let i = 0; i < Math.round(0.18 * SR); i++) {
      const t = i / SR
      ph += (2 * Math.PI * (90 + 60 * Math.exp(-t * 30))) / SR
      const v = Math.sin(ph) * Math.exp(-t * 18) * g * 0.7
      add(out, t0, i, v, v)
    }
  },
  shatter(out, t0, g) {
    for (let k = 0; k < 70; k++) {
      const at = t0 + Math.pow(rnd(), 1.6) * 0.55
      const fr = 2400 + rnd() * 5200
      const dk = 0.05 + rnd() * 0.2
      const [l, r] = panLR(rnd() * 1.6 - 0.8)
      const len = Math.round(dk * 4 * SR)
      const amp = 0.1 + rnd() * 0.3
      for (let i = 0; i < len; i++) {
        const t = i / SR
        const v = Math.sin(2 * Math.PI * fr * t) * Math.exp(-t / dk) * amp * g
        add(out, at, i, v * l, v * r)
      }
    }
    const hp = new Biquad('hp'); hp.set(3000, 0.7)
    for (let i = 0; i < Math.round(0.6 * SR); i++) {
      const v = hp.p(noise()) * Math.exp(-(i / SR) * 7) * g * 0.6
      add(out, t0, i, v, v)
    }
    SFX.impact(out, t0, g * 0.6)
  },
  shimmer(out, t0, g) {
    for (let k = 0; k < 36; k++) {
      const at = t0 + (k / 36) * 0.75 + rnd() * 0.03
      const fr = 1800 + (k / 36) * 3800 + rnd() * 600
      const [l, r] = panLR(rnd() * 1.6 - 0.8)
      const len = Math.round(0.35 * SR)
      for (let i = 0; i < len; i++) {
        const t = i / SR
        const v = Math.sin(2 * Math.PI * fr * t) * Math.exp(-t * 14) * Math.min(1, t * 3000) * g * 0.12
        add(out, at, i, v * l, v * r)
      }
    }
  },
  impact(out, t0, g) {
    sub(out, t0, g * 1.1, 1.3)
    const lp = new Biquad('lp'); lp.set(500, 0.8)
    for (let i = 0; i < Math.round(0.35 * SR); i++) {
      const v = lp.p(noise()) * Math.exp(-(i / SR) * 14) * g * 1.4
      add(out, t0, i, v, v)
    }
    crash(out, t0, g * 0.5)
  },
  stamp(out, t0, g) {
    let ph = 0
    for (let i = 0; i < Math.round(0.25 * SR); i++) {
      const t = i / SR
      ph += (2 * Math.PI * (60 + 90 * Math.exp(-t * 35))) / SR
      const v = Math.tanh(Math.sin(ph) * Math.exp(-t * 16) * 2.2) * g * 0.9
      add(out, t0, i, v, v)
    }
    const bp = new Biquad('bp'); bp.set(700, 0.9)
    for (let i = 0; i < Math.round(0.08 * SR); i++) {
      const v = bp.p(noise()) * Math.exp(-(i / SR) * 60) * g * 1.8
      add(out, t0, i, v, v)
    }
  },
  car(out, t0, g) {
    const lp = new Biquad('lp')
    let ph = 0
    const d = 1.6
    for (let i = 0; i < Math.round(d * SR); i++) {
      const t = i / SR
      const p = t / d
      if (i % 32 === 0) lp.set(500 + 900 * Math.sin(Math.PI * p), 0.9)
      ph += (2 * Math.PI * (72 + 30 * Math.sin(Math.PI * p) + 3 * Math.sin(t * 40))) / SR
      const saw = (ph / (2 * Math.PI)) % 1 * 2 - 1
      const [l, r] = panLR(-0.8 + 1.6 * p)
      const v = lp.p(saw) * Math.sin(Math.PI * p) * g * 0.5
      add(out, t0, i, v * l, v * r)
    }
    SFX.whoosh(out, t0 + 0.4, g * 0.5, { d: 0.9 })
  },
  wind(out, t0, g) {
    const lp = new Biquad('lp')
    const d = 3.8
    for (let i = 0; i < Math.round(d * SR); i++) {
      const t = i / SR
      if (i % 32 === 0) lp.set(500 + 350 * Math.sin(t * 1.7), 0.9)
      const env = Math.min(1, t / 0.6) * Math.min(1, (d - t) / 0.4) * (0.7 + 0.3 * Math.sin(t * 2.3))
      const v = lp.p(noise()) * env * g * 0.9
      add(out, t0, i, v * 0.9, v)
    }
  },
}

// ─── Master ───────────────────────────────────────────────────

/** `fades: false` — uzluksiz (loop) ovoz uchun: boshi va oxiri so'ndirilmaydi. */
export function master(b, target = 0.89, { fades = true } = {}) {
  const N = b[0].length
  // Avval me'yorlash, keyin yumshoq cheklash: faqat eng baland zarblar
  // tanh bilan «yumaloqlanadi», qolgan signal buzilmaydi.
  let raw = 0
  for (let c = 0; c < 2; c++) for (let k = 0; k < N; k++) raw = Math.max(raw, Math.abs(b[c][k]))
  const pre = 1.35 / (raw || 1)
  let peak = 0
  for (let c = 0; c < 2; c++) for (let k = 0; k < N; k++) {
    const v = Math.tanh(b[c][k] * pre)
    b[c][k] = v
    peak = Math.max(peak, Math.abs(v))
  }
  const gain = target / (peak || 1)
  const fadeIn = fades ? Math.round(0.01 * SR) : 0
  const fadeOut = fades ? Math.round(0.35 * SR) : 0
  for (let c = 0; c < 2; c++) for (let k = 0; k < N; k++) {
    let v = b[c][k] * gain
    if (fadeIn && k < fadeIn) v *= k / fadeIn
    if (fadeOut && k > N - fadeOut) v *= (N - k) / fadeOut
    b[c][k] = v
  }
  return b
}

export function writeWav(path, b) {
  const N = b[0].length
  const data = Buffer.alloc(N * 4)
  for (let k = 0; k < N; k++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b[0][k])) * 32767), k * 4)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b[1][k])) * 32767), k * 4 + 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22)
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  writeFileSync(path, Buffer.concat([h, data]))
}

