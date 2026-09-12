import { useCallback, useState } from 'react'
import { apiPost } from './api'

/**
 * Ro'yxatni yuqoriga/pastga ko'chirish.
 *
 * Drag-and-drop emas, o'q tugmalari: telefonda sudrab ko'chirish
 * noqulay va sahifa aylanishi bilan chalkashib ketadi, o'q esa
 * barmoq bilan ham, sichqoncha bilan ham bir xil ishlaydi.
 *
 * Tartib serverga butun ro'yxat bo'yicha yuboriladi (0,1,2...) —
 * shunda oradagi bo'sh raqamlar yig'ilib qolmaydi.
 */
export function useSortable<T extends { id: string }>(
  entity: 'product' | 'category',
  items: T[],
  onError: (message: string) => void,
) {
  const [busy, setBusy] = useState(false)

  const move = useCallback(
    async (index: number, direction: -1 | 1) => {
      const target = index + direction
      if (busy || target < 0 || target >= items.length) return

      const next = [...items]
      ;[next[index], next[target]] = [next[target], next[index]]

      setBusy(true)
      try {
        await apiPost('action', {
          action: 'order.sort',
          entity,
          ids: next.map((item) => item.id),
        })
        // Ro'yxat onSnapshot orqali o'zi yangilanadi
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Tartib saqlanmadi')
      } finally {
        setBusy(false)
      }
    },
    [busy, entity, items, onError],
  )

  return { move, busy }
}

/** `order` bo'yicha saralaydi; qiymati yo'qlar oxirida turadi. */
export function byOrder<T extends { order?: number }>(a: T, b: T): number {
  return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
}
