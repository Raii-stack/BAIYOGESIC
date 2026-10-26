import type { UserPagination } from "../../lib/user-api"
import type { SystemUser, UserRole } from "../../types/user"

const roleLabels: Record<UserRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  employee: "Employee",
}

function SkeletonRows() {
  return Array.from({ length: 8 }, (_, index) => (
    <tr key={index} className="border-b border-slate-100 last:border-0" aria-hidden="true">
      {["w-16", "w-40", "w-48", "w-24", "w-20", "w-36", "w-28"].map((width, column) => (
        <td key={column}>
          <div className={`h-3.5 ${width} max-w-full animate-pulse rounded bg-slate-200`} />
        </td>
      ))}
    </tr>
  ))
}

function visiblePages(page: number, totalPages: number) {
  const count = Math.min(totalPages, 5)
  const start = Math.max(1, Math.min(page - 2, totalPages - count + 1))
  return Array.from({ length: count }, (_, index) => start + index)
}

export default function UserTable({
  users,
  pagination,
  loading,
  error,
  isSuperAdmin,
  currentUserId,
  togglingId,
  approvingId,
  onPageChange,
  onApprove,
  onToggleBlock,
  onOpenRights,
  onEdit,
}: {
  users: SystemUser[]
  pagination: UserPagination
  loading: boolean
  error: boolean
  isSuperAdmin: boolean
  currentUserId: string
  togglingId: string | null
  approvingId: string | null
  onPageChange: (page: number) => void
  onApprove: (user: SystemUser) => void
  onToggleBlock: (user: SystemUser) => void
  onOpenRights: (user: SystemUser) => void
  onEdit: (user: SystemUser) => void
}) {
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + users.length - 1, pagination.total) : 0

  return (
    <section
      aria-label="User account records"
      className="workspace-panel"
    >
      <div className="workspace-table-header">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">User directory</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            System roles, account status, and per-module user permissions
          </p>
        </div>
        <span className="workspace-badge workspace-badge--neutral">
          {loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} accounts`}
        </span>
      </div>

      <div className="overflow-x-auto" aria-busy={loading}>
        <table className="workspace-table min-w-[1040px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Emp No", "Name", "Email", "Role", "Status", "Last change", "Actions"].map((heading) => (
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
              <SkeletonRows />
            ) : (
              users.map((user) => {
                const isSelf = String(user.userId) === String(currentUserId)
                const canManageRow = isSuperAdmin || user.role === "employee"
                const canBlockRow = canManageRow && !isSelf
                const canAssignRights = isSuperAdmin
                  ? !isSelf
                  : canManageRow && user.role === "employee"
                const canApproveRow = canManageRow && user.status === "pending"

                const statusLabel = user.isBlocked
                  ? "Blocked"
                  : user.status === "pending"
                    ? "Pending"
                    : "Active"
                const statusBadgeStyle = user.isBlocked
                  ? "bg-red-100 text-red-800"
                  : user.status === "pending"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-800"

                return (
                  <tr
                    key={user.userId}
                    className={`border-b border-slate-100 transition-colors last:border-0 ${
                      user.isBlocked
                        ? "bg-red-50/40 hover:bg-red-50/70"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <td className="whitespace-nowrap font-mono text-xs font-medium text-neutral-600">
                      {user.empno || "—"}
                    </td>
                    <td className="min-w-48">
                      <p className="text-[13px] font-medium text-neutral-900">{user.name}</p>
                      {(user.jobTitle || user.departmentName) && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[user.jobTitle, user.departmentName].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="text-sm text-slate-600">{user.email}</td>
                    <td className="whitespace-nowrap">
                      <span className="workspace-badge workspace-badge--neutral" data-role={user.role}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span
                        className={`workspace-badge ${statusBadgeStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="max-w-52 font-mono text-[11px] leading-5 text-slate-500">
                      {user.stamp || "—"}
                    </td>
                    <td
                      className={`workspace-table-actions ${
                        user.isBlocked ? "bg-red-50/60" : "bg-white"
                      }`}
                    >
                      {!canManageRow ? (
                        <span
                          aria-label="Privileged accounts cannot be modified"
                          className="text-sm text-slate-400"
                        >
                          —
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          {canApproveRow && (
                            <button
                              type="button"
                              disabled={approvingId === user.userId}
                              onClick={() => onApprove(user)}
                              aria-label={`Accept ${user.name}`}
                              className="workspace-text-action bg-emerald-50 text-emerald-800"
                            >
                              {approvingId === user.userId ? "Accepting…" : "Accept"}
                            </button>
                          )}
                          {canBlockRow && (
                            <button
                              type="button"
                              disabled={togglingId === user.userId}
                              onClick={() => onToggleBlock(user)}
                              aria-label={`${user.isBlocked ? "Unblock" : "Block"} ${user.name}`}
                              className={`workspace-text-action ${
                                user.isBlocked
                                  ? "text-emerald-700 focus-visible:ring-emerald-600"
                                  : "text-red-700 focus-visible:ring-red-600"
                              }`}
                            >
                              {user.isBlocked ? "Unblock" : "Block"}
                            </button>
                          )}
                          {canAssignRights && (
                            <button
                              type="button"
                              onClick={() => onOpenRights(user)}
                              aria-label={`Rights for ${user.name}`}
                              className="workspace-text-action"
                            >
                              Rights
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEdit(user)}
                            aria-label={`Edit ${user.name}`}
                            className="workspace-text-action"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {!loading && !error && users.length === 0 && (
          <div className="workspace-empty-state">
            <p className="text-sm font-semibold text-slate-800">No user accounts found</p>
            <p className="mt-1 text-xs text-slate-500">
              Try a different search, role filter, or account status.
            </p>
          </div>
        )}
      </div>

      <div className="workspace-table-footer">
        <p className="text-xs font-medium text-slate-600" aria-live="polite">
          {loading
            ? "Loading user accounts…"
            : error
              ? "User accounts unavailable"
              : `Showing ${start}–${end} of ${pagination.total}`}
        </p>
        <nav aria-label="User table pagination" className="workspace-pagination">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={loading || pagination.page <= 1}
          >
            Previous
          </button>
          {visiblePages(pagination.page, pagination.totalPages).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              disabled={loading}
              aria-label={`Page ${page}`}
              aria-current={page === pagination.page ? "page" : undefined}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={loading || pagination.page >= pagination.totalPages}
          >
            Next
          </button>
        </nav>
      </div>
    </section>
  )
}
