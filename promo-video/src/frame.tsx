import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'

/** Joriy kadr (sahna ichida — sahnaning o'z boshidan hisoblanadi). */
const FrameContext = createContext(0)

export const useFrame = () => useContext(FrameContext)

export function FrameProvider({ frame, children }: { frame: number; children: ReactNode }) {
  return <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
}

/**
 * Sahna: `from` dan `from + duration` gacha ko'rinadi, ichida kadr 0 dan boshlanadi.
 * Tashqarida umuman chizilmaydi (render tez bo'lsin).
 */
export function Seq({
  from, duration, children, style, z = 0,
}: {
  from: number
  duration: number
  children: ReactNode
  style?: CSSProperties
  z?: number
}) {
  const frame = useFrame()
  if (frame < from || frame >= from + duration) return null
  return (
    <FrameProvider frame={frame - from}>
      <div style={{ position: 'absolute', inset: 0, zIndex: z, overflow: 'hidden', ...style }}>{children}</div>
    </FrameProvider>
  )
}

/** To'liq ekranli qatlam. */
export function Layer({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: 'absolute', inset: 0, ...style }}>{children}</div>
}
