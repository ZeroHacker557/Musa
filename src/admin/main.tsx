import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './admin.css'
import { AdminApp } from './AdminApp'

/**
 * Admin panel kirish nuqtasi (admin.html).
 *
 * Mini appdan mustaqil: Telegram darvozasi yo'q, oddiy brauzerda
 * email/parol bilan ochiladi.
 */
createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
