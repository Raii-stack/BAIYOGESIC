import type { UserPagination } from "../../lib/user-api"
import type { SystemUser, UserRole } from "../../types/user"

const roleLabels: Record<UserRole, string> = {
  superadmin: "SUPERADMIN",
  admin: "ADMIN",
  employee: "EMPLOYEE",
}

const roleStyles: Record<UserRole, string> = {
  superadmin: "border-blue-950 bg-[#0d2743] text-white",
  admin: "border-blue-200 bg-blue-50 text-blue-800",
  employee: "border-slate-300 bg-slate-100 text-slate-700",
}

function SkeletonRows() {
  return Array.from({ length: 8 }, (_, index) => (
    <tr key={index} className="border-b border-slate-100 last:border-0" aria-hidden="true">
      {["w-16", "w-40", "w-48", "w-24", "w-20", "w-36", "w-28"].map((width, column) => (
        <td key={column} className="px-5 py-5 first:pl-6 last:pr-6">
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
      className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,39,67,0.05)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">User directory</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            System roles, account status, and per-module user permissions
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">
          {loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} accounts`}
        </span>
      </div>

      <div className="overflow-x-auto" aria-busy={loading}>
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Emp No", "Name", "Email", "Role", "Status", "Last change", "Actions"].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pl-6 last:pr-6 ${
                    heading === "Actions" ? "sticky right-0 z-10 border-l border-slate-200 bg-slate-50" : ""
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
                        : "hover:bg-blue-50/40"
                    }`}
                  >
                    <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold text-blue-800">
                      {user.empno || "—"}
                    </td>
                    <td className="min-w-48 px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      {(user.jobTitle || user.departmentName) && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[user.jobTitle, user.departmentName].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded border px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] ${
                          roleStyles[user.role]
                        }`}
                      >
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="max-w-52 px-5 py-4 font-mono text-[11px] leading-5 text-slate-500">
                      {user.stamp || "—"}
                    </td>
                    <td
                      className={`sticky right-0 z-10 border-l border-slate-100 px-5 py-4 pr-6 ${
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
                              className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-wait disabled:opacity-50"
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
                              className={`text-xs font-bold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-50 ${
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
                              className="text-xs font-bold text-blue-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                            >
                              Rights
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEdit(user)}
                            aria-label={`Edit ${user.name}`}
                            className="text-xs font-bold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
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
          <div className="border-t border-slate-100 px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-800">No user accounts found</p>
            <p className="mt-1 text-xs text-slate-500">
              Try a different search, role filter, or account status.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs font-medium text-slate-600" aria-live="polite">
          {loading
            ? "Loading user accounts…"
            : error
              ? "User accounts unavailable"
              : `Showing ${start}–${end} of ${pagination.total}`}
        </p>
        <nav aria-label="User table pagination" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={loading || pagination.page <= 1}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
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
              className={`h-9 min-w-9 rounded-md border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-wait ${
                page === pagination.page
                  ? "border-blue-800 bg-blue-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={loading || pagination.page >= pagination.totalPages}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
          >
            Next
          </button>
        </nav>
      </div>
    </section>
  )
}
