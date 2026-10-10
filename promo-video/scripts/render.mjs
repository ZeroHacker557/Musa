/**
 * Videoni render qilish: har bir kadrni Chrome chizadi, ffmpeg MP4 ga yig'adi.
 *
 *   node scripts/render.mjs                      → out/musa-promo.mp4 (dist/ dan)
 *   node scripts/render.mjs --url http://localhost:5190 --stills 0,60,300
 *                                                → out/stills/f0060.jpg …
 *   node scripts/render.mjs --from 480 --to 720  → faqat shu oraliq (tez tekshirish)
 *
 * Ovoz: public/audio/mix.wav (scripts/audio.mjs yaratadi) bo'lsa qo'shiladi.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const FPS = 30
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const comp = arg('comp', 'promo')
/** Qo'llanma diktori: zilola (sukut) yoki sardor. */
const voice = arg('voice', 'zilola')
const vsuf = comp === 'guide' && voice !== 'zilola' ? `-${voice}` : ''
const DURATION = comp === 'sets' ? 450 : comp === 'guide' ? 2190 : 1200
const stills = arg('stills', '')
const from = Number(arg('from', 0))
const to = Number(arg('to', DURATION))
const outFile = resolve(ROOT, arg('out', comp === 'sets' ? 'out/musa-setlar-loop.mp4' : comp === 'guide' ? `out/musa-qollanma${vsuf}.mp4` : 'out/musa-promo.mp4'))

/** dist/ uchun oddiy statik server. */
function serveDist() {
  const dist = join(ROOT, 'dist')
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' }
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = join(dist, path === '/' ? 'index.html' : path)
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((ok) => server.listen(0, () => ok({ server, url: `http://localhost:${server.address().port}` })))
}

const served = arg('url', '') ? null : await serveDist()
const base = arg('url', '') || served.url

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--font-render-hinting=none', '--disable-gpu-vsync'],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('[sahifa xatosi]', e.message))
await page.goto(`${base}/?render&comp=${comp}&voice=${voice}`, { waitUntil: 'networkidle0', timeout: 120000 })
await page.waitForFunction('typeof window.__setFrame === "function"', { timeout: 60000 })

const draw = (n) => page.evaluate((f) => window.__setFrame(f), n)
const shot = () => page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: 1080, height: 1920 }, optimizeForSpeed: true })

if (stills) {
  const dir = join(ROOT, 'out', 'stills')
  mkdirSync(dir, { recursive: true })
  for (const n of stills.split(',').map(Number)) {
    await draw(n)
    const buf = await shot()
    const path = join(dir, `${comp === 'sets' ? 's' : comp === 'guide' ? 'g' : 'f'}${String(n).padStart(4, '0')}.jpg`)
    await import('node:fs').then((fs) => fs.writeFileSync(path, buf))
    console.log('kadr', n, '→', path)
  }
} else {
  mkdirSync(join(ROOT, 'out'), { recursive: true })
  const audio = join(ROOT, 'public', 'audio', comp === 'sets' ? 'sets-mix.wav' : comp === 'guide' ? `guide-mix${vsuf}.wav` : 'mix.wav')
  const withAudio = existsSync(audio) && from === 0 && to === DURATION
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    ...(withAudio ? ['-i', audio] : []),
    // JPEG kadrlar to'liq diapazonda — telefonlar kutgan standart (BT.709, tv) ga o'tkazamiz
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-profile:v', 'high', '-level', '4.2', '-movflags', '+faststart',
    ...(withAudio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []),
    '-r', String(FPS),
    outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })

  const t0 = Date.now()
  for (let n = from; n < to; n++) {
    await draw(n)
    const buf = await shot()
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r))
    if (n % 60 === 0) {
      const done = n - from + 1
      const eta = ((Date.now() - t0) / done) * (to - n) / 1000
      console.log(`kadr ${n}/${to}  (~${eta.toFixed(0)} s qoldi)`)
    }
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  console.log('Tayyor:', outFile, withAudio ? '(ovoz bilan)' : '(ovozsiz)', `${((Date.now() - t0) / 1000).toFixed(0)} s`)
}

await browser.close()
served?.server.close()
