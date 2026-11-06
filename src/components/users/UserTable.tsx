import { Fragment, useState } from "react"
import { TableSkeletonRows } from "../common/TableSkeleton"
import { DashboardIcon } from "../dashboard/DashboardComponents"
import type { UserPagination } from "../../lib/user-api"
import type { SystemUser, UserRole } from "../../types/user"

const headings = ["Surname", "Name", "Email", "Role", "Access", "Actions"]

const roleLabels: Record<UserRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  employee: "Employee",
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
  approvalOnly = false,
  currentUserId,
  togglingId,
  approvingId,
  rejectingId,
  onPageChange,
  onApprove,
  onReject,
  onToggleBlock,
  onOpenRights,
  onEdit,
}: {
  users: SystemUser[]
  pagination: UserPagination
  loading: boolean
  error: boolean
  isSuperAdmin: boolean
  approvalOnly?: boolean
  currentUserId: string
  togglingId: string | null
  approvingId: string | null
  rejectingId: string | null
  onPageChange: (page: number) => void
  onApprove: (user: SystemUser) => void
  onReject: (user: SystemUser) => void
  onToggleBlock: (user: SystemUser) => void
  onOpenRights: (user: SystemUser) => void
  onEdit: (user: SystemUser) => void
}) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + users.length - 1, pagination.total) : 0

  return (
    <section
      aria-label="User account records"
      className="workspace-panel"
    >
      <div className="workspace-table-header">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{approvalOnly ? "Pending registrations" : "User directory"}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {approvalOnly ? "Approve employee accounts before they can sign in." : "System roles, account status, and per-module user permissions"}
          </p>
        </div>
        <span className="workspace-badge workspace-badge--neutral">
          {loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} ${pagination.total === 1 ? "account" : "accounts"}`}
        </span>
      </div>

      <div className="overflow-x-auto" aria-busy={loading}>
        <table role="table" className="workspace-table workspace-user-table table-fixed">
          <colgroup>
            {[undefined, undefined, "26%", undefined, undefined, 200].map((width, index) => <col key={headings[index]} style={{ width }} />)}
          </colgroup>
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
              users.map((user) => {
                const expanded = expandedUser === user.userId
                const isSelf = String(user.userId) === String(currentUserId)
                const canManageRow = isSuperAdmin || user.role === "employee"
                const canBlockRow = !approvalOnly && canManageRow && !isSelf && user.status === "active"
                const canRejectRow = canManageRow && !isSelf && user.status === "pending"
                const deciding = approvingId === user.userId || rejectingId === user.userId
                const canAssignRights = !approvalOnly && (isSuperAdmin
                  ? !isSelf
                  : canManageRow && user.role === "employee")
                const canApproveRow = canManageRow && user.status === "pending" && !user.isBlocked

                const statusLabel = user.isBlocked
                  ? "Blocked"
                  : user.status === "pending"
                    ? "Pending"
                    : user.status === "disabled" ? "Disabled" : "Active"
                const statusBadgeStyle = user.isBlocked
                  ? "bg-red-100 text-red-800"
                  : user.status === "pending"
                    ? "bg-amber-100 text-amber-900"
                    : user.status === "disabled" ? "bg-neutral-100 text-neutral-600" : "bg-emerald-100 text-emerald-800"

                return (
                  <Fragment key={user.userId}>
                  <tr
                    aria-label={user.name}
                    className={`border-b border-slate-100 transition-colors last:border-0 ${
                      user.isBlocked
                        ? "bg-red-50/40 hover:bg-red-50/70"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <td data-label="Surname" className="[overflow-wrap:anywhere]">
                      <p className="text-[13px] font-medium text-neutral-900">{user.lastName || "—"}</p>
                    </td>
                    <td data-label="Name" className="[overflow-wrap:anywhere]">{user.firstName || (user.lastName ? "—" : user.name)}</td>
                    <td data-label="Email" className="[overflow-wrap:anywhere]">{user.email}</td>
                    <td data-label="Role" className="[overflow-wrap:anywhere]">
                      <span className="font-medium" data-role={user.role}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td data-label="Access" className="whitespace-nowrap">
                      <span
                        className={`workspace-badge ${statusBadgeStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td data-label="Actions"
                      className={`workspace-table-actions ${
                        user.isBlocked ? "bg-red-50/60" : "bg-white"
                      }`}
                    >
                        <div className="flex flex-wrap items-center gap-1 md:grid md:grid-cols-5">
                          <button type="button" aria-expanded={expanded} aria-controls={`user-details-${user.userId}`} aria-label={`${expanded ? "Collapse" : "Expand"} details for ${user.name}`} title={expanded ? "Hide details" : "Show details"} onClick={() => setExpandedUser(expanded ? null : user.userId)} className="workspace-icon-action h-8 w-8">
                            <DashboardIcon name="eye" className="h-4 w-4" />
                          </button>
                          {canApproveRow ? (
                            <button
                              type="button"
                              disabled={deciding}
                              onClick={() => onApprove(user)}
                              aria-label={`Accept ${user.name}`}
                              title="Accept registration"
                              className="workspace-icon-action h-8 w-8 text-emerald-700"
                            >
                              {approvingId === user.userId ? <span role="status" aria-label="Accepting registration">…</span> : <DashboardIcon name="check" className="h-4 w-4" />}
                            </button>
                          ) : <span aria-hidden="true" className="hidden md:block" />}
                          {canRejectRow ? (
                            <button type="button" disabled={deciding} onClick={() => onReject(user)} aria-label={`Reject ${user.name}`} title="Reject registration" className="workspace-icon-action workspace-icon-action--danger h-8 w-8 text-red-700">
                              {rejectingId === user.userId ? <span role="status" aria-label="Rejecting registration">…</span> : <DashboardIcon name="close" className="h-4 w-4" />}
                            </button>
                          ) : canBlockRow ? (
                            <button
                              type="button"
                              disabled={togglingId === user.userId}
                              onClick={() => onToggleBlock(user)}
                              aria-label={`${user.isBlocked ? "Unblock" : "Block"} ${user.name}`}
                              title={user.isBlocked ? "Unblock account" : "Block account"}
                              className={`workspace-icon-action h-8 w-8 ${
                                user.isBlocked
                                  ? "text-emerald-700 focus-visible:ring-emerald-600"
                                  : "text-red-700 focus-visible:ring-red-600"
                              }`}
                            >
                              <DashboardIcon name={user.isBlocked ? "restore" : "lock"} className="h-4 w-4" />
                            </button>
                          ) : <span aria-hidden="true" className="hidden md:block" />}
                          {canAssignRights ? (
                            <button
                              type="button"
                              onClick={() => onOpenRights(user)}
                              aria-label={`Rights for ${user.name}`}
                              title="Manage access rights"
                              className="workspace-icon-action h-8 w-8"
                            >
                              <DashboardIcon name="settings" className="h-4 w-4" />
                            </button>
                          ) : <span aria-hidden="true" className="hidden md:block" />}
                          {!approvalOnly && canManageRow ? <button
                            type="button"
                            onClick={() => onEdit(user)}
                            aria-label={`Edit ${user.name}`}
                            title="Edit account"
                            className="workspace-icon-action h-8 w-8"
                          >
                            <DashboardIcon name="edit" className="h-4 w-4" />
                          </button> : <span aria-hidden="true" className="hidden md:block" />}
                        </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={headings.length} className="workspace-table-expansion">
                        <div id={`user-details-${user.userId}`} role="region" aria-label={`Details for ${user.name}`} className="workspace-history">
                          <dl className="grid gap-4 text-[13px] [overflow-wrap:anywhere] sm:grid-cols-2 lg:grid-cols-3">
                            <div><dt className="text-xs text-neutral-500">Employee no.</dt><dd className="mt-1">{user.empno || "—"}</dd></div>
                            <div><dt className="text-xs text-neutral-500">Job title</dt><dd className="mt-1">{user.jobTitle || "—"}</dd></div>
                            <div><dt className="text-xs text-neutral-500">Department</dt><dd className="mt-1">{user.departmentName || "—"}</dd></div>
                            <div><dt className="text-xs text-neutral-500">Last active</dt><dd className="mt-1">
                              {user.lastActiveAt && !Number.isNaN(Date.parse(user.lastActiveAt))
                                ? <time dateTime={user.lastActiveAt}>{new Date(user.lastActiveAt).toLocaleString()}</time>
                                : "No recorded activity"}
                            </dd></div>
                            <div><dt className="text-xs text-neutral-500">Last change</dt><dd className="mt-1">{user.stamp || "—"}</dd></div>
                          </dl>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
