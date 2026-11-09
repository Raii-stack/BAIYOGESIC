import { TableSkeletonRows } from "../common/TableSkeleton"
import { Fragment, useEffect, useState } from "react"
import { Link } from "react-router"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import { employeeApi, type EmployeePagination } from "../../lib/employee-api"
import type { Employee, JobHistoryEntry } from "../../types/employee"
import JobTimeline from "./JobTimeline"
import { CareerTimelineSkeleton } from "./CareerTimeline"

const pages = (current: number, total: number) => {
  const count = Math.min(total, 5)
  const start = Math.max(1, Math.min(current - 2, total - count + 1))
  return Array.from({ length: count }, (_, i) => start + i)
}

function JobHistory({
  empno,
  fullName,
  showAudit,
  canViewSalary,
}: {
  empno: string
  fullName: string
  showAudit: boolean
  canViewSalary?: boolean
}) {
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
          {loading ? (
            <CareerTimelineSkeleton showAudit={showAudit} />
          ) : error ? (
            <div role="alert" className="flex items-center justify-between gap-3 p-4 text-sm text-red-700">
              <span>{error}</span>
              <button type="button" onClick={() => setRetry((value) => value + 1)} className="font-semibold underline">Retry</button>
            </div>
          ) : (
            <JobTimeline entries={entries} showAudit={showAudit} canViewSalary={canViewSalary} />
          )}
        </div>
      </div>
    </div>
  )
}

