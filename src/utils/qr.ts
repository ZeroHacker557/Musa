/**
 * QR kod — kichik, bog'liqliksiz generator.
 *
 * Chekdagi QR mahsulot emas, xizmat ma'lumoti: uni skanerlagan odam
 * buyurtmani botdan topadi. Shuning uchun tashqi kutubxona yoki tashqi
 * rasm xizmati kerak emas — bu yerda faqat kerakli qismi yozilgan:
 * BAYT rejimi, xatoni tuzatish darajasi M, 1–10-versiyalar.
 *
 * Natija — `true` (qora) va `false` (oq) kataklardan iborat kvadrat.
 * Chizishni chaqiruvchi o'zi qiladi (bizda SVG).
 */

/* ── Galua maydoni (2^8) — Rid-Solomon uchun ── */
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x
  LOG[x] = i
  x <<= 1
  if (x & 0x100) x ^= 0x11d
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

/** Rid-Solomon qoldig'i — xatoni tuzatish baytlari. */
function ecBytes(data: number[], count: number): number[] {
  // Generator ko'phadi: (x - a^0)(x - a^1)...
  let gen = [1]
  for (let i = 0; i < count; i++) {
    const next = new Array<number>(gen.length + 1).fill(0)
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j]
      next[j + 1] ^= mul(gen[j], EXP[i])
    }
    gen = next
  }
  const rest = new Array<number>(count).fill(0)
  for (const byte of data) {
    const factor = byte ^ rest[0]
    rest.shift()
    rest.push(0)
    if (factor !== 0) for (let j = 0; j < count; j++) rest[j] ^= mul(gen[j + 1], factor)
  }
  return rest
}

/**
 * Versiya jadvali (xatoni tuzatish darajasi M).
 * [jami ma'lumot baytlari, blokdagi EC baytlari, 1-guruh bloklari, 2-guruh bloklari]
 */
const VERSIONS: [number, number, number, number][] = [
  [16, 10, 1, 0],    // 1
  [28, 16, 1, 0],    // 2
  [44, 26, 1, 0],    // 3
  [64, 18, 2, 0],    // 4
  [86, 24, 2, 0],    // 5
  [108, 16, 4, 0],   // 6
  [124, 18, 4, 0],   // 7
  [154, 22, 2, 2],   // 8
  [182, 22, 3, 2],   // 9
  [216, 26, 4, 1],   // 10
]

/** Tekislash naqshlari markazlari (2–10-versiyalar). */
const ALIGN: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
]

/** Versiya ma'lumoti (7-versiyadan boshlab). */
const VERSION_INFO: Record<number, number> = {
  7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3,
}

/** Format ma'lumoti: M darajasi, 0–7 niqoblar. */
const FORMAT_M = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
]

const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

type Grid = { on: boolean[][]; used: boolean[][]; size: number }

function blank(size: number): Grid {
  return {
    size,
    on: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    used: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  }
}

function put(grid: Grid, row: number, col: number, on: boolean) {
  grid.on[row][col] = on
  grid.used[row][col] = true
}

/** Qidiruv kvadratlari, ajratgichlar, vaqt chiziqlari, tekislash naqshlari. */
function drawPatterns(grid: Grid, version: number) {
  const size = grid.size
  const finder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r
        const cc = col + c
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue
        const edge = r === 0 || r === 6 || c === 0 || c === 6
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4
        put(grid, rr, cc, r >= 0 && r <= 6 && c >= 0 && c <= 6 && (edge || core))
      }
    }
  }
  finder(0, 0)
  finder(0, size - 7)
  finder(size - 7, 0)

  for (let i = 8; i < size - 8; i++) {
    put(grid, 6, i, i % 2 === 0)
    put(grid, i, 6, i % 2 === 0)
  }

  for (const row of ALIGN[version]) {
    for (const col of ALIGN[version]) {
      // Qidiruv kvadratlari ustiga chizilmaydi
      if ((row <= 8 && col <= 8) || (row <= 8 && col >= size - 9) || (row >= size - 9 && col <= 8)) continue
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          put(grid, row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1)
        }
      }
    }
  }

  // Format joylari band qilinadi (qiymati keyin qo'yiladi)
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      put(grid, 8, i, false)
      put(grid, i, 8, false)
    }
  }
  // O'ngdagi 8 ta va pastdagi 7 ta katak — pastdagi 8-si doimiy qora
  for (let i = 0; i < 8; i++) put(grid, 8, size - 1 - i, false)
  for (let i = 0; i < 7; i++) put(grid, size - 1 - i, 8, false)

  // Doim qora katak (format maydonidan keyin — ustiga yozilmasin)
  put(grid, size - 8, 8, true)

  if (version >= 7) {
    const info = VERSION_INFO[version]
    for (let i = 0; i < 18; i++) {
      const bit = ((info >> i) & 1) === 1
      const row = Math.floor(i / 3)
      const col = size - 11 + (i % 3)
      put(grid, row, col, bit)
      put(grid, col, row, bit)
    }
  }
}

/**
 * Format ma'lumoti ikki joyga yoziladi: chap-tepadagi burchak atrofiga va
 * o'ng-tepa bilan chap-past chekkalariga. Joylashuv standartda aniq
 * belgilangan — shuning uchun shartlar shu ko'rinishda.
 */
