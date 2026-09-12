import { formatPrice } from '../../data'

type Bar = { label: string; value: number }

/**
 * Oddiy ustunli grafik — SVG bilan, kutubxonasiz.
 *
 * Grafik kutubxonasi qo'shilmadi: bu yerda kerak bo'lgan narsa faqat
 * 14 ta ustun. Kutubxona bundle'ga ~150 KB qo'shardi va qorong'i rejim
 * uchun alohida moslash talab qilardi.
 */
export function MiniBarChart({ data }: { data: Bar[] }) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const empty = data.every((d) => d.value === 0)

  return (
    <div className="mt-4">
      <div className="flex h-36 items-end gap-1.5">
        {data.map((bar, i) => {
          const height = empty ? 2 : Math.max(2, Math.round((bar.value / max) * 100))
          return (
            <div key={bar.label + i} className="group relative flex flex-1 flex-col items-center">
              <span
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${height}%`,
                  background:
                    bar.value === max && !empty ? 'var(--brand)' : 'var(--brand-soft-2)',
                  animation: `admGrow 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 35}ms both`,
                }}
              />
              {/* Ustun ustiga kelganda qiymat */}
              <span
                className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md px-2 py-1 text-[0.68rem] font-bold opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: 'var(--ink)', color: 'var(--surface)' }}
              >
                {formatPrice(bar.value)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((bar, i) => (
          <span
            key={bar.label + i}
            className="flex-1 text-center text-[0.62rem] font-semibold"
            style={{ color: 'var(--faint)' }}
          >
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  )
}
