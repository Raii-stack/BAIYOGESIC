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
    <div id={`job-history-${empno}`} className="workspace-history">
      <div className="grid gap-5 lg:grid-cols-[minmax(180px,0.45fr)_minmax(320px,1fr)]">
        <div>
          <p className="text-sm font-semibold text-neutral-700">Job history</p>
          <p className="mt-2 font-mono text-sm font-semibold text-neutral-900">{empno}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Recorded positions, departments, and compensation for {fullName}.</p>
        </div>
        <div className="workspace-panel" aria-busy={loading}>
          {loading ? <div className="space-y-3 p-4" aria-label="Loading job history">{[0, 1, 2].map((item) => <div key={item} className="h-4 animate-pulse rounded bg-slate-200" />)}</div>
            : error ? <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline">Retry</button></div>
              : entries.length === 0 ? <p className="p-4 text-sm text-slate-500">No job history recorded.</p>
                : <table className="workspace-table">
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
  return <section aria-label="Employee records" className="workspace-panel">
    <div className="workspace-table-header"><div><h2 className="text-sm font-semibold text-neutral-900">Personnel register</h2><p className="mt-0.5 text-xs text-slate-500">Employee records, personal details, and employment status</p></div><span className="workspace-badge workspace-badge--neutral">{loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}</span></div>
    <div className="overflow-x-auto" aria-busy={loading}><table className="workspace-table min-w-[1160px]"><thead><tr className="border-b border-slate-200 bg-slate-50">{headings.map((heading) => <th key={heading} scope="col" className={`workspace-table-heading ${heading === "Actions" ? "workspace-table-actions" : ""}`}>{heading}</th>)}</tr></thead><tbody>
      {loading ? Array.from({ length: 8 }, (_, index) => <tr key={index} aria-hidden="true" className="border-b border-slate-100">{Array.from({ length: headings.length }, (_, column) => <td key={column}><div className="h-3.5 max-w-full animate-pulse rounded bg-slate-200" style={{ width: column === 1 || column === 2 ? 110 : column === 8 ? 140 : 72 }} /></td>)}</tr>) : employees.map((employee) => {
        const status = employee.archived ? "Archived" : employee.separationDate ? "Separated" : "Active"
        const expanded = expandedEmployee === employee.id
        return <Fragment key={employee.id}>
          <tr className={`border-b border-slate-100 transition-colors last:border-0 ${expanded ? "is-expanded" : employee.archived ? "is-muted" : "hover:bg-neutral-50"}`}>
            <td className="whitespace-nowrap font-mono text-xs font-medium text-neutral-600"><Link to={`/employees/${encodeURIComponent(employee.id)}?view=details`} className="underline-offset-4 hover:underline">{employee.id}</Link></td>
            <td className="text-[13px] font-medium text-neutral-900">{employee.lastName || "—"}</td>
            <td><Link to={`/employees/${encodeURIComponent(employee.id)}?view=details`} className="text-[13px] font-medium text-neutral-900 underline-offset-4 hover:text-blue-800 hover:underline">{employee.firstName || "—"} <span className="sr-only">{employee.fullName}</span></Link><p className="mt-0.5 text-xs text-slate-500">{employee.email || "—"}</p>{!employee.canViewSalary && <span aria-label="Salary hidden due to permissions" className="sr-only">••••••</span>}</td>
            <td className="whitespace-nowrap text-sm font-medium text-slate-700">{employee.gender || "—"}</td>
            <td className="whitespace-nowrap font-mono text-xs text-slate-600">{employee.birthDate || "—"}</td>
            <td className="whitespace-nowrap font-mono text-xs text-slate-600">{employee.hireDate || "—"}</td>
            <td className="whitespace-nowrap font-mono text-xs text-slate-600">{employee.separationDate || "—"}</td>
            <td className="whitespace-nowrap"><span className={`workspace-badge ${status === "Active" ? "bg-emerald-100 text-emerald-800" : status === "Separated" ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-600"}`}>{status}</span></td>
            <td className="max-w-52 font-mono text-[11px] leading-5 text-slate-500">{employee.stamp || "—"}</td>
            <td className={`workspace-table-actions ${employee.archived ? "bg-slate-50" : "bg-white"}`}><div className="flex items-center gap-1">
              <button type="button" aria-label={`${expanded ? "Hide" : "Show"} job history for ${employee.fullName}`} aria-expanded={expanded} aria-controls={`job-history-${employee.id}`} title="Job history" onClick={() => setExpandedEmployee(expanded ? null : employee.id)} className="workspace-icon-action"><HistoryIcon /></button>
              {!employee.archived ? <>
                {canEdit && <button type="button" onClick={() => onEdit(employee)} aria-label={`Edit ${employee.fullName}`} title="Edit employee" className="workspace-icon-action"><EditIcon /></button>}
                {canDelete && onArchive && <button type="button" onClick={() => onArchive(employee)} aria-label={`Archive ${employee.fullName}`} title="Archive employee" className="workspace-icon-action workspace-icon-action--danger"><ArchiveIcon /></button>}
              </> : canDelete && onRestore ? <button type="button" onClick={() => onRestore(employee)} disabled={restoringId === employee.id} aria-label={`Restore ${employee.fullName}`} title="Restore employee" className="workspace-icon-action"><RestoreIcon /></button> : null}
            </div></td>
          </tr>
          {expanded && <tr className="border-b border-slate-200"><td colSpan={headings.length} className="workspace-table-expansion"><JobHistory empno={employee.id} fullName={employee.fullName} /></td></tr>}
        </Fragment>
      })}
    </tbody></table>{!loading && !error && employees.length === 0 && <div className="workspace-empty-state"><p className="text-sm font-semibold text-slate-800">No employees found</p><p className="mt-1 text-xs text-slate-500">Try a different search or filter.</p></div>}</div>
    <div className="workspace-table-footer"><p aria-live="polite" className="text-xs font-medium text-slate-600">{loading ? "Loading employee records…" : error ? "Employee records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}</p><nav aria-label="Employee table pagination" className="workspace-pagination"><button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1}>Previous</button>{pages(pagination.page, pagination.totalPages).map((page) => <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined}>{page}</button>)}<button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>Next</button></nav></div>
  </section>
}
