import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

/**
 * Ikkita mustaqil sahifa:
 *   index.html — Telegram mini app (mijozlar uchun)
 *   admin.html — veb admin panel (xodimlar uchun, /admin manzilida)
 *
 * Ular alohida bundle'ga yig'iladi: mijoz admin panel kodini yuklamaydi
 * va aksincha. Vercel'da /admin -> /admin.html qayta yozuvi vercel.json da.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
})
