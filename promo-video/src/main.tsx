import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { DURATION, FPS, HEIGHT, WIDTH } from './anim'
import { Video } from './Video'
import { LOOP, SetsLoop } from './sets/SetsLoop'
import SETS from './sets-data.json'
import { Guide } from './guide/Guide'
import { GUIDE_DURATION, VOICE } from './guide/timeline'
import './styles.css'

/**
 * Ikki rejim:
 *   • odatiy — ko'rish pleyeri (play/pause, sudragich, ovoz bilan);
 *   • ?render — render skripti uchun: `window.__setFrame(n)` kadrni chizadi.
 */

const params = new URLSearchParams(location.search)
/** Kompozitsiya: `promo` — 40 s reklama, `sets` — 30 s uzluksiz setlar, `guide` — botdan buyurtma qo'llanmasi. */
const COMP = params.get('comp') === 'sets' ? 'sets' : params.get('comp') === 'guide' ? 'guide' : 'promo'
const TOTAL = COMP === 'sets' ? LOOP : COMP === 'guide' ? GUIDE_DURATION : DURATION
const AUDIO = COMP === 'sets' ? '/audio/sets-mix.wav' : COMP === 'guide' ? `/audio/guide-mix${VOICE === 'zilola' ? '' : `-${VOICE}`}.wav` : '/audio/mix.wav'

function Comp({ frame }: { frame: number }) {
  if (COMP === 'guide') return <Guide frame={frame} />
  return COMP === 'sets' ? <SetsLoop frame={frame} /> : <Video frame={frame} />
}

const IMAGES = [
  'hero-products', 'musa-mark', 'kotlet', 'chuchvara', 'somsa', 'dubai', 'gelato', 'bissgo', 'sirok',
  'set-dasturxon', 'set-oquv', 'set-oila', 'set-dasturxon-crop', 'set-oquv-crop', 'set-oila-crop',
  'cat-yarim-tayyor', 'cat-muzqaymoq', 'cat-sirok', 'cat-setlar',
  ...new Set(SETS.flatMap((s) => s.items.map((id) => `items/${id}`))),
].map((n) => `/${n}.webp`)

async function preload() {
  await Promise.all(IMAGES.map((src) => {
    const img = new Image()
    img.src = src
    return img.decode().catch(() => undefined)
  }))
  // Google Fonts shriftni qismlarga (latin, latin-ext, kirill…) bo'ladi va
  // `display=block` — yuklanmagan qismdagi matn ko'rinmaydi. Shuning uchun
  // videoda uchraydigan HAMMA belgilar bilan oldindan yuklanadi.
  const SAMPLE = 'AaBbOoʻʼ‘’“”«»—–…№✓•·₽ ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 Выберите язык Русский'
  await Promise.all([
    document.fonts.load('400 100px "Archivo Black"', SAMPLE),
    ...[400, 600, 700, 800, 900].flatMap((w) => [
      document.fonts.load(`${w} 40px "Montserrat"`, SAMPLE),
      document.fonts.load(`italic ${w} 40px "Montserrat"`, SAMPLE),
    ]),
  ])
  await document.fonts.ready
}

const root = createRoot(document.getElementById('root')!)

if (params.has('render')) {
  document.body.classList.add('render')
  let setFrame: (n: number) => void = () => {}
  function RenderHost() {
    const [frame, set] = useState(0)
    setFrame = set
    return <Comp frame={frame} />
  }
  root.render(<RenderHost />)
  const ready = preload()
  ;(window as unknown as { __setFrame: (n: number) => Promise<void> }).__setFrame = async (n: number) => {
    await ready
    flushSync(() => setFrame(n))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  }
} else {
  root.render(<StrictMode><Player /></StrictMode>)
}

function Player() {
  const [frame, setFrame] = useState(() => Number(params.get('f')) || 0)
  const [playing, setPlaying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const scale = Math.min((window.innerHeight - 90) / HEIGHT, (window.innerWidth - 20) / WIDTH)

  useEffect(() => { preload().then(() => setLoaded(true)) }, [])

  useEffect(() => {
    if (!playing) return
    const a = audio.current
    const startFrame = frame
    const t0 = performance.now()
    if (a) {
      a.currentTime = startFrame / FPS
      void a.play().catch(() => undefined)
    }
    let raf = 0
    const tick = () => {
      const n = startFrame + Math.floor(((performance.now() - t0) / 1000) * FPS)
      // Setlar videosi uzluksiz — oxiridan boshiga qaytadi
      if (n >= TOTAL && COMP === 'sets') {
        setFrame(n % TOTAL)
        if (a && a.currentTime >= TOTAL / FPS - 0.05) a.currentTime = 0
        raf = requestAnimationFrame(tick)
        return
      }
      if (n >= TOTAL) { setFrame(TOTAL - 1); setPlaying(false); return }
      setFrame(n)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); a?.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat play bosilganda boshlanadi
  }, [playing])

  return (
    <div className="player">
      <audio ref={audio} src={AUDIO} preload="auto" loop={COMP === 'sets'} />
      <div className="stage" style={{ width: WIDTH * scale, height: HEIGHT * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: WIDTH, height: HEIGHT }}>
          {loaded && <Comp frame={frame} />}
        </div>
      </div>
      <div className="controls">
        <button onClick={() => setPlaying(!playing)}>{playing ? '❚❚' : '▶'}</button>
        <input type="range" min={0} max={TOTAL - 1} value={frame} onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)) }} />
        <span>{(frame / FPS).toFixed(2)} s · {frame}</span>
      </div>
    </div>
  )
}
