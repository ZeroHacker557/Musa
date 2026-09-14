import {
  ArrowUpDown, Boxes, ImagePlus, Loader2, Pencil, Plus, Search, Trash2, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { formatPrice } from '../../data'
import { apiPost } from '../lib/api'
import { uploadProductImage } from '../lib/storage'
import { useCategories, useProducts, useSections, type ProductRow } from '../lib/live'
import { Modal, ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import type { Section } from '../../types/domain'
import { productThumb } from '../../utils/product-image'

type Draft = {
  id?: string
  name: string
  price: string
  oldPrice: string
  category: string
  description: string
  discount: string
  stock: string
  sizes: string
  color: string
  /** Bo'lim identifikatori; bo'sh — bo'limsiz. */
  sectionId: string
  /**
   * Uchala ro'yxat BIR XIL uzunlikda va tartibda: i-rasmning asl fayli,
   * kichik va o'rta nusxasi. Rasm olib tashlanganda uchalasidan ham
   * o'chiriladi. Siqilgan nusxa yo'q eski rasmlarda bo'sh satr turadi.
   */
  images: string[]
  thumbs: string[]
  optimized: string[]
}

const EMPTY: Draft = {
  name: '', price: '', oldPrice: '', category: '', description: '',
  discount: '', stock: '0', sizes: '', color: '', sectionId: '',
  images: [], thumbs: [], optimized: [],
}

/**
 * Nusxalarni `images` bilan tekislaydi. Asl rasmi almashgan (eskirgan)
 * nusxa bo'sh satrga aylanadi — saqlanganda noto'g'ri rasm qotib qolmasin.
 */
function aligned(product: ProductRow, list: string[] | undefined): string[] {
  const images = product.images || []
  return images.map((url, i) => (product.variantSources?.[i] === url && list?.[i]) || '')
}

function toDraft(product: ProductRow): Draft {
  return {
    id: product.docId,
    name: product.name,
    price: String(product.price ?? ''),
    oldPrice: product.oldPrice ? String(product.oldPrice) : '',
    category: product.category || '',
    description: product.description || '',
    discount: product.discount || '',
    stock: String(product.stock ?? 0),
    sizes: (product.sizes || []).join(', '),
    color: product.color || '',
    sectionId: product.sectionId || '',
    images: product.images || [],
    thumbs: aligned(product, product.thumbs),
    optimized: aligned(product, product.optimized),
  }
}

export function ProductsPage() {
  const { products, loading } = useProducts()
  const { categories } = useCategories()
  const { sections } = useSections()
  const { show, node: toast } = useToast()
  const sectionName = (id?: string | null) => sections.find((x) => x.id === id)?.name

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [removing, setRemoving] = useState<ProductRow | null>(null)
  const [busy, setBusy] = useState(false)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category && p.category !== category) return false
      return !needle || p.name.toLowerCase().includes(needle)
    })
  }, [products, query, category])

  const save = async () => {
    if (!draft) return
    setBusy(true)
    try {
      await apiPost('action', {
        action: 'product.save',
        id: draft.id,
        name: draft.name,
        price: Number(draft.price),
        oldPrice: Number(draft.oldPrice) || 0,
        category: draft.category,
        description: draft.description,
        discount: draft.discount,
        stock: Number(draft.stock),
        sizes: draft.sizes.split(',').map((s) => s.trim()).filter(Boolean),
        color: draft.color,
        sectionId: draft.sectionId || null,
        images: draft.images,
        thumbs: draft.thumbs,
        optimized: draft.optimized,
      })
      show(draft.id ? 'Mahsulot yangilandi' : 'Mahsulot qo‘shildi')
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
      await apiPost('action', {
        action: 'product.delete',
        id: removing.docId,
      })
      show('Mahsulot o‘chirildi')
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
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--faint)' }}
          />
          <input
            className="adm-input icon-left"
            placeholder="Mahsulot qidirish..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="adm-page-head__actions">
          <button
            className="adm-btn adm-btn--primary"
            onClick={() => setDraft({ ...EMPTY, category: categories[0]?.name || '' })}
          >
            <Plus size={17} /> Qo‘shish
          </button>
        </div>
      </div>

      {/* Tartib endi shu yerda emas — Bo'limlar sahifasida sudrab */}
      <a href="#/sections" className="adm-hint mb-3">
        <ArrowUpDown size={16} />
        <span>
          Mahsulotlar tartibi va bo‘limlari — <b>Bo‘limlar</b> sahifasida, sudrab joylashtiriladi
        </span>
      </a>

      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
        {['', ...categories.map((c) => c.name)].map((name) => (
          <button
            key={name || 'all'}
            onClick={() => setCategory(name)}
            className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition active:scale-95"
            style={{
              borderColor: category === name ? 'var(--brand-line)' : 'var(--line)',
              background: category === name ? 'var(--brand-soft)' : 'var(--surface)',
              color: category === name ? 'var(--brand-strong)' : 'var(--muted)',
            }}
          >
            {name || 'Barchasi'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="adm-skeleton h-28" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="adm-card adm-empty">
          <Boxes size={30} />
          <p className="text-sm font-semibold">Mahsulot topilmadi</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((product) => (
            <article key={product.docId} className="adm-card flex gap-3 p-3">
              <div
                className="size-20 shrink-0 overflow-hidden rounded-xl"
                style={{ background: 'var(--surface-2)' }}
              >
                {product.images?.[0] ? (
                  <img
                    src={productThumb(product)}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid size-full place-items-center" style={{ color: 'var(--faint)' }}>
                    <Boxes size={22} />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{product.name}</p>
                <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>
                  {product.category}
                  {sectionName(product.sectionId) ? ` · ${sectionName(product.sectionId)}` : ''}
                </p>
                <p className="mt-1 text-sm font-bold">{formatPrice(product.price)}</p>
                <p
                  className="text-xs font-semibold"
                  style={{ color: (product.stock ?? 0) > 0 ? 'var(--brand)' : 'var(--danger)' }}
                >
                  {(product.stock ?? 0) > 0 ? `Omborda: ${product.stock}` : 'Tugagan'}
                </p>
              </div>

              <div className="flex shrink-0 flex-col gap-1.5">
                <button
                  className="grid size-8 place-items-center rounded-lg transition active:scale-90"
                  style={{ background: 'var(--surface-2)' }}
                  onClick={() => setDraft(toDraft(product))}
                  aria-label="Tahrirlash"
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="grid size-8 place-items-center rounded-lg transition active:scale-90"
                  style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
                  onClick={() => setRemoving(product)}
                  aria-label="O‘chirish"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {draft && (
        <ProductForm
          draft={draft}
          categories={categories.map((c) => c.name)}
          sections={sections}
          busy={busy}
          onChange={setDraft}
          onSave={save}
          onClose={() => setDraft(null)}
          onError={(message) => show(message, 'error')}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Mahsulotni o‘chirish"
          message={`«${removing.name}» butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.`}
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

function ProductForm({
  draft, categories, sections, busy, onChange, onSave, onClose, onError,
}: {
  draft: Draft
  categories: string[]
  sections: Section[]
  busy: boolean
  onChange: (draft: Draft) => void
  onSave: () => void
  onClose: () => void
  onError: (message: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })

  /*
   * Yuklash bir necha soniya davom etadi — shu orada admin nomi yoki
   * narxini yozishda davom etishi mumkin. Yuklash tugagach eski `draft`
   * ga rasm qo'shilsa, o'sha orada yozilganlar o'chib ketardi. Shuning
   * uchun oxirgi holat ref orqali olinadi.
   */
  const latest = useRef({ draft, onChange, onError })
  useEffect(() => {
    latest.current = { draft, onChange, onError }
  })

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded = []
      for (const file of files) uploaded.push(await uploadProductImage(file))
      const current = latest.current.draft
      latest.current.onChange({
        ...current,
        images: [...current.images, ...uploaded.map((u) => u.url)],
        thumbs: [...current.thumbs, ...uploaded.map((u) => u.thumb)],
        optimized: [...current.optimized, ...uploaded.map((u) => u.optimized)],
      })
    } catch (error) {
      latest.current.onError(error instanceof Error ? error.message : 'Rasm yuklanmadi')
    } finally {
      setUploading(false)
    }
  }

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    void uploadFiles(files)
  }

  /*
   * Ctrl+V — nusxalangan rasmni to'g'ridan-to'g'ri yuklash.
   *
   * Forma ochiq turganda butun sahifada tinglanadi: admin qaysi maydonda
   * turganidan qat'i nazar rasm qo'shiladi. Faqat buferda RASM bo'lsa
   * aralashamiz — oddiy matn nomi yoki tavsifga odatdagidek qo'yiladi.
   */
  const uploadRef = useRef(uploadFiles)
  useEffect(() => {
    uploadRef.current = uploadFiles
  })
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const images = [...(event.clipboardData?.files || [])].filter((file) =>
        file.type.startsWith('image/'),
      )
      if (!images.length) return
      event.preventDefault()
      // Skrinshotlar «image.png» nomi bilan keladi — farqlanishi uchun
      const named = images.map((file, i) =>
        file.name && file.name !== 'image.png'
          ? file
          : new File([file], `nusxa_${Date.now()}_${i}.${file.type.split('/')[1] || 'png'}`, {
              type: file.type,
            }),
      )
      void uploadRef.current(named)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  return (
    <Modal
      wide
      title={draft.id ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'}
      onClose={onClose}
      footer={
        <>
          <button className="adm-btn adm-btn--ghost flex-1" onClick={onClose} disabled={busy}>
            Bekor qilish
          </button>
          <button
            className="adm-btn adm-btn--primary flex-1"
            onClick={onSave}
            disabled={busy || uploading}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Saqlash
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nomi" className="sm:col-span-2">
          <input
            className="adm-input"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Chuchvara mol go‘shtli, 800 g"
          />
        </Field>

        <Field label="Narxi (so‘m)">
          <input
            className="adm-input"
            inputMode="numeric"
            value={draft.price}
            onChange={(e) => set({ price: e.target.value.replace(/\D/g, '') })}
            placeholder="45000"
          />
        </Field>

        <Field label="Eski narxi — chegirma ko‘rsatish uchun">
          <input
            className="adm-input"
            inputMode="numeric"
            value={draft.oldPrice}
            onChange={(e) => set({ oldPrice: e.target.value.replace(/\D/g, '') })}
            placeholder="50000"
          />
        </Field>

        <Field label="Kategoriya">
          <select
            className="adm-input"
            value={draft.category}
            // Bo'lim kategoriyaga tegishli — kategoriya almashsa bo'lim ham tozalanadi
            onChange={(e) => set({ category: e.target.value, sectionId: '' })}
          >
            <option value="">Tanlang...</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Bo‘lim">
          <select
            className="adm-input"
            value={draft.sectionId}
            onChange={(e) => set({ sectionId: e.target.value })}
            disabled={!draft.category}
          >
            <option value="">Bo‘limsiz</option>
            {sections
              .filter((section) => section.category === draft.category)
              .map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Ombordagi qoldiq">
          <input
            className="adm-input"
            inputMode="numeric"
            value={draft.stock}
            onChange={(e) => set({ stock: e.target.value.replace(/\D/g, '') })}
          />
        </Field>

        <Field label="Vaznlar — vergul bilan">
          <input
            className="adm-input"
            value={draft.sizes}
            onChange={(e) => set({ sizes: e.target.value })}
            placeholder="400 g, 800 g, 1 kg"
          />
        </Field>

        <Field label="Turi">
          <input
            className="adm-input"
            value={draft.color}
            onChange={(e) => set({ color: e.target.value })}
            placeholder="Mol go‘shti"
          />
        </Field>

        <Field label="Chegirma nishoni" className="sm:col-span-2">
          <input
            className="adm-input"
            value={draft.discount}
            onChange={(e) => set({ discount: e.target.value })}
            placeholder="-15%"
          />
        </Field>

        <Field label="Tavsif" className="sm:col-span-2">
          <textarea
            className="adm-input"
            rows={3}
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Yangi go‘sht va xamirdan, shok muzlatilgan."
          />
        </Field>

        <div className="sm:col-span-2">
          <p className="adm-label">Rasmlar</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {draft.images.map((url, i) => (
              <div key={url + i} className="adm-thumb">
                <img src={draft.thumbs[i] || url} alt="" />
                <button
                  className="adm-thumb__remove"
                  onClick={() =>
                    set({
                      images: draft.images.filter((_, j) => j !== i),
                      thumbs: draft.thumbs.filter((_, j) => j !== i),
                      optimized: draft.optimized.filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Rasmni olib tashlash"
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            <label
              className="adm-thumb grid cursor-pointer place-items-center"
              style={{ color: 'var(--muted)' }}
            >
              {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={addImages}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--faint)' }}>
            Birinchi rasm katalogda ko‘rinadi. 5 MB gacha — ilova uchun avtomatik siqiladi. Nusxalangan rasmni{' '}
            <kbd className="adm-kbd">Ctrl</kbd>+<kbd className="adm-kbd">V</kbd> bilan qo‘yish mumkin.
          </p>
        </div>
      </div>
    </Modal>
  )
}

function Field({
  label, children, className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="adm-label">{label}</label>
      {children}
    </div>
  )
}
