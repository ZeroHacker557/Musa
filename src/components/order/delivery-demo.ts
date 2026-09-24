import type { Order } from '../../types/domain'

/*
 * FAQAT dev rejimi uchun (`?deliveryDemo`, `?deliveryDemo=arrived`):
 * mijoz ilovasidagi «Kuryer yo'lda» kartochkasi va kuryer bahosi
 * oynasini serversiz ko'rish. App.tsx uni `import.meta.env.DEV` sharti
 * ostida dinamik yuklaydi — production bundlega kirmaydi.
 */
export function demoOrders(arrived: boolean): Order[] {
  const now = Date.now()
  const iso = (ms: number) => new Date(ms).toISOString()
  const base = {
    products: [],
    total: 143500,
    paymentMethod: 'Naqd' as const,
    customer: {
      name: 'Dilnoza', phone: '+998901234567', address: 'Chilonzor 9-kvartal, 3-uy',
      location: null, comment: '', paymentMethod: 'Naqd' as const, recipientName: '', recipientPhone: '',
    },
    courierId: 'c1',
    courierName: 'Komiljon',
    courierPhone: '+998905551234',
  }
  return [
    {
      ...base,
      id: 'demo-way',
      orderNumber: '#0007',
      createdAt: iso(now - 25 * 60_000),
      status: 'Yetkazilmoqda',
      takenAt: iso(now - 7 * 60_000),
      etaAt: iso(now + 12 * 60_000),
      etaMinutes: 19,
      arrivedAt: arrived ? iso(now - 30_000) : null,
    },
    {
      ...base,
      id: 'demo-done',
      orderNumber: '#0003',
      createdAt: iso(now - 26 * 60 * 60_000),
      status: 'Yetkazildi',
      deliveredAt: iso(now - 24 * 60 * 60_000),
      courierRating: null,
    },
  ] as Order[]
}
