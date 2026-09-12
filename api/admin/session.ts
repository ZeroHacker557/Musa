import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireStaff } from '../_lib/admin-auth.js'

/**
 * GET /api/admin/session
 * → { staff: { uid, email, name, role, ... } }
 *
 * Kirgandan keyin birinchi so'rov: brauzerdagi Firebase seansi haqiqiy
 * xodimga tegishlimi va u hali bloklanmaganmi — shuni aniqlaydi.
 * Rol ham shu yerdan keladi, mijoz tomonidagi rolga ishonilmaydi.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat GET' })
  }

  // Eng past rol — kuryer ham o'z seansini tekshira olishi kerak
  const staff = await requireStaff(req, res, 'courier')
  if (!staff) return

  return res.status(200).json({ staff })
}
