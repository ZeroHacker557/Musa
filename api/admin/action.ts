import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaff, type Staff } from '../_lib/admin-auth.js'
import { fail, requirePost } from '../_lib/http.js'
import { orderAssign, orderStatus } from '../_lib/actions/orders.js'
import {
  categoryDelete, categorySave, productDelete, productSave, promoDelete, promoSave,
  requireCatalogAccess,
} from '../_lib/actions/catalog.js'
import { broadcast, staffDelete, staffSave } from '../_lib/actions/people.js'
import { settingsSave, settingsTestGroup } from '../_lib/actions/settings.js'

type Body = Record<string, unknown>
type Handler = (staff: Staff, body: Body) => Promise<unknown>

/**
 * Admin panelning YAGONA yozuv nuqtasi: POST /api/admin/action
 * Tana: { action: "product.save", ...maydonlar }
 *
 * Nega bitta funksiya? Vercel Hobby rejasida serverless funksiyalar soni
 * cheklangan (12 ta), har amal uchun alohida fayl ochilsa limit tez
 * tugaydi. Mantiq esa `api/_lib/actions/` ichidagi alohida modullarda —
 * bu fayl faqat yo'naltiradi va huquqni tekshiradi.
 */
const HANDLERS: Record<string, Handler> = {
  // Buyurtmalar — kuryer ham chaqira oladi, cheklovlar modul ichida
  'order.status': orderStatus,
  'order.assign': orderAssign,

  // Katalog — kuryerga yopiq
  'product.save': (staff, body) => (requireCatalogAccess(staff), productSave(body)),
  'product.delete': (staff, body) => (requireCatalogAccess(staff), productDelete(body)),
  'category.save': (staff, body) => (requireCatalogAccess(staff), categorySave(body)),
  'category.delete': (staff, body) => (requireCatalogAccess(staff), categoryDelete(body)),
  'promo.save': (staff, body) => (requireCatalogAccess(staff), promoSave(body)),
  'promo.delete': (staff, body) => (requireCatalogAccess(staff), promoDelete(body)),

  // Odamlar
  'staff.save': staffSave,
  'staff.delete': staffDelete,
  'broadcast.send': broadcast,

  // Sozlamalar
  'settings.save': settingsSave,
  'settings.testGroup': settingsTestGroup,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return

  // Eng past rol bilan kiritamiz — har amal o'z cheklovini o'zi qo'yadi
  const staff = await requireStaff(req, res, 'courier')
  if (!staff) return

  const action = typeof req.body?.action === 'string' ? req.body.action : ''
  const run = HANDLERS[action]
  if (!run) return fail(res, 400, `Noma’lum amal: ${action || '(bo‘sh)'}`)

  try {
    const result = await run(staff, (req.body ?? {}) as Body)
    return res.status(200).json({ ok: true, ...(result as object) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Amal bajarilmadi'
    console.error(`[admin] ${action} xatosi:`, error)
    // Tekshiruv xatolari mijozga tushunarli matn bilan qaytadi
    return fail(res, 400, message)
  }
}
