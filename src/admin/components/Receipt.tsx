import { createPortal } from 'react-dom'
import { formatPrice } from '../../data'
import { BRAND } from '../../config/brand'
import type { AdminOrder } from '../lib/live'

/**
 * Chop etiladigan chek.
 *
 * Ekranda ko'rinmaydi (`.adm-receipt { display: none }`), chop etishda
 * esa faqat shu tugun qog'ozga tushadi — admin.css dagi `@media print`
 * boshqa hamma narsani yashiradi.
 *
 * Ranglar bu yerda ataylab qattiq yozilgan: printer qorong'i rejim
 * tokenlarini bilmaydi va oq qog'ozda oq matn chiqib qolardi.
 */
export function Receipt({ order }: { order: AdminOrder }) {
  const created = order.createdAt ? new Date(order.createdAt) : null
  const lines = order.products || []
  const subtotal = order.subtotal ?? order.total

  return createPortal(
    <div className="adm-receipt">
      <style>{`
        .rcp { max-width: 180mm; margin: 0 auto; color: #111; }
        .rcp__top { display: flex; justify-content: space-between;
          align-items: flex-start; gap: 16px;
          border-bottom: 2px solid #0a7a3d; padding-bottom: 12px; }
        .rcp__brand { font-size: 26pt; font-weight: 800; letter-spacing: -0.02em;
          color: #0a7a3d; line-height: 1; }
        .rcp__tag { font-size: 8pt; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.14em; color: #555; margin-top: 4px; }
        .rcp__no { text-align: right; }
        .rcp__no b { font-size: 17pt; display: block; }
        .rcp__no span { font-size: 9pt; color: #555; }
        .rcp__grid { display: flex; gap: 28px; margin-top: 16px; font-size: 9.5pt; }
        .rcp__grid h3 { font-size: 8pt; text-transform: uppercase;
          letter-spacing: 0.1em; color: #777; margin: 0 0 4px; }
        .rcp__grid p { margin: 0 0 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 18px;
          font-size: 9.5pt; }
        th { text-align: left; font-size: 8pt; text-transform: uppercase;
          letter-spacing: 0.08em; color: #555; padding: 6px 8px;
          border-bottom: 1.5px solid #0a7a3d; }
        th.num, td.num { text-align: right; }
        td { padding: 7px 8px; border-bottom: 1px solid #e4e4e4;
          vertical-align: top; }
        .rcp__sum { margin-left: auto; margin-top: 14px; width: 68mm;
          font-size: 10pt; }
        .rcp__sum div { display: flex; justify-content: space-between;
          padding: 3px 0; }
        .rcp__sum .total { border-top: 1.5px solid #111; margin-top: 6px;
          padding-top: 7px; font-size: 13pt; font-weight: 800; }
        .rcp__pay { margin-top: 16px; padding: 9px 12px; background: #f1f7f3;
          border-left: 3px solid #0a7a3d; font-size: 9.5pt; }
        .rcp__foot { margin-top: 26px; padding-top: 10px;
          border-top: 1px solid #ddd; font-size: 8.5pt; color: #666;
          display: flex; justify-content: space-between; gap: 16px; }
      `}</style>

      <div className="rcp">
        <header className="rcp__top">
          <div>
            <div className="rcp__brand">{BRAND.name}</div>
            <div className="rcp__tag">{BRAND.tagline}</div>
          </div>
          <div className="rcp__no">
            <b>{order.orderNumber}</b>
            <span>
              {created
                ? created.toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>
        </header>

        <div className="rcp__grid">
          <section style={{ flex: 1 }}>
            <h3>Mijoz</h3>
            <p>
              <b>{order.customer?.name || '—'}</b>
            </p>
            {order.customer?.phone && <p>{order.customer.phone}</p>}
            {order.customer?.address && <p>{order.customer.address}</p>}
          </section>

          <section style={{ flex: 1 }}>
            <h3>Yetkazib beruvchi</h3>
            <p>
              <b>{BRAND.legalName}</b>
            </p>
            <p>{BRAND.phone}</p>
            <p>{BRAND.city}</p>
            {order.courierName && <p>Kuryer: {order.courierName}</p>}
          </section>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '6%' }}>№</th>
              <th>Mahsulot</th>
              <th className="num" style={{ width: '13%' }}>Narx</th>
              <th className="num" style={{ width: '10%' }}>Soni</th>
              <th className="num" style={{ width: '17%' }}>Summa</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const price = line.product?.price || 0
              const qty = line.quantity || 0
              const variant = [line.size, line.color].filter(Boolean).join(' • ')
              return (
                <tr key={line.cartKey || i}>
                  <td>{i + 1}</td>
                  <td>
                    {line.product?.name || '—'}
                    {variant && (
                      <div style={{ color: '#777', fontSize: '8.5pt' }}>{variant}</div>
                    )}
                  </td>
                  <td className="num">{formatPrice(price)}</td>
                  <td className="num">{qty}</td>
                  <td className="num">
                    <b>{formatPrice(price * qty)}</b>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="rcp__sum">
          <div>
            <span>Mahsulotlar</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          {!!order.discount && (
            <div style={{ color: '#0a7a3d' }}>
              <span>Chegirma{order.promoCode ? ` (${order.promoCode})` : ''}</span>
              <span>− {formatPrice(order.discount)}</span>
            </div>
          )}
          {!!order.deliveryFee && (
            <div>
              <span>Yetkazib berish</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </div>
          )}
          <div className="total">
            <span>JAMI</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        <div className="rcp__pay">
          To‘lov usuli: <b>{order.paymentMethod || 'Naqd'}</b>
          {order.paymentStatus ? ` — ${order.paymentStatus}` : ''}
          <br />
          Holati: <b>{order.status}</b>
        </div>

        {order.customer?.comment && (
          <p style={{ marginTop: '12px', fontSize: '9.5pt' }}>
            <b>Izoh:</b> {order.customer.comment}
          </p>
        )}

        <footer className="rcp__foot">
          <span>
            {BRAND.telegram} · {BRAND.phone}
          </span>
          <span>Xaridingiz uchun rahmat!</span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
