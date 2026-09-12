import { Loader2, Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { useState } from 'react'
import { apiPost } from '../lib/api'
import { useStaff, type StaffRow } from '../lib/live'
import type { Staff, StaffRole } from '../lib/auth'
import { ConfirmDialog, Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

type Draft = {
  uid?: string
  email: string
  name: string
  password: string
  role: StaffRole
  telegramId: string
  phone: string
  active: boolean
}

const EMPTY: Draft = {
  email: '', name: '', password: '', role: 'courier', telegramId: '', phone: '', active: true,
}

const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Ega',
  admin: 'Admin',
  courier: 'Kuryer',
}

const ROLE_TONE: Record<StaffRole, { fg: string; bg: string }> = {
  owner: { fg: 'var(--brand-strong)', bg: 'var(--brand-soft)' },
  admin: { fg: 'var(--royal)', bg: 'var(--royal-soft)' },
  courier: { fg: 'var(--gold)', bg: 'var(--gold-soft)' },
}

export function StaffPage({ me }: { me: Staff }) {
  const { staff, loading } = useStaff(me.role === 'owner')
  const { show, node: toast } = useToast()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [removing, setRemoving] = useState<StaffRow | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      await apiPost('action', { action: 'staff.save', ...draft })
      show(draft.uid ? 'Xodim yangilandi' : 'Xodim qo‘shildi')
      setDraft(null)
    } catch (error) {
      show(error instanceof Error ? error.message : 'Saqlanmadi', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      const result = await apiPost<{ unassigned: number }>('action', {
        action: 'staff.delete',
        uid: removing.uid,
      })
      show(
        result.unassigned
          ? `Xodim o‘chirildi. ${result.unassigned} ta buyurtma biriktirilmagan holatga qaytdi.`
          : 'Xodim o‘chirildi',
      )
      setRemoving(null)
    } catch (error) {
      show(error instanceof Error ? error.message : 'O‘chirilmadi', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="adm-page-head">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Jami {staff.length} ta xodim
        </p>
        <div className="adm-page-head__actions">
          <button className="adm-btn adm-btn--primary" onClick={() => setDraft({ ...EMPTY })}>
            <Plus size={17} /> Qo‘shish
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="adm-skeleton h-20" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="adm-card adm-empty">
          <UserCog size={30} />
          <p className="text-sm font-semibold">Xodim yo‘q</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((person) => {
            const tone = ROLE_TONE[person.role]
            return (
              <article key={person.uid} className="adm-card p-3.5">
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-full text-base font-extrabold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {person.name}
                      {person.uid === me.uid && (
                        <span className="ml-1.5 text-xs font-bold" style={{ color: 'var(--muted)' }}>
                          (siz)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                      {person.email}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="adm-badge" style={{ background: tone.bg, color: tone.fg }}>
                    <ShieldCheck size={12} /> {ROLE_LABEL[person.role]}
                  </span>
                  {!person.active && (
                    <span
                      className="adm-badge"
                      style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
                    >
                      Bloklangan
                    </span>
                  )}
                  {person.telegramId ? (
                    <span
                      className="adm-badge"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    >
                      TG: {person.telegramId}
                    </span>
                  ) : (
                    person.role === 'courier' && (
                      <span
                        className="adm-badge"
                        style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}
                      >
                        Telegram ID yo‘q
                      </span>
                    )
                  )}

                  <span className="ml-auto flex gap-1.5">
                    <button
                      className="grid size-8 place-items-center rounded-lg transition active:scale-90"
                      style={{ background: 'var(--surface-2)' }}
                      onClick={() =>
                        setDraft({
                          uid: person.uid,
                          email: person.email,
                          name: person.name,
                          password: '',
                          role: person.role,
                          telegramId: person.telegramId ? String(person.telegramId) : '',
                          phone: person.phone || '',
                          active: person.active,
                        })
                      }
                      aria-label="Tahrirlash"
                    >
                      <Pencil size={15} />
                    </button>
                    {person.uid !== me.uid && (
                      <button
                        className="grid size-8 place-items-center rounded-lg transition active:scale-90"
                        style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
                        onClick={() => setRemoving(person)}
                        aria-label="O‘chirish"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {draft && (
        <Modal
          title={draft.uid ? 'Xodimni tahrirlash' : 'Yangi xodim'}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button
                className="adm-btn adm-btn--ghost flex-1"
                onClick={() => setDraft(null)}
                disabled={busy}
              >
                Bekor qilish
              </button>
              <button className="adm-btn adm-btn--primary flex-1" onClick={save} disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                Saqlash
              </button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="adm-label">Ism</label>
              <input
                className="adm-input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Sardor Aliyev"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="adm-label">Email — kirish uchun</label>
              <input
                className="adm-input"
                type="email"
                autoCapitalize="none"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="sardor@musa.uz"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="adm-label">
                {draft.uid ? 'Yangi parol — bo‘sh qoldirsangiz o‘zgarmaydi' : 'Parol'}
              </label>
              <input
                className="adm-input"
                type="text"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="Kamida 8 belgi"
              />
            </div>

            <div>
              <label className="adm-label">Rol</label>
              <select
                className="adm-input"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as StaffRole })}
              >
                <option value="courier">Kuryer</option>
                <option value="admin">Admin</option>
                <option value="owner">Ega</option>
              </select>
            </div>

            <div>
              <label className="adm-label">Telefon</label>
              <input
                className="adm-input"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                placeholder="+998 90 123 45 67"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="adm-label">Telegram ID</label>
              <input
                className="adm-input"
                inputMode="numeric"
                value={draft.telegramId}
                onChange={(e) =>
                  setDraft({ ...draft, telegramId: e.target.value.replace(/\D/g, '') })
                }
                placeholder="7203124812"
              />
              <p className="mt-1.5 text-xs" style={{ color: 'var(--faint)' }}>
                Buyurtmalar shu Telegram hisobiga tushadi. ID ni @userinfobot beradi.
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
              <input
                type="checkbox"
                className="size-4"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              />
              <span className="text-sm font-semibold">Faol — tizimga kira oladi</span>
            </label>
          </div>
        </Modal>
      )}

      {removing && (
        <ConfirmDialog
          title="Xodimni o‘chirish"
          message={`«${removing.name}» hisobi butunlay o‘chiriladi va u tizimga kira olmaydi. Unga biriktirilgan buyurtmalar bo‘shatiladi.`}
          confirmLabel="O‘chirish"
          busy={busy}
          onConfirm={remove}
          onClose={() => setRemoving(null)}
        />
      )}

      {toast}
    </>
  )
}