export default function EmployeeTable({
  employees,
  pagination,
  loading,
  error,
  onPageChange,
  onEdit,
  onArchive,
  onRestore,
  restoringId,
  canEdit,
  canDelete = false,
  canViewHistory = false,
  canViewAudit = false,
  canViewSalary = false,
}: {
  employees: Employee[]
  pagination: EmployeePagination
  loading: boolean
  error: boolean
  onPageChange: (page: number) => void
  onEdit: (employee: Employee) => void
  onArchive?: (employee: Employee) => void
  onRestore?: (employee: Employee) => void
  restoringId?: string | null
  canEdit: boolean
  canDelete?: boolean
  canViewHistory?: boolean
  canViewAudit?: boolean
  canViewSalary?: boolean
}) {
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null)
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + employees.length - 1, pagination.total) : 0
  const headings = ["Emp No", "Last name", "First name", "Gender", "Birth date", "Hire date", "Sep date", "Status", ...(canViewAudit ? ["Last change"] : []), "Actions"]
  return (
    <section aria-label="Employee records" className="workspace-panel">
      <div className="workspace-table-header">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Personnel register</h2>
          <p className="mt-0.5 text-xs text-slate-500">Employee records, personal details, and employment status</p>
        </div>
        <span className="workspace-badge workspace-badge--neutral">
          {loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}
        </span>
      </div>
      <div className="overflow-x-auto" aria-busy={loading}>
        <table role="table" className="workspace-table min-w-[1160px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {headings.map((heading) => (
                <th key={heading} scope="col" className={`workspace-table-heading ${heading === "Actions" ? "workspace-table-actions" : ""}`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows headings={headings} />
            ) : employees.map((employee) => {
              const isBlocked = Boolean(employee.isBlocked)
              const userStatus = String(employee.userStatus || "").trim().toLowerCase()
              const isRejected = userStatus === "disabled" || userStatus === "rejected"
              const isPending = userStatus === "pending"
              const status = employee.archived
                ? "Archived"
                : employee.separationDate
                  ? "Separated"
                  : isBlocked
                    ? "Blocked"
                    : isRejected
                      ? (userStatus === "rejected" ? "Rejected" : "Disabled")
                      : isPending
                        ? "Pending"
                        : "Active"
              const statusBadgeStyle =
                status === "Active"
                  ? "bg-emerald-100 text-emerald-800"
                  : status === "Separated" || status === "Pending"
                    ? "bg-amber-100 text-amber-900"
                    : status === "Blocked"
                      ? "bg-red-100 text-red-800"
                      : "bg-neutral-100 text-neutral-600"
              const expanded = expandedEmployee === employee.id
              return (
                <Fragment key={employee.id}>
                  <tr className={`border-b border-slate-100 transition-colors last:border-0 ${expanded ? "is-expanded" : employee.archived ? "is-muted" : isBlocked ? "bg-red-50/40 hover:bg-red-50/70" : "hover:bg-neutral-50"}`}>
                    <td data-label="Emp No" className="whitespace-nowrap font-mono text-xs font-medium text-neutral-600">
                      <Link to={`/employees/${encodeURIComponent(employee.id)}?view=details`} className="underline-offset-4 hover:underline">
                        {employee.id}
                      </Link>
                    </td>
                    <td data-label="Last name" className="text-[13px] font-medium text-neutral-900">
                      {employee.lastName || "—"}
                    </td>
                    <td data-label="First name">
                      <Link to={`/employees/${encodeURIComponent(employee.id)}?view=details`} className="text-[13px] font-medium text-neutral-900 underline-offset-4 hover:text-blue-800 hover:underline">
                        {employee.firstName || "—"} <span className="sr-only">{employee.fullName}</span>
                      </Link>
                    </td>
                    <td data-label="Gender" className="whitespace-nowrap text-sm font-medium text-slate-700">
                      {employee.gender || "—"}
                    </td>
                    <td data-label="Birth date" className="whitespace-nowrap font-mono text-xs text-slate-600">
                      {employee.birthDate || "—"}
                    </td>
                    <td data-label="Hire date" className="whitespace-nowrap font-mono text-xs text-slate-600">
                      {employee.hireDate || "—"}
                    </td>
                    <td data-label="Sep date" className="whitespace-nowrap font-mono text-xs text-slate-600">
                      {employee.separationDate || "—"}
                    </td>
                    <td data-label="Status" className="whitespace-nowrap">
                      <span className={`workspace-badge ${statusBadgeStyle}`}>
                        {status}
                      </span>
                    </td>
                    {canViewAudit && <td data-label="Last change" className="max-w-52 font-mono text-[11px] leading-5 text-slate-500">{employee.stamp || "—"}</td>}
                    <td data-label="Actions" className={`workspace-table-actions ${employee.archived ? "bg-slate-50" : "bg-white"}`}>
                      <div className="flex items-center gap-1">
                        {canViewHistory && (
                          <button
                            type="button"
                            aria-label={`${expanded ? "Hide" : "Show"} job history for ${employee.fullName}`}
                            aria-expanded={expanded}
                            aria-controls={`job-history-${employee.id}`}
                            title="Job history"
                            onClick={() => setExpandedEmployee(expanded ? null : employee.id)}
                            className="workspace-icon-action"
                          >
                            <DashboardIcon name="history" className="h-4 w-4" />
                          </button>
                        )}
                        {!employee.archived ? (
                          <>
                            {canEdit && employee.canManage !== false && (
                              <button
                                type="button"
                                onClick={() => onEdit(employee)}
                                aria-label={`Edit ${employee.fullName}`}
                                title="Edit employee"
                                className="workspace-icon-action workspace-icon-action--primary"
                              >
                                <DashboardIcon name="edit" className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && employee.canManage !== false && onArchive && (
                              <button
                                type="button"
                                onClick={() => onArchive(employee)}
                                aria-label={`Archive ${employee.fullName}`}
                                title="Archive employee"
                                className="workspace-icon-action workspace-icon-action--danger"
                              >
                                <DashboardIcon name="archive" className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        ) : canDelete && employee.canManage !== false && onRestore ? (
                          <button
                            type="button"
                            onClick={() => onRestore(employee)}
                            disabled={restoringId === employee.id}
                            aria-label={`Restore ${employee.fullName}`}
                            title="Restore employee"
                            className="workspace-icon-action workspace-icon-action--success"
                          >
                            <DashboardIcon name="restore" className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expanded && canViewHistory && (
                    <tr aria-label="Job history" className="border-b border-slate-200">
                      <td colSpan={headings.length} className="workspace-table-expansion">
                        <JobHistory
                          empno={employee.id}
                          fullName={employee.fullName}
                          showAudit={canViewAudit}
                          canViewSalary={canViewSalary}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!loading && !error && employees.length === 0 && (
          <div className="workspace-empty-state">
            <p className="text-sm font-semibold text-slate-800">No employees found</p>
            <p className="mt-1 text-xs text-slate-500">Try a different search or filter.</p>
          </div>
        )}
      </div>
      <div className="workspace-table-footer">
        <p aria-live="polite" className="text-xs font-medium text-slate-600">
          {loading ? "Loading employee records…" : error ? "Employee records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}
        </p>
        <nav aria-label="Employee table pagination" className="workspace-pagination">
          <button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1}>
            Previous
          </button>
          {pages(pagination.page, pagination.totalPages).map((page) => (
            <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined}>
              {page}
            </button>
          ))}
          <button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>
            Next
          </button>
        </nav>
      </div>
    </section>
  )
}
