import { useEffect, useState, type FormEvent } from "react"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import useDebouncedValue from "../../hooks/useDebouncedValue"
import { employeeApi, type EmployeePagination } from "../../lib/employee-api"

type Item = { code: string; label: string; archived: boolean; stamp: string }

const PAGE_SIZE = 10
const emptyPagination: EmployeePagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }
const pages = (current: number, total: number) => { const count = Math.min(total, 5); const start = Math.max(1, Math.min(current - 2, total - count + 1)); return Array.from({ length: count }, (_, i) => start + i) }

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 5 5M4 20l3.5-.7L20 6.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" /></svg>
}

function ArchiveIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg>
}

function RestoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
}

export default function LookupSection({ kind, canAdd = canEdit, canEdit, canDelete, canViewAudit = true, onChanged, onNotice, onTotalChange }: {
  kind: "jobs" | "departments"
  canAdd?: boolean
  canEdit: boolean
  canDelete: boolean
  canViewAudit?: boolean
  onChanged: () => void
  onNotice: (message: string) => void
  onTotalChange: (total: number | null) => void
}) {
  const isJobs = kind === "jobs"
  const singular = isJobs ? "Job" : "Department"
  const codeMax = isJobs ? 4 : 3
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [status, setStatus] = useState<"all" | "active" | "archived">("all")
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Item[]>([])
  const [pagination, setPagination] = useState<EmployeePagination>(emptyPagination)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selected, setSelected] = useState<Item | null>(null)
  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [toArchive, setToArchive] = useState<Item | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)
  const [restoringCode, setRestoringCode] = useState<string | null>(null)

  useEffect(() => {
    if (searchPending) { setLoading(true); setError(""); onTotalChange(null); return }
    const controller = new AbortController()
    setLoading(true)
    setError("")
    onTotalChange(null)
    const load = isJobs
      ? employeeApi.jobs.list({ page, limit: PAGE_SIZE, search: debouncedQuery, status }, controller.signal)
          .then((result) => ({ items: result.jobs.map((job) => ({ code: job.code, label: job.description, archived: job.archived, stamp: job.stamp })), pagination: result.pagination }))
      : employeeApi.departments.list({ page, limit: PAGE_SIZE, search: debouncedQuery, status }, controller.signal)
          .then((result) => ({ items: result.departments.map((dept) => ({ code: dept.code, label: dept.name, archived: dept.archived, stamp: dept.stamp })), pagination: result.pagination }))
    load
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) { setPage(result.pagination.totalPages); return }
        setItems(result.items)
        setPagination(result.pagination)
        onTotalChange(result.pagination.total)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : `Unable to load ${kind}.`)
          setItems([])
          setPagination(emptyPagination)
          onTotalChange(null)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [isJobs, kind, page, debouncedQuery, searchPending, status, refresh, onTotalChange])

  const openModal = (item: Item | null) => {
    setSelected(item)
    setCode(item?.code ?? "")
    setLabel(item?.label ?? "")
    setFormError("")
    setPanelOpen(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setFormError("")
    try {
      if (isJobs) {
        if (selected) await employeeApi.jobs.update(selected.code, { jobdesc: label.trim() })
        else await employeeApi.jobs.create({ jobcode: code.trim().toUpperCase(), jobdesc: label.trim() })
      } else {
        if (selected) await employeeApi.departments.update(selected.code, { deptname: label.trim() })
        else await employeeApi.departments.create({ deptcode: code.trim().toUpperCase(), deptname: label.trim() })
      }
      setPanelOpen(false)
      onNotice(`${singular} ${selected ? "updated" : "added"} successfully.`)
      onChanged()
      setRefresh((current) => current + 1)
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : `Unable to save ${singular.toLowerCase()}.`)
    } finally {
      setSaving(false)
    }
  }

  const archive = async () => {
    if (!toArchive) return
    setArchiving(true)
    setArchiveError("")
    try {
      if (isJobs) await employeeApi.jobs.archive(toArchive.code)
      else await employeeApi.departments.archive(toArchive.code)
      setToArchive(null)
      onNotice(`${singular} archived successfully.`)
      onChanged()
      if (status === "active" && items.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch (cause) {
      setArchiveError(cause instanceof Error ? cause.message : `Unable to archive ${singular.toLowerCase()}.`)
    } finally {
      setArchiving(false)
    }
  }

  const restore = async (item: Item) => {
    setRestoringCode(item.code)
    try {
      if (isJobs) await employeeApi.jobs.restore(item.code)
      else await employeeApi.departments.restore(item.code)
      onNotice(`${singular} restored successfully.`)
      onChanged()
      if (status === "archived" && items.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch {
      // Shared error toast emitted by apiFailure
    } finally {
      setRestoringCode(null)
    }
  }

  const showActions = canEdit || canDelete
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + items.length - 1, pagination.total) : 0
  const headings = [
    isJobs ? "Job code" : "Dept code",
    isJobs ? "Description" : "Department name",
    ...(canViewAudit ? ["Status", "Last change"] : []),
    ...(showActions ? ["Actions"] : []),
  ]

  return (
    <>
      <section aria-label={`${singular} filters`} className="mb-5 grid gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-[0_8px_28px_rgba(15,39,67,0.04)] md:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_180px_auto] lg:items-end">
        <label><span className="mb-2 block text-xs font-bold text-slate-700">Search {kind}</span><span className="relative block"><DashboardIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder={isJobs ? "Job code or description" : "Dept code or department name"} className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-700 focus:bg-white focus:ring-3 focus:ring-blue-100" /></span></label>
        {canViewAudit && <label><span className="mb-2 block text-xs font-bold text-slate-700">Status</span><select value={status} onChange={(event) => { setStatus(event.target.value as "all" | "active" | "archived"); setPage(1) }} className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-700"><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select></label>}
        {canAdd && <button type="button" onClick={() => openModal(null)} className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:ring-4 focus-visible:ring-blue-200">+ Add {singular.toLowerCase()}</button>}
      </section>

      {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{error}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4">Try again</button></div>}

      <section aria-label={`${singular} records`} className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,39,67,0.05)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4"><div><h2 className="text-sm font-bold text-slate-900">{isJobs ? "Job catalog" : "Department directory"}</h2><p className="mt-0.5 text-xs text-slate-500">{isJobs ? "Standard job codes and titles" : "Organizational units and department codes"}</p></div><span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}</span></div>
        <div className="overflow-x-auto" aria-busy={loading}><table className="w-full min-w-[780px] border-collapse text-left"><thead><tr className="border-b border-slate-200 bg-slate-50">{headings.map((heading) => <th key={heading} scope="col" className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pl-6 last:pr-6 ${heading === "Actions" ? "sticky right-0 z-10 border-l border-slate-200 bg-slate-50" : ""}`}>{heading}</th>)}</tr></thead><tbody>
          {loading ? Array.from({ length: 6 }, (_, index) => <tr key={index} aria-hidden="true" className="border-b border-slate-100">{Array.from({ length: headings.length }, (_, column) => <td key={column} className="px-5 py-5"><div className="h-3.5 max-w-full animate-pulse rounded bg-slate-200" style={{ width: column === 1 ? 160 : 90 }} /></td>)}</tr>) : items.map((item) => (
            <tr key={item.code} className={`border-b border-slate-100 transition-colors last:border-0 ${item.archived ? "bg-slate-50/70 hover:bg-slate-100" : "hover:bg-blue-50/40"}`}>
              <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold text-blue-800">{item.code}</td>
              <td className="px-5 py-4 text-sm font-semibold text-slate-950">{item.label}</td>
              {canViewAudit && <td className="whitespace-nowrap px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.archived ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>{item.archived ? "Archived" : "Active"}</span></td>}
              {canViewAudit && <td className="max-w-56 px-5 py-4 font-mono text-[11px] leading-5 text-slate-500">{item.stamp || "—"}</td>}
              {showActions && <td className={`sticky right-0 z-10 border-l border-slate-100 px-5 py-4 pr-6 ${item.archived ? "bg-slate-50" : "bg-white"}`}><div className="flex items-center gap-1">
                {!item.archived ? <>
                  {canEdit && <button type="button" onClick={() => openModal(item)} aria-label={`Edit ${item.label}`} title={`Edit ${singular.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><EditIcon /></button>}
                  {canDelete && <button type="button" onClick={() => { setArchiveError(""); setToArchive(item) }} aria-label={`Archive ${item.label}`} title={`Archive ${singular.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"><ArchiveIcon /></button>}
                </> : canDelete ? <button type="button" onClick={() => restore(item)} disabled={restoringCode === item.code} aria-label={`Restore ${item.label}`} title={`Restore ${singular.toLowerCase()}`} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-wait disabled:opacity-50"><RestoreIcon /></button> : <span className="px-2 text-slate-400">—</span>}
              </div></td>}
            </tr>
          ))}
        </tbody></table>{!loading && !error && items.length === 0 && <div className="border-t border-slate-100 px-6 py-14 text-center"><p className="text-sm font-semibold text-slate-800">No {kind} found</p><p className="mt-1 text-xs text-slate-500">Try a different search or status filter.</p></div>}</div>
        <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p aria-live="polite" className="text-xs font-medium text-slate-600">{loading ? `Loading ${kind}…` : error ? `${singular} records unavailable` : `Showing ${start}–${end} of ${pagination.total}`}</p><nav aria-label={`${singular} table pagination`} className="flex items-center gap-1"><button type="button" onClick={() => setPage(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:text-slate-400">Previous</button>{pages(pagination.page, pagination.totalPages).map((p) => <button key={p} type="button" onClick={() => setPage(p)} disabled={loading} aria-label={`Page ${p}`} aria-current={p === pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-md border text-xs font-bold ${p === pagination.page ? "border-blue-800 bg-blue-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{p}</button>)}<button type="button" onClick={() => setPage(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:text-slate-400">Next</button></nav></div>
      </section>

      {panelOpen && <div className="fixed inset-0 z-50"><button type="button" aria-label={`Close ${singular.toLowerCase()} form`} onClick={() => setPanelOpen(false)} className="absolute inset-0 bg-slate-950/50" /><aside role="dialog" aria-modal="true" aria-labelledby="lookup-panel-title" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-300 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.14)]">
        <header className="flex items-start justify-between gap-6 border-b border-slate-300 px-6 py-6 sm:px-8"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">Human Resources / {singular} record</p><h2 id="lookup-panel-title" className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">{selected ? `Edit ${singular.toLowerCase()}` : `Add ${singular.toLowerCase()}`}</h2></div><button type="button" onClick={() => setPanelOpen(false)} aria-label={`Close ${singular.toLowerCase()} form`} className="grid h-10 w-10 place-items-center rounded-md text-xl text-slate-500 hover:bg-slate-100">×</button></header>
        <form onSubmit={save} className="flex flex-1 flex-col"><div className="flex-1 space-y-5 px-6 py-7 sm:px-8">
          <label className="block"><span className="mb-2 block text-xs font-bold text-slate-700">{isJobs ? "Job code" : "Department code"}</span><input required maxLength={codeMax} readOnly={Boolean(selected)} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={isJobs ? "e.g. DEV" : "e.g. IT"} className={`h-11 w-full rounded-md border border-slate-300 px-3 font-mono text-sm uppercase outline-none ${selected ? "bg-slate-100 text-slate-500" : "bg-white text-slate-900 focus:border-blue-700 focus:ring-3 focus:ring-blue-100"}`} /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-slate-700">{isJobs ? "Description" : "Department name"}</span><input required maxLength={20} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={isJobs ? "Enter job title" : "Enter department name"} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-700 focus:ring-3 focus:ring-blue-100" /></label>
          {formError && <p role="alert" className="text-sm font-semibold text-red-700">{formError}</p>}
        </div><footer className="flex items-center justify-end gap-3 border-t border-slate-300 px-6 py-4 sm:px-8"><button type="button" onClick={() => setPanelOpen(false)} className="h-11 rounded-md border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50">{saving ? "Saving…" : selected ? "Save changes" : `Create ${singular.toLowerCase()}`}</button></footer></form>
      </aside></div>}

      {toArchive && <div className="fixed inset-0 z-[60] grid place-items-center px-4 py-8"><button type="button" aria-label="Cancel archive" onClick={() => { if (!archiving) setToArchive(null) }} className="absolute inset-0 bg-slate-950/70" /><section role="alertdialog" aria-modal="true" aria-labelledby="archive-lookup-title" className="relative w-full max-w-lg overflow-hidden rounded-lg border border-slate-300 border-t-[3px] border-t-red-600 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.30)]"><div className="px-6 pb-7 pt-8 text-center sm:px-9"><h2 id="archive-lookup-title" className="text-2xl font-bold text-slate-950">Archive this {singular.toLowerCase()}?</h2><p className="mt-2 text-sm font-semibold text-slate-700">{toArchive.code} — {toArchive.label}</p><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600">Records linked to active job-history entries cannot be archived.</p></div>{archiveError && <p role="alert" className="px-6 pb-4 text-sm font-semibold text-red-700 sm:px-9">{archiveError}</p>}<div className="grid grid-cols-2 gap-3 border-t border-slate-300 bg-slate-50 px-5 py-4 sm:px-8"><button type="button" onClick={() => setToArchive(null)} disabled={archiving} className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700">Cancel</button><button type="button" onClick={archive} disabled={archiving} className="h-11 rounded-md bg-red-700 px-3 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-70">{archiving ? "Archiving…" : `Archive ${singular.toLowerCase()}`}</button></div></section></div>}
    </>
  )
}