function drawFormat(grid: Grid, mask: number) {
  const size = grid.size
  const bits = FORMAT_M[mask]
  for (let i = 0; i < 15; i++) {
    const on = ((bits >> i) & 1) === 1

    // Tik chiziq: chap-tepadagi ustun, so'ng chap-pastki chekka
    if (i < 6) grid.on[i][8] = on
    else if (i < 8) grid.on[i + 1][8] = on
    else grid.on[size - 15 + i][8] = on

    // Yotiq chiziq: o'ng-tepadagi chekka, so'ng chap-tepadagi qator
    if (i < 8) grid.on[8][size - 1 - i] = on
    else if (i === 8) grid.on[8][7] = on
    else grid.on[8][14 - i] = on
  }
}

/** Ma'lumot bitlarini zigzag bo'ylab joylash + niqoblash. */
function drawData(grid: Grid, bytes: number[], mask: number) {
  const size = grid.size
  const maskFn = MASKS[mask]
  let bit = 0
  const total = bytes.length * 8
  let upward = true

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5 // 6-ustun vaqt chizig'i
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step
      for (const col of [right, right - 1]) {
        if (grid.used[row][col]) continue
        let on = false
        if (bit < total) {
          on = ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1) === 1
          bit++
        }
        grid.on[row][col] = on !== maskFn(row, col)
        grid.used[row][col] = true
      }
    }
    upward = !upward
  }
}

/** Niqob sifati — standart to'rt qoida (kichik ball yaxshiroq). */
function penalty(on: boolean[][]): number {
  const size = on.length
  let score = 0

  const run = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let count = 1
      for (let j = 1; j < size; j++) {
        if (get(i, j) === get(i, j - 1)) count++
        else {
          if (count >= 5) score += count - 2
          count = 1
        }
      }
      if (count >= 5) score += count - 2
    }
  }
  run((i, j) => on[i][j])
  run((i, j) => on[j][i])

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = on[r][c]
      if (v === on[r][c + 1] && v === on[r + 1][c] && v === on[r + 1][c + 1]) score += 3
    }
  }

  const pattern = [true, false, true, true, true, false, true]
  const light = [false, false, false, false]
  const matches = (cells: boolean[], start: number, seq: boolean[]) =>
    seq.every((v, k) => cells[start + k] === v)
  for (let i = 0; i < size; i++) {
    const row = on[i]
    const col = on.map((r) => r[i])
    for (const cells of [row, col]) {
      for (let j = 0; j + 7 <= size; j++) {
        if (!matches(cells, j, pattern)) continue
        const before = j >= 4 && matches(cells, j - 4, light)
        const after = j + 11 <= size && matches(cells, j + 7, light)
        if (before || after) score += 40
      }
    }
  }

  let dark = 0
  for (const row of on) for (const cell of row) if (cell) dark++
  score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10
  return score
}

/**
 * Matndan QR kod yasaydi.
 *
 * Matn juda uzun bo'lsa (10-versiyaga sig'masa) `null` qaytaradi —
 * chaqiruvchi QR ni ko'rsatmaydi, chek baribir ishlayveradi.
 */
export function qrMatrix(text: string): boolean[][] | null {
  const data = Array.from(new TextEncoder().encode(text))

  const version = VERSIONS.findIndex(([capacity], i) => {
    const countBits = i + 1 < 10 ? 8 : 16
    return data.length + 2 + Math.ceil(countBits / 8) <= capacity
  }) + 1
  if (version === 0) return null

  const [capacity, ecPerBlock, group1, group2] = VERSIONS[version - 1]
  const countBits = version < 10 ? 8 : 16

  /* Bitlar: rejim (0100) + uzunlik + ma'lumot + tugatgich */
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }
  push(0b0100, 4)
  push(data.length, countBits)
  for (const byte of data) push(byte, 8)
  for (let i = 0; i < 4 && bits.length < capacity * 8; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0))
  }
  // To'ldirish baytlari — standart ketma-ketlik
  for (let i = 0; codewords.length < capacity; i++) codewords.push(i % 2 === 0 ? 0xec : 0x11)

  /* Bloklarga bo'lish va aralashtirish */
  const blocks = group1 + group2
  const shortLen = Math.floor(capacity / blocks)
  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let offset = 0
  for (let i = 0; i < blocks; i++) {
    const length = i < group1 ? shortLen : shortLen + 1
    const block = codewords.slice(offset, offset + length)
    offset += length
    dataBlocks.push(block)
    ecBlocks.push(ecBytes(block, ecPerBlock))
  }

  const finalBytes: number[] = []
  const maxData = Math.max(...dataBlocks.map((b) => b.length))
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) if (i < block.length) finalBytes.push(block[i])
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) finalBytes.push(block[i])
  }

  /* Katakchalar: sakkizta niqobdan eng yaxshisi tanlanadi */
  const size = 17 + version * 4
  let best: boolean[][] | null = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const grid = blank(size)
    drawPatterns(grid, version)
    drawData(grid, finalBytes, mask)
    drawFormat(grid, mask)
    const score = penalty(grid.on)
    if (score < bestScore) {
      bestScore = score
      best = grid.on
    }
  }
  return best
}
