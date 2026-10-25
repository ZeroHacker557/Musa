/**
 * Instagram panoramasi: 3 ta ulanib ketadigan post (har biri 1080×1440, 3:4).
 *
 *   node scripts/insta.mjs [--url http://localhost:5190]
 *     → out/insta/musa-panorama.png, 1-chap.jpg, 2-orta.jpg, 3-ong.jpg, profil-korinishi.jpg
 *
 * Instagram'ga JOYLASH tartibi: avval 3 (o'ng), keyin 2, oxirida 1 (chap) —
 * profilda eng yangisi chapda turadi. Qadash (pin) ham shu tartibda.
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = resolve(import.meta.dirname, '..')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const args = process.argv.slice(2)
const urlArg = args.includes('--url') ? args[args.indexOf('--url') + 1] : ''

function serveDist() {
  const dist = join(ROOT, 'dist')
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' }
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = join(dist, path === '/' ? 'index.html' : path)
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html')
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((ok) => server.listen(0, () => ok({ server, url: `http://localhost:${server.address().port}` })))
}

const served = urlArg ? null : await serveDist()
const base = urlArg || served.url
const out = join(ROOT, 'out', 'insta')
mkdirSync(out, { recursive: true })

// `--comp gwpost` — konkurs e'loni rasmi (1080×1350), bo'linmaydi
const comp = args.includes('--comp') ? args[args.indexOf('--comp') + 1] : 'insta'
const size = comp === 'gwpost' ? { width: 1080, height: 1350 } : { width: 3240, height: 1440 }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--font-render-hinting=none'], defaultViewport: { ...size, deviceScaleFactor: 1 } })
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('[sahifa xatosi]', e.message))
await page.goto(`${base}/?comp=${comp}`, { waitUntil: 'networkidle0', timeout: 120000 })
await page.waitForFunction('window.__ready === true', { timeout: 60000 })
if (comp === 'gwpost') {
  const png = join(out, 'konkurs-post.png')
  await page.screenshot({ path: png, clip: { x: 0, y: 0, ...size } })
  await browser.close()
  served?.server.close()
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', join(out, 'konkurs-post.jpg')])
  console.log('Tayyor:', join(out, 'konkurs-post.jpg'))
  process.exit(0)
}
const pano = join(out, 'musa-panorama.png')
await page.screenshot({ path: pano, clip: { x: 0, y: 0, width: 3240, height: 1440 } })
await browser.close()
served?.server.close()

const names = ['1-chap.jpg', '2-orta.jpg', '3-ong.jpg']
names.forEach((name, i) => {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', pano, '-vf', `crop=1080:1440:${i * 1080}:0`, '-q:v', '1', '-pix_fmt', 'yuvj444p', join(out, name)])
})
// Profil to'rida qanday ko'rinishi (oraliqlar bilan, telefon kengligida)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(out, names[0]), '-i', join(out, names[1]), '-i', join(out, names[2]),
  '-filter_complex', '[0]scale=358:477,pad=360:477:0:0:white[a];[1]scale=358:477,pad=360:477:1:0:white[b];[2]scale=358:477,pad=360:477:2:0:white[c];[a][b][c]hstack=3,pad=1080:477+40:0:20:white',
  join(out, 'profil-korinishi.jpg')])
console.log('Tayyor:', out)
