import { useEffect } from "react"

export default function ArchiveEmployeeModal({ employeeName, open, onCancel, onConfirm, loading, error }: {
  employeeName: string
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
      <section role="alertdialog" aria-modal="true" aria-labelledby="archive-employee-title" aria-describedby="archive-employee-description" className="relative w-full max-w-lg overflow-hidden rounded-lg border border-slate-300 border-t-[3px] border-t-red-600 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.30)]">
        <div className="px-6 pb-7 pt-8 text-center sm:px-9">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2.8 19a1.3 1.3 0 0 0 1.1 2h16.2a1.3 1.3 0 0 0 1.1-2L12 3Z" /><path d="M12 9v5M12 18h.01" /></svg></div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">Destructive action</p>
          <h2 id="archive-employee-title" className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">Archive this employee?</h2>
          <p className="mt-2 text-sm font-semibold text-slate-700">{employeeName}</p>
          <p id="archive-employee-description" className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">This hides the employee from active views and archives their job history. Employees linked to active sales cannot be archived.</p>
        </div>
        {error && <p role="alert" className="px-6 pb-4 text-sm font-semibold text-red-700 sm:px-9">{error}</p>}
        <div className="grid grid-cols-2 gap-3 border-t border-slate-300 bg-slate-50 px-5 py-4 sm:px-8">
          <button type="button" onClick={onCancel} disabled={loading} autoFocus className="h-11 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:opacity-50 sm:text-sm">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="h-11 rounded-md bg-red-700 px-3 text-xs font-bold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-wait disabled:opacity-70 sm:text-sm">{loading ? "Archiving…" : "Archive employee"}</button>
        </div>
      </section>
    </div>
  )
}
