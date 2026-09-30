/**
 * Kadrga bog'liq animatsiya yordamchilari.
 *
 * Hamma narsa `frame` dan hisoblanadi (CSS transition yo'q) — shunda har bir
 * kadr aniq bir xil chiziladi va render paytida sakrash bo'lmaydi.
 */

export const FPS = 30
export const WIDTH = 1080
export const HEIGHT = 1920
export const DURATION = 1200 // 40 s
/** 120 BPM: bir zarb 15 kadr, bir takt 60 kadr. */
export const BEAT = 15

export type EasingFn = (t: number) => number

/** Kubik Bezier (CSS cubic-bezier bilan bir xil). */
export function bezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x
      const d = slopeX(t)
      if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break
      t -= err / d
    }
    return sampleY(Math.min(1, Math.max(0, t)))
  }
}

export const ease = {
  linear: (t: number) => t,
  out: bezier(0.22, 1, 0.36, 1), // easeOutQuint-ga yaqin, silliq to'xtash
  in: bezier(0.64, 0, 0.78, 0),
  inOut: bezier(0.65, 0, 0.35, 1),
  outBack: bezier(0.34, 1.56, 0.64, 1),
  outExpo: bezier(0.16, 1, 0.3, 1),
  inExpo: bezier(0.7, 0, 0.84, 0),
}

/** Qiymatni oraliqlar bo'yicha o'zgartirish (Remotion'dagi interpolate kabi). */
export function interp(
  x: number,
  input: number[],
  output: number[],
  easing: EasingFn = ease.linear,
  clamp = true,
): number {
  if (input.length !== output.length) throw new Error('interp: uzunlik mos emas')
  if (x <= input[0]) return clamp ? output[0] : output[0] + ((x - input[0]) / (input[1] - input[0])) * (output[1] - output[0])
  const last = input.length - 1
  if (x >= input[last]) return clamp ? output[last] : output[last]
  let i = 0
  while (i < last - 1 && x > input[i + 1]) i++
  const t = (x - input[i]) / (input[i + 1] - input[i])
  return output[i] + easing(t) * (output[i + 1] - output[i])
}

/**
 * Prujina: so'nuvchi garmonik tebranish, kichik qadamlar bilan hisoblanadi.
 * `frame < 0` — boshlang'ich qiymat.
 */
export function spring(
  frame: number,
  { stiffness = 170, damping = 16, mass = 1, from = 0, to = 1 } = {},
): number {
  if (frame <= 0) return from
  const steps = Math.ceil(frame * 4)
  const dt = frame / FPS / steps
  let x = 0
  let v = 0
  for (let i = 0; i < steps; i++) {
    const a = (-stiffness * (x - 1) - damping * v) / mass
    v += a * dt
    x += v * dt
  }
  return from + (to - from) * x
}

/** Takrorlanadigan tasodifiy son (0..1) — zarrachalar har kadrda bir xil joyda. */
export function rand(seed: number): number {
  let t = (seed * 2654435761) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Musiqa zarbiga mos puls (0..1): zarb boshida 1, keyin so'nadi. */
export function beatPulse(frame: number, offset = 0, decay = 6): number {
  const local = (((frame - offset) % BEAT) + BEAT) % BEAT
  return Math.exp(-local / decay)
}
