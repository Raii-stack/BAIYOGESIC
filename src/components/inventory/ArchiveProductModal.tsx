import { useEffect } from "react"

export default function ArchiveProductModal({ productName, open, onCancel, onConfirm, loading, error }: {
  productName: string
  open: boolean
  onCancel: () => void
  onConfirm: () => Promise<void>
  loading: boolean
  error: string
}) {
  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !loading) onCancel() }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open, loading, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center px-4 py-8">
      <button type="button" aria-label="Cancel archive" onClick={() => { if (!loading) onCancel() }} className="absolute inset-0 bg-slate-950/70" />
      <section role="alertdialog" aria-modal="true" aria-labelledby="archive-product-title" aria-describedby="archive-product-description" className="relative w-full max-w-lg workspace-panel shadow-xl">
        <div className="p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" /><path d="M12 9v5M12 18h.01" /></svg></div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">Destructive action</p>
          <h2 id="archive-product-title" className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">Archive this product?</h2>
          <p className="mt-2 text-sm font-semibold text-slate-700">{productName}</p>
          <p id="archive-product-description" className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">This hides the product and archives its price history. Products used in active sales cannot be archived.</p>
        </div>
        {error && <p role="alert" className="px-6 pb-4 text-sm font-semibold text-red-700">{error}</p>}
        <div className="workspace-drawer-footer">
          <button type="button" onClick={onCancel} disabled={loading} autoFocus className="workspace-secondary-action">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="workspace-danger-action">{loading ? "Archiving…" : "Archive product"}</button>
        </div>
      </section>
    </div>
  )
}
