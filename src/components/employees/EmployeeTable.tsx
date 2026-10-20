import { Fragment, useEffect, useState } from "react"
import { Link } from "react-router"
import { employeeApi, type EmployeePagination } from "../../lib/employee-api"
import type { Employee, JobHistoryEntry } from "../../types/employee"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const pages = (current: number, total: number) => { const count = Math.min(total, 5); const start = Math.max(1, Math.min(current - 2, total - count + 1)); return Array.from({ length: count }, (_, i) => start + i) }

function HistoryIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" /></svg>
}

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m14 5 5 5M4 20l3.5-.7L20 6.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" /></svg>
}

function ArchiveIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></svg>
}

function RestoreIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
}

function JobHistory({ empno, fullName }: { empno: string; fullName: string }) {
  const [entries, setEntries] = useState<JobHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    employeeApi.get(empno, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setEntries(result.history) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load job history.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [empno, retry])

  return (
    <div id={`job-history-${empno}`} className="border-l-[3px] border-blue-800 bg-slate-50 px-5 py-5 sm:px-7">
      <div className="grid gap-5 lg:grid-cols-[minmax(180px,0.45fr)_minmax(320px,1fr)]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-800">Job history</p>
          <p className="mt-2 font-mono text-sm font-bold text-slate-900">{empno}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Recorded positions, departments, and compensation for {fullName}.</p>
        </div>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-busy={loading}>
          {loading ? <div className="space-y-3 p-4" aria-label="Loading job history">{[0, 1, 2].map((item) => <div key={item} className="h-4 animate-pulse rounded bg-slate-200" />)}</div>
            : error ? <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline">Retry</button></div>
              : entries.length === 0 ? <p className="p-4 text-sm text-slate-500">No job history recorded.</p>
                : <table className="w-full text-left">
                  <thead><tr className="border-b border-slate-200 bg-white text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"><th className="px-4 py-3">Effective date</th><th className="px-4 py-3">Job title</th><th className="px-4 py-3">Department</th><th className="px-4 py-3 text-right">Salary</th><th className="hidden px-4 py-3 sm:table-cell">Last change</th></tr></thead>
                  <tbody>{entries.map((entry) => <tr key={entry.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-mono text-xs text-slate-600">{entry.effectiveDate}</td><td className="px-4 py-3 text-xs font-semibold text-slate-900">{entry.jobTitle}</td><td className="px-4 py-3 text-xs text-slate-700">{entry.department}</td><td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-900">{entry.canViewSalary ? money.format(entry.salary) : <span className="text-slate-400">••••••</span>}</td><td className="hidden px-4 py-3 font-mono text-[11px] text-slate-500 sm:table-cell">{entry.stamp || "—"}</td></tr>)}</tbody>
                </table>}
        </div>
      </div>
    </div>
  )
}

export default function EmployeeTable({ employees, pagination, loading, error, onPageChange, onEdit, onArchive, onRestore, restoringId, canEdit, canDelete = false }: {
  employees: Employee[]; pagination: EmployeePagination; loading: boolean; error: boolean
  onPageChange: (page: number) => void; onEdit: (employee: Employee) => void; onArchive?: (employee: Employee) => void; onRestore?: (employee: Employee) => void; restoringId?: string | null; canEdit: boolean; canDelete?: boolean
}) {
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + employees.length - 1, pagination.total) : 0
  const headings = ["Emp No", "Last name", "First name", "Gender", "Birth date", "Hire date", "Sep date", "Status", "Last change", "Actions"]
  return <section aria-label="Employee records" className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,39,67,0.05)]">
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4"><div><h2 className="text-sm font-bold text-slate-900">Personnel register</h2><p className="mt-0.5 text-xs text-slate-500">Employee records, personal details, and employment status</p></div><span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}</span></div>
    <div className="overflow-x-auto" aria-busy={loading}><table className="w-full min-w-[1160px] border-collapse text-left"><thead><tr className="border-b border-slate-200 bg-slate-50">{headings.map((heading) => <th key={heading} scope="col" className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pl-6 last:pr-6 ${heading === "Actions" ? "sticky right-0 z-10 border-l border-slate-200 bg-slate-50" : ""}`}>{heading}</th>)}</tr></thead><tbody>
      {loading ? Array.from({ length: 8 }, (_, index) => <tr key={index} aria-hidden="true" className="border-b border-slate-100">{Array.from({ length: headings.length }, (_, column) => <td key={column} className="px-5 py-5"><div className="h-3.5 max-w-full animate-pulse rounded bg-slate-200" style={{ width: column === 1 || column === 2 ? 110 : column === 8 ? 140 : 72 }} /></td>)}</tr>) : employees.map((employee) => {
        const status = employee.archived ? "Archived" : employee.separationDate ? "Separated" : "Active"
        const expanded = expandedEmployee === employee.id
        return <Fragment key={employee.id}>
          <tr className={`border-b border-slate-100 transition-colors last:border-0 ${expanded ? "bg-blue-50/60" : employee.archived ? "bg-slate-50/70 hover:bg-slate-100" : "hover:bg-blue-50/40"}`}>
            <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold text-blue-800"><Link to={`/employees/${encodeURIComponent(employee.id)}`} className="underline-offset-4 hover:underline">{employee.id}</Link></td>
            <td className="px-5 py-4 text-sm font-semibold text-slate-950">{employee.lastName || "—"}</td>
            <td className="px-5 py-4"><Link to={`/employees/${encodeURIComponent(employee.id)}`} className="text-sm font-semibold text-slate-900 underline-offset-4 hover:text-blue-800 hover:underline">{employee.firstName || "—"} <span className="sr-only">{employee.fullName}</span></Link><p className="mt-0.5 text-xs text-slate-500">{employee.email || "—"}</p>{!employee.canViewSalary && <span aria-label="Salary hidden due to permissions" className="sr-only">••••••</span>}</td>
            <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-700">{employee.gender || "—"}</td>
            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{employee.birthDate || "—"}</td>
            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{employee.hireDate || "—"}</td>
            <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{employee.separationDate || "—"}</td>
            <td className="whitespace-nowrap px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === "Active" ? "bg-emerald-100 text-emerald-800" : status === "Separated" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"}`}>{status}</span></td>
            <td className="max-w-52 px-5 py-4 font-mono text-[11px] leading-5 text-slate-500">{employee.stamp || "—"}</td>
            <td className={`sticky right-0 z-10 border-l border-slate-100 px-5 py-4 pr-6 ${employee.archived ? "bg-slate-50" : "bg-white"}`}><div className="flex items-center gap-1">
              <button type="button" aria-label={`${expanded ? "Hide" : "Show"} job history for ${employee.fullName}`} aria-expanded={expanded} aria-controls={`job-history-${employee.id}`} title="Job history" onClick={() => setExpandedEmployee(expanded ? null : employee.id)} className={`grid h-9 w-9 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${expanded ? "bg-blue-800 text-white" : "text-slate-500 hover:bg-blue-100 hover:text-blue-800"}`}><HistoryIcon /></button>
              {!employee.archived ? <>
                {canEdit && <button type="button" onClick={() => onEdit(employee)} aria-label={`Edit ${employee.fullName}`} title="Edit employee" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-blue-100 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><EditIcon /></button>}
                {canDelete && onArchive && <button type="button" onClick={() => onArchive(employee)} aria-label={`Archive ${employee.fullName}`} title="Archive employee" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"><ArchiveIcon /></button>}
              </> : canDelete && onRestore ? <button type="button" onClick={() => onRestore(employee)} disabled={restoringId === employee.id} aria-label={`Restore ${employee.fullName}`} title="Restore employee" className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-wait disabled:opacity-50"><RestoreIcon /></button> : null}
            </div></td>
          </tr>
          {expanded && <tr className="border-b border-slate-200"><td colSpan={headings.length} className="p-0"><JobHistory empno={employee.id} fullName={employee.fullName} /></td></tr>}
        </Fragment>
      })}
    </tbody></table>{!loading && !error && employees.length === 0 && <div className="border-t border-slate-100 px-6 py-14 text-center"><p className="text-sm font-semibold text-slate-800">No employees found</p><p className="mt-1 text-xs text-slate-500">Try a different search or filter.</p></div>}</div>
    <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p aria-live="polite" className="text-xs font-medium text-slate-600">{loading ? "Loading employee records…" : error ? "Employee records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}</p><nav aria-label="Employee table pagination" className="flex items-center gap-1"><button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:text-slate-400">Previous</button>{pages(pagination.page, pagination.totalPages).map((page) => <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-md border text-xs font-bold ${page === pagination.page ? "border-blue-800 bg-blue-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{page}</button>)}<button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:text-slate-400">Next</button></nav></div>
  </section>
}
