import { useEffect, useRef, useState } from "react"
import { auditLogApi, type AuditLogEntry, type AuditLogPagination } from "../../lib/audit-log-api"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import useDebouncedValue from "../../hooks/useDebouncedValue"
import type { AuditLogResult } from "../../lib/audit-log-api"

const PAGE_SIZE = 10

function visiblePages(page: number, totalPages: number) {
  const count = Math.min(totalPages, 5)
  const start = Math.max(1, Math.min(page - 2, totalPages - count + 1))
  return Array.from({ length: count }, (_, index) => start + index)
}

const AVAILABLE_TABLES = [
  "all",
  "sales",
  "salesdetail",
  "payment",
  "customer",
  "product",
  "pricehist",
  "employee",
  "jobhistory",
  "department",
  "job",
  "app_user",
  "app_user_right",
] as const

const AVAILABLE_ACTIONS = ["all", "INSERT", "UPDATE", "DELETE"] as const

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogResult["logs"]>([])
  const [pagination, setPagination] = useState<AuditLogPagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filter states
  const [selectedTable, setSelectedTable] = useState<string>("all")
  const [selectedAction, setSelectedAction] = useState<string>("all")
  const [actorQuery, setActorQuery] = useState<string>("")
  const debouncedActor = useDebouncedValue(actorQuery.trim())
  const searchPending = actorQuery.trim() !== debouncedActor
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [page, setPage] = useState<number>(1)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)
  const [inspectingId, setInspectingId] = useState<string | null>(null)
  const [detailError, setDetailError] = useState("")
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    if (searchPending) { setLoading(true); return }
    const controller = new AbortController()
    setLoading(true)
    setError("")

    auditLogApi
      .list(
        {
          tableName: selectedTable !== "all" ? selectedTable : undefined,
          action: selectedAction !== "all" ? selectedAction : undefined,
          username: debouncedActor || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          limit: PAGE_SIZE,
        },
        controller.signal,
      )
      .then((data) => {
        if (!controller.signal.aborted) {
          if (page > data.pagination.totalPages) {
            setPage(Math.max(1, data.pagination.totalPages))
            return
          }
          setLogs(data.logs)
          setPagination(data.pagination)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load audit logs.")
          setLogs([])
          setPagination({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [selectedTable, selectedAction, debouncedActor, searchPending, startDate, endDate, page, refreshTrigger])

  useEffect(() => {
    if (!inspectingId) return
    const controller = new AbortController()
    setDetailError("")
    auditLogApi.get(inspectingId, controller.signal)
      .then((entry) => { if (!controller.signal.aborted) setSelectedEntry(entry) })
      .catch((reason) => { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : "Unable to load audit details.") })
      .finally(() => { if (!controller.signal.aborted) setInspectingId(null) })
    return () => controller.abort()
  }, [inspectingId])

  const clearFilters = () => {
    setSelectedTable("all")
    setSelectedAction("all")
    setActorQuery("")
    setStartDate("")
    setEndDate("")
    setPage(1)
  }

  const hasActiveFilters =
    selectedTable !== "all" ||
    selectedAction !== "all" ||
    actorQuery.trim() !== "" ||
    startDate !== "" ||
    endDate !== ""

  return (
    <div className="space-y-4">
      {/* Immutability Banner */}
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900"
      >
        <DashboardIcon name="lock" className="h-4 w-4 shrink-0 text-sky-700" />
        <span>
          <strong>Append-Only Audit Log:</strong> Records are immutable and tamper-evident. Modification and deletion of audit trail entries are strictly prevented at the database level.
        </span>
      </div>

      {/* Filter Controls Bar */}
      <section aria-label="Audit log filters" className="workspace-panel workspace-filters">
        <label className="workspace-filter-search">
          <span className="workspace-label">Search user / actor</span>
          <span className="relative block">
            <DashboardIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              type="search"
              aria-label="Search by user or actor"
              value={actorQuery}
              onChange={(e) => {
                setActorQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Username, email, or actor"
              className="workspace-control workspace-control--search"
            />
          </span>
        </label>

        <label>
          <span className="workspace-label">Table</span>
          <span className="relative block">
            <select
              aria-label="Filter by table"
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value)
                setPage(1)
              }}
              className="workspace-control"
            >
              <option value="all">All tables</option>
              {AVAILABLE_TABLES.filter((t) => t !== "all").map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label>
          <span className="workspace-label">Action</span>
          <span className="relative block">
            <select
              aria-label="Filter by action"
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value)
                setPage(1)
              }}
              className="workspace-control"
            >
              <option value="all">All actions</option>
              <option value="INSERT">INSERT (Add)</option>
              <option value="UPDATE">UPDATE (Edit)</option>
              <option value="DELETE">DELETE (Remove)</option>
              <option value="RESTORE">RESTORE</option>
            </select>
          </span>
        </label>

        <label>
          <span className="workspace-label">From date</span>
          <input
            type="date"
            aria-label="Filter from date"
            max={endDate || undefined}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            className="workspace-control"
          />
        </label>

        <label>
          <span className="workspace-label">To date</span>
          <input
            type="date"
            aria-label="Filter to date"
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            className="workspace-control"
          />
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="workspace-secondary-action self-end"
          >
            Clear filters
          </button>
        )}
      </section>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshTrigger((c) => c + 1)}
            className="underline underline-offset-4 hover:text-red-950"
          >
            Try again
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      {detailError && <p role="alert" className="text-sm text-red-700">{detailError}</p>}
      <div className="workspace-panel">
        <div className="workspace-table-header">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Audit Trail</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              System change log and entity modification snapshots
            </p>
          </div>
          <span className="workspace-badge workspace-badge--neutral">
            {loading ? "Loading…" : `${pagination.total} records`}
          </span>
        </div>

        <div className="workspace-table-scroll">
          <table role="table" aria-label="Audit log table" className="workspace-table min-w-[840px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th scope="col" className="workspace-table-heading">Timestamp</th>
                <th scope="col" className="workspace-table-heading">Table</th>
                <th scope="col" className="workspace-table-heading">Action</th>
                <th scope="col" className="workspace-table-heading">Record Key</th>
                <th scope="col" className="workspace-table-heading">Actor</th>
                <th scope="col" className="workspace-table-heading text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse border-b border-slate-100">
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-slate-200" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-slate-200" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-slate-200" /></td>
                    <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-12 rounded bg-slate-200" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    No audit records found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.auditId}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                  >
                    <td data-label="Timestamp" className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {formatTimestamp(log.actionAt)}
                    </td>
                    <td data-label="Table" className="px-4 py-3 text-xs font-semibold text-slate-800">
                      <code>{log.tableName}</code>
                    </td>
                    <td data-label="Action" className="px-4 py-3 text-xs">
                      <ActionBadge action={log.action} />
                    </td>
                    <td data-label="Record Key" className="px-4 py-3 text-xs font-mono text-slate-700">
                      {log.recordKey || "—"}
                    </td>
                    <td data-label="Actor" className="px-4 py-3 text-xs text-slate-700">
                      {log.actionBy || "system"}
                    </td>
                    <td data-label="Details" className="px-4 py-3 text-right text-xs">
                      <button
                        type="button"
                        onClick={() => setInspectingId(log.auditId)}
                        disabled={Boolean(inspectingId)}
                        aria-label={`View diff for audit entry ${log.auditId}`}
                        className="workspace-text-action font-medium text-blue-600 hover:text-blue-800"
                      >
                        {inspectingId === log.auditId ? "Loading…" : "Inspect Diff"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="workspace-table-footer">
          <p aria-live="polite">
            {loading ? "Loading audit records…" : error ? "Audit records unavailable" : `Showing ${pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}`}
          </p>
          <nav aria-label="Audit log pagination" className="workspace-pagination">
            <button
              type="button"
              disabled={loading || Boolean(error) || pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {visiblePages(pagination.page, pagination.totalPages).map((number) => (
              <button key={number} type="button" onClick={() => setPage(number)} disabled={loading || Boolean(error)} aria-label={`Page ${number}`} aria-current={number === pagination.page ? "page" : undefined}>{number}</button>
            ))}
            <button
              type="button"
              disabled={loading || Boolean(error) || pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </nav>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      {selectedEntry && (
        <DiffInspectorModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const norm = action.toUpperCase()
  let style = "bg-slate-100 text-slate-700 border-slate-300"
  if (norm === "INSERT" || norm === "ADD") {
    style = "bg-emerald-50 text-emerald-700 border-emerald-300"
  } else if (norm === "UPDATE" || norm === "EDIT") {
    style = "bg-amber-50 text-amber-700 border-amber-300"
  } else if (norm === "DELETE" || norm === "REMOVE") {
    style = "bg-rose-50 text-rose-700 border-rose-300"
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wider ${style}`}>
      {action}
    </span>
  )
}

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) return isoString
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  } catch {
    return isoString
  }
}

export function DiffInspectorModal({
  entry,
  onClose,
}: {
  entry: AuditLogEntry
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const isUpdate = entry.action.toUpperCase() === "UPDATE" || entry.action.toUpperCase() === "EDIT"
  const isInsert = entry.action.toUpperCase() === "INSERT" || entry.action.toUpperCase() === "ADD"
  const isDelete = entry.action.toUpperCase() === "DELETE" || entry.action.toUpperCase() === "REMOVE"

  const oldObj = entry.oldValues || {}
  const newObj = entry.newValues || {}
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)])).sort()

  const diffRows = allKeys.map((key) => {
    const oldVal = oldObj[key]
    const newVal = newObj[key]
    const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal)
    return { key, oldVal, newVal, changed }
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="diff-inspector-title" className="text-base font-bold text-slate-900">
              Audit Entry #{entry.auditId}: Diff Inspector
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {entry.tableName} &bull; {entry.action} &bull; Key: {entry.recordKey || "N/A"}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close diff inspector"
            className="workspace-text-action text-slate-400 hover:text-slate-700"
          >
            <DashboardIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Metadata summary */}
        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-3 text-xs sm:grid-cols-4">
          <div>
            <span className="block font-medium text-slate-400 uppercase tracking-wider text-[10px]">Table</span>
            <span className="font-semibold text-slate-800">{entry.tableName}</span>
          </div>
          <div>
            <span className="block font-medium text-slate-400 uppercase tracking-wider text-[10px]">Action</span>
            <ActionBadge action={entry.action} />
          </div>
          <div>
            <span className="block font-medium text-slate-400 uppercase tracking-wider text-[10px]">Actor</span>
            <span className="font-medium text-slate-700">{entry.actionBy || "system"}</span>
          </div>
          <div>
            <span className="block font-medium text-slate-400 uppercase tracking-wider text-[10px]">Timestamp</span>
            <span className="text-slate-600">{formatTimestamp(entry.actionAt)}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isUpdate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Field Delta Comparison (Old vs New)
                </span>
                <span className="text-xs text-slate-500">
                  {diffRows.filter((r) => r.changed).length} changed fields
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold text-slate-700">Field</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-red-700 bg-red-50/50">Old Value</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-emerald-700 bg-emerald-50/50">New Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {diffRows.map(({ key, oldVal, newVal, changed }) => (
                      <tr
                        key={key}
                        className={changed ? "bg-amber-50/30 font-medium" : "text-slate-600"}
                      >
                        <td className="px-3 py-2 text-slate-800 font-sans">
                          {key}
                          {changed && (
                            <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.2 text-[10px] text-amber-800 font-mono">
                              MODIFIED
                            </span>
                          )}
                        </td>
                        <td className={`px-3 py-2 ${changed ? "bg-red-50/60 text-red-800" : ""}`}>
                          {formatJsonValue(oldVal)}
                        </td>
                        <td className={`px-3 py-2 ${changed ? "bg-emerald-50/60 text-emerald-800" : ""}`}>
                          {formatJsonValue(newVal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isInsert && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Created Row Attributes (New Values)
              </span>
              <pre className="max-h-96 overflow-auto rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 font-mono text-xs text-slate-800">
                {JSON.stringify(entry.newValues, null, 2)}
              </pre>
            </div>
          )}

          {isDelete && (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                Deleted Row Attributes (Old Values Snapshot)
              </span>
              <pre className="max-h-96 overflow-auto rounded-lg border border-rose-200 bg-rose-50/30 p-4 font-mono text-xs text-slate-800">
                {JSON.stringify(entry.oldValues, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="workspace-secondary-action"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function formatJsonValue(val: unknown): string {
  if (val === undefined) return "(undefined)"
  if (val === null) return "null"
  if (typeof val === "object") return JSON.stringify(val)
  return String(val)
}
