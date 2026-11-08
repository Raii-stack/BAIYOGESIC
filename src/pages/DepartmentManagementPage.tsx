import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import SuccessToast from "../components/common/SuccessToast"
import { TableSkeletonRows } from "../components/common/TableSkeleton"
import DepartmentModal from "../components/departments/DepartmentModal"
import useDebouncedValue from "../hooks/useDebouncedValue"
import useModalFocus from "../hooks/useModalFocus"
import DashboardLayout from "../layouts/DashboardLayout"
import {
  departmentApi,
  type Department,
  type DepartmentPagination,
} from "../lib/department-api"
import { getHrPermissions } from "../lib/rbac"

const PAGE_SIZE = 10
const emptyPagination: DepartmentPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
}

const visiblePages = (page: number, totalPages: number) => {
  const count = Math.min(totalPages, 5)
  const start = Math.max(1, Math.min(page - 2, totalPages - count + 1))
  return Array.from({ length: count }, (_, i) => start + i)
}

type DepartmentRowProps = {
  department: Department
  canEdit: boolean
  canDelete: boolean
  canViewAudit: boolean
  restoringCode: string | null
  onEdit: (department: Department) => void
  onArchive: (department: Department) => void
  onRestore: (department: Department) => void
}

const DepartmentTableRow = memo(function DepartmentTableRow({
  department,
  canEdit,
  canDelete,
  canViewAudit,
  restoringCode,
  onEdit,
  onArchive,
  onRestore,
}: DepartmentRowProps) {
  const showActions = canEdit || canDelete

  return (
    <tr
      className={`border-b border-slate-100 transition-colors last:border-0 ${
        department.archived ? "is-muted" : "hover:bg-neutral-50"
      }`}
    >
      <td
        data-label="Department Code"
        className="whitespace-nowrap font-mono text-xs font-semibold uppercase text-neutral-600"
      >
        {department.code}
      </td>
      <td
        data-label="Department Name"
        className="min-w-48 text-[13px] font-medium text-neutral-900"
      >
        {department.name}
      </td>
      <td data-label="Headcount" className="whitespace-nowrap">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
          title={`${department.employeeCount} assigned active employee(s)`}
        >
          <DashboardIcon name="briefcase" className="h-3 w-3 text-slate-500" />
          <span>{department.employeeCount}</span>
        </span>
      </td>
      <td data-label="Status" className="whitespace-nowrap">
        <span
          className={`workspace-badge ${
            department.archived
              ? "bg-neutral-100 text-neutral-600"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {department.archived ? "Archived" : "Active"}
        </span>
      </td>
      {canViewAudit && (
        <td
          data-label="Last change"
          className="max-w-52 font-mono text-[11px] leading-5 text-slate-500"
        >
          {department.stamp || "—"}
        </td>
      )}
      {showActions && (
        <td
          data-label="Actions"
          className={`workspace-table-actions ${
            department.archived ? "bg-slate-50" : "bg-white"
          }`}
        >
          <div className="flex items-center gap-1">
            {!department.archived ? (
              <>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(department)}
                    aria-label={`Edit ${department.name}`}
                    title="Edit department"
                    className="workspace-icon-action workspace-icon-action--primary"
                  >
                    <DashboardIcon name="edit" className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onArchive(department)}
                    aria-label={`Archive ${department.name}`}
                    title="Archive department"
                    className="workspace-icon-action workspace-icon-action--danger"
                  >
                    <DashboardIcon name="archive" className="h-4 w-4" />
                  </button>
                )}
              </>
            ) : canDelete ? (
              <button
                type="button"
                onClick={() => onRestore(department)}
                disabled={restoringCode === department.code}
                aria-label={`Restore ${department.name}`}
                title="Restore department"
                className="workspace-icon-action workspace-icon-action--success"
              >
                <DashboardIcon name="restore" className="h-4 w-4" />
              </button>
            ) : (
              <span
                className="px-2 text-slate-400"
                aria-label="No actions for archived department"
              >
                —
              </span>
            )}
          </div>
        </td>
      )}
    </tr>
  )
})

export default function DepartmentManagementPage() {
  const { user } = useAuth()
  const {
    canAddDepartment,
    canEditDepartment,
    canDeleteDepartment,
    canViewAudit,
  } = getHrPermissions(user)

  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [status, setStatus] = useState<"all" | "active" | "archived">("all")
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") || 1))
  const setPage = useCallback(
    (next: number) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.set("page", String(next))
        return p
      })
    },
    [setSearchParams],
  )

  const [departments, setDepartments] = useState<Department[]>([])
  const [pagination, setPagination] = useState<DepartmentPagination>(emptyPagination)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)

  const [toArchive, setToArchive] = useState<Department | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)
  const [restoringCode, setRestoringCode] = useState<string | null>(null)

  const archiveDialogRef = useRef<HTMLElement>(null)
  const archiveCancelRef = useRef<HTMLButtonElement>(null)
  useModalFocus(Boolean(toArchive), archiveDialogRef, archiveCancelRef, () => setToArchive(null), archiving)

  useEffect(() => {
    document.title = "Departments | HOPE, Inc."
    return () => {
      document.title = "Sign in | HOPE, Inc."
    }
  }, [])

  useEffect(() => {
    if (searchPending) {
      setLoading(true)
      setError("")
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError("")

    departmentApi
      .list(
        {
          page,
          limit: PAGE_SIZE,
          search: debouncedQuery,
          status,
        },
        controller.signal,
      )
      .then((result) => {
        if (controller.signal.aborted) return
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages))
          return
        }
        setDepartments(result.departments)
        setPagination(result.pagination)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Unable to load departments.")
          setDepartments([])
          setPagination(emptyPagination)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [page, debouncedQuery, searchPending, status])

  const showNotice = (message: string) => {
    setNotice((prev) => ({ id: (prev?.id ?? 0) + 1, message }))
  }

  const handleOpenAdd = () => {
    setSelectedDepartment(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (dept: Department) => {
    setSelectedDepartment(dept)
    setModalOpen(true)
  }

  const handleSaveDepartment = async (input: { deptcode: string; deptname: string }) => {
    if (selectedDepartment) {
      const result = await departmentApi.update(selectedDepartment.code, {
        deptname: input.deptname,
      })
      const updated = result.department
        ? {
            ...selectedDepartment,
            name: result.department.deptname || input.deptname,
            stamp: result.department.stamp || selectedDepartment.stamp,
          }
        : { ...selectedDepartment, name: input.deptname }

      setDepartments((prev) =>
        prev.map((item) => (item.code === selectedDepartment.code ? updated : item)),
      )
      showNotice("Department updated successfully.")
    } else {
      await departmentApi.create(input)
      showNotice("Department created successfully.")
      if (status === "archived") setStatus("all")
      setPage(1)
      const fresh = await departmentApi.list({ page: 1, limit: PAGE_SIZE, status: "all" })
      setDepartments(fresh.departments)
      setPagination(fresh.pagination)
    }
  }

  const handleArchiveDepartment = async () => {
    if (!toArchive) return
    setArchiving(true)
    setArchiveError("")
    try {
      const result = await departmentApi.archive(toArchive.code)
      setDepartments((prev) =>
        status === "active"
          ? prev.filter((d) => d.code !== toArchive.code)
          : prev.map((d) =>
              d.code === toArchive.code
                ? {
                    ...d,
                    archived: true,
                    stamp: result.department?.stamp || d.stamp,
                  }
                : d,
            ),
      )
      setToArchive(null)
      showNotice("Department archived successfully.")
      if (status === "active" && departments.length === 1 && page > 1) {
        setPage(page - 1)
      }
    } catch (cause) {
      setArchiveError(
        cause instanceof Error ? cause.message : "Unable to archive department.",
      )
    } finally {
      setArchiving(false)
    }
  }

  const handleRestoreDepartment = async (dept: Department) => {
    setRestoringCode(dept.code)
    try {
      const result = await departmentApi.restore(dept.code)
      setDepartments((prev) =>
        status === "archived"
          ? prev.filter((d) => d.code !== dept.code)
          : prev.map((d) =>
              d.code === dept.code
                ? {
                    ...d,
                    archived: false,
                    stamp: result.department?.stamp || d.stamp,
                  }
                : d,
            ),
      )
      showNotice("Department restored successfully.")
      if (status === "archived" && departments.length === 1 && page > 1) {
        setPage(page - 1)
      }
    } catch {
      // Shared error toast handled by apiFailure
    } finally {
      setRestoringCode(null)
    }
  }

  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + departments.length - 1, pagination.total) : 0
  const showActions = canEditDepartment || canDeleteDepartment
  const headings = [
    "Department Code",
    "Department Name",
    "Headcount",
    "Status",
    ...(canViewAudit ? ["Last change"] : []),
    ...(showActions ? ["Actions"] : []),
  ]

  return (
    <DashboardLayout activeNavigation="Departments" searchPlaceholder="Search departments">
      <main className="workspace-page">
        <div className="mx-auto max-w-7xl">
          <header className="workspace-page-header">
            <div>
              <h1 className="workspace-page-title">Departments</h1>
              <p className="workspace-page-description">
                Manage corporate organizational divisions, structural hierarchy, and active employee headcounts.
              </p>
            </div>
          </header>

          <section aria-label="Department filters" className="workspace-panel workspace-filters">
            <label className="workspace-filter-search">
              <span className="workspace-label">Search departments</span>
              <span className="relative block">
                <DashboardIcon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Code or name"
                  className="workspace-control workspace-control--search"
                />
              </span>
            </label>

            <label>
              <span className="workspace-label">Status</span>
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as "all" | "active" | "archived")
                  setPage(1)
                }}
                className="workspace-control"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            {canAddDepartment && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="workspace-primary-action"
              >
                <DashboardIcon name="plus" className="h-4 w-4" />
                Add department
              </button>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              <span>{error}</span>
            </div>
          )}

          <section aria-label="Department records" className="workspace-panel">
            <div className="workspace-table-header">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Department directory
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Corporate units, structural codes, and staffing levels
                </p>
              </div>
              <span className="workspace-badge workspace-badge--neutral">
                {loading
                  ? "Loading…"
                  : error
                  ? "Unavailable"
                  : `${pagination.total} records`}
              </span>
            </div>

            <div className="overflow-x-auto" aria-busy={loading}>
              <table role="table" className="workspace-table min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {headings.map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className={`workspace-table-heading ${
                          heading === "Actions" ? "workspace-table-actions" : ""
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeletonRows headings={headings} />
                  ) : (
                    departments.map((dept) => (
                      <DepartmentTableRow
                        key={dept.code}
                        department={dept}
                        canEdit={canEditDepartment}
                        canDelete={canDeleteDepartment}
                        canViewAudit={canViewAudit}
                        restoringCode={restoringCode}
                        onEdit={handleOpenEdit}
                        onArchive={(d) => {
                          setArchiveError("")
                          setToArchive(d)
                        }}
                        onRestore={handleRestoreDepartment}
                      />
                    ))
                  )}
                </tbody>
              </table>

              {!loading && !error && departments.length === 0 && (
                <div className="workspace-empty-state">
                  <p className="text-sm font-semibold text-slate-800">
                    No departments found
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {query.trim() || status !== "all"
                      ? "Try clearing filters or search to view departments."
                      : "Create your first corporate department to get started."}
                  </p>
                </div>
              )}
            </div>

            <div className="workspace-table-footer">
              <p className="text-xs font-medium text-slate-600" aria-live="polite">
                {loading
                  ? "Loading department records…"
                  : error
                  ? "Department records unavailable"
                  : `Showing ${start}–${end} of ${pagination.total}`}
              </p>
              <nav
                aria-label="Department table pagination"
                className="workspace-pagination"
              >
                <button
                  type="button"
                  onClick={() => setPage(pagination.page - 1)}
                  disabled={loading || pagination.page <= 1}
                >
                  Previous
                </button>
                {visiblePages(pagination.page, pagination.totalPages).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    disabled={loading}
                    aria-label={`Page ${p}`}
                    aria-current={p === pagination.page ? "page" : undefined}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage(pagination.page + 1)}
                  disabled={loading || pagination.page >= pagination.totalPages}
                >
                  Next
                </button>
              </nav>
            </div>
          </section>
        </div>
      </main>

      <DepartmentModal
        open={modalOpen}
        department={selectedDepartment}
        existingCodes={departments.map((d) => d.code)}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveDepartment}
      />

      {toArchive && (
        <div className="workspace-modal-overlay z-[60]">
          <button
            type="button"
            aria-label="Cancel archive"
            tabIndex={-1}
            onClick={() => {
              if (!archiving) setToArchive(null)
            }}
            className="absolute inset-0 bg-black/45"
          />

          <section
            ref={archiveDialogRef}
            role="alertdialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="archive-dept-title"
            aria-describedby={`archive-dept-desc${archiveError ? " archive-dept-error" : ""}`}
            aria-busy={archiving}
            className="workspace-modal workspace-panel relative w-full max-w-lg shadow-xl"
          >
            <div className="workspace-drawer-body text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700">
                <DashboardIcon name="archive" className="h-7 w-7" />
              </div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">
                Deactivate Department
              </p>
              <h2
                id="archive-dept-title"
                className="mt-2 text-xl font-semibold tracking-tight text-neutral-900"
              >
                Archive this department?
              </h2>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {toArchive.name} ({toArchive.code})
              </p>
              <p
                id="archive-dept-desc"
                className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-600"
              >
                Are you sure you want to deactivate department {toArchive.name}?
                Departments with active employee assignments cannot be archived.
              </p>
            </div>

            {archiveError && (
              <p
                id="archive-dept-error"
                role="alert"
                className="px-6 pb-4 text-center text-sm font-semibold text-red-700"
              >
                {archiveError}
              </p>
            )}

            <div className="workspace-drawer-footer">
              <button
                ref={archiveCancelRef}
                type="button"
                onClick={() => setToArchive(null)}
                disabled={archiving}
                className="workspace-secondary-action"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveDepartment}
                disabled={archiving}
                className="workspace-danger-action"
              >
                {archiving ? "Archiving…" : "Yes, Archive Department"}
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <SuccessToast
          key={notice.id}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}
    </DashboardLayout>
  )
}
