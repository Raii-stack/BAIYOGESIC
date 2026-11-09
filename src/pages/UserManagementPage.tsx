import { useEffect, useRef, useState } from "react"
import { useLocation, useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import SuccessToast from "../components/common/SuccessToast"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import RightsModal from "../components/users/RightsModal"
import UserPanel from "../components/users/UserPanel"
import UserTable from "../components/users/UserTable"
import DeleteUserModal from "../components/users/DeleteUserModal"
import AuditLogViewer from "../components/users/AuditLogViewer"
import useDebouncedValue from "../hooks/useDebouncedValue"
import usePageQuery from "../hooks/usePageQuery"
import DashboardLayout from "../layouts/DashboardLayout"
import { isAdminRole, isSuperAdminRole } from "../lib/auth"
import { userRoleLabels } from "../lib/users"
import {
  userApi,
  type UserCreateInput,
  type UserPagination,
  type UserUpdateInput,
} from "../lib/user-api"
import type { AvailableEmployee, SystemUser, UserRole } from "../types/user"

const PAGE_SIZE = 10
const emptyPagination: UserPagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

export default function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const { state: navigationState } = useLocation()
  const handledNotification = useRef<unknown>(null)
  const isSuperAdmin = isSuperAdminRole(currentUser?.role)
  const isItAdmin = currentUser?.role === "it_admin"
  const approvalOnly = !isAdminRole(currentUser?.role) && !isItAdmin
  const currentUserId = String(currentUser?.userId ?? "")
  const [activeView, setActiveView] = useState<"users" | "audit">(() =>
    searchParams.get("view") === "audit" && isSuperAdmin ? "audit" : "users",
  )

  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>(() => searchParams.get("status") === "pending" ? "employee" : "all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "pending" | "disabled">(() => searchParams.get("status") === "pending" ? "pending" : (searchParams.get("status") === "disabled" || searchParams.get("status") === "rejected" ? "disabled" : "all"))
  const [page, setPage] = usePageQuery()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [pagination, setPagination] = useState<UserPagination>(emptyPagination)
  const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [refresh, setRefresh] = useState(0)

  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)
  const [rightsUser, setRightsUser] = useState<SystemUser | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reReviewingId, setReReviewingId] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)


  useEffect(() => {
    if (navigationState === handledNotification.current || typeof navigationState?.registrationEmail !== "string") return
    handledNotification.current = navigationState
    setActiveView("users")
    setQuery(navigationState.registrationEmail)
    setRoleFilter("employee")
    setStatusFilter("pending")
    setPage(1)
  }, [navigationState, setPage])

  useEffect(() => {
    document.title = "User Management | HOPE, Inc."
    return () => {
      document.title = "Sign in | HOPE, Inc."
    }
  }, [])

  useEffect(() => {
    if (activeView !== "users" || !currentUser || approvalOnly) return
    const controller = new AbortController()
    userApi
      .options(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setAvailableEmployees(result.availableEmployees)
        }
      })
      .catch(() => {
        // Optional lookup list
      })
    return () => controller.abort()
  }, [refresh, activeView, approvalOnly, currentUser?.userId])

  useEffect(() => {
    if (activeView !== "users" || !currentUser) return
    if (searchPending) {
      setLoading(true)
      setLoadError("")
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setLoadError("")
    userApi
      .list(
        {
          page,
          limit: PAGE_SIZE,
          search: debouncedQuery,
          role: approvalOnly ? "employee" : roleFilter,
          status: approvalOnly ? "pending" : statusFilter,
        },
        controller.signal,
      )
      .then((result) => {
        if (controller.signal.aborted) return
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages))
          return
        }
        setUsers(result.users)
        setPagination(result.pagination)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load user accounts.")
          setUsers([])
          setPagination(emptyPagination)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [page, roleFilter, statusFilter, debouncedQuery, searchPending, refresh, activeView, approvalOnly, currentUser?.userId])

  const showNotice = (message: string) => {
    setNotice((current) => ({ id: (current?.id ?? 0) + 1, message }))
  }

  const openAddPanel = () => {
    setSelectedUser(null)
    setPanelOpen(true)
  }

  const openEditPanel = (target: SystemUser) => {
    setSelectedUser(target)
    setPanelOpen(true)
  }

  const handleCreateUser = async (input: UserCreateInput) => {
    await userApi.create(input)
    showNotice("User account created successfully.")
    setPage(1)
    setRefresh((current) => current + 1)
  }

  const handleUpdateUser = async (userId: string, input: UserUpdateInput) => {
    const updated = await userApi.update(userId, input)
    setUsers((current) =>
      current.map((user) => (user.userId === updated.userId ? updated : user)),
    )
    showNotice("User account updated successfully.")
  }

  const handleApproveUser = async (target: SystemUser) => {
    setApprovingId(target.userId)
    try {
      const updated = await userApi.approve(target.userId)
      setUsers((current) =>
        current.map((user) => (user.userId === updated.userId ? updated : user)),
      )
      showNotice(`${target.name} has been accepted and activated.`)
      window.dispatchEvent(new Event("hope:registrations-changed"))
      if (approvalOnly || statusFilter === "pending") setRefresh((current) => current + 1)
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setApprovingId(null)
    }
  }

  const handleToggleBlock = async (target: SystemUser) => {
    setTogglingId(target.userId)
    try {
      const nextBlocked = !target.isBlocked
      const updated = await userApi.setBlocked(target.userId, nextBlocked)
      setUsers((current) =>
        current.map((user) => (user.userId === updated.userId ? updated : user)),
      )
      showNotice(
        nextBlocked
          ? `${target.name} has been blocked.`
          : `${target.name} has been unblocked.`,
      )
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setTogglingId(null)
    }
  }

  const handleRejectUser = async (target: SystemUser) => {
    setRejectingId(target.userId)
    try {
      const updated = await userApi.reject(target.userId)
      setUsers((current) => current.map((user) => user.userId === updated.userId ? updated : user))
      showNotice(`${target.name}'s registration has been rejected.`)
      window.dispatchEvent(new Event("hope:registrations-changed"))
      if (approvalOnly || statusFilter === "pending") setRefresh((current) => current + 1)
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setRejectingId(null)
    }
  }

  const handleReReviewUser = async (target: SystemUser) => {
    setReReviewingId(target.userId)
    try {
      const updated = await userApi.reReview(target.userId)
      setUsers((current) =>
        current.map((user) => (user.userId === updated.userId ? updated : user)),
      )
      showNotice(`${target.name} has been moved to pending for re-review.`)
      window.dispatchEvent(new Event("hope:registrations-changed"))
      if (statusFilter === "disabled") setRefresh((current) => current + 1)
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setReReviewingId(null)
    }
  }

  const handleDeleteUserPermanently = async () => {
    if (!deletingUser) return
    setDeletingLoading(true)
    setDeleteError("")
    try {
      await userApi.deletePermanently(deletingUser.userId)
      setUsers((current) => current.filter((u) => u.userId !== deletingUser.userId))
      showNotice(`${deletingUser.name}'s account has been permanently deleted.`)
      window.dispatchEvent(new Event("hope:registrations-changed"))
      setDeletingUser(null)
      setRefresh((current) => current + 1)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to permanently delete account")
    } finally {
      setDeletingLoading(false)
    }
  }

  const handleSaveRights = async (userId: string, rights: string[], role: UserRole) => {
    const updated = await userApi.updateRights(userId, rights, role)
    setUsers((current) =>
      current.map((user) => (user.userId === updated.userId ? updated : user)),
    )
    showNotice("User permissions updated successfully.")
  }

  return (
    <DashboardLayout activeNavigation="Users" searchPlaceholder="Search workspace">
      <>
        <main className="workspace-page">
          <div className="mx-auto max-w-7xl">
            <header className="workspace-page-header">
              <div>
                <h1 className="workspace-page-title">Users</h1>
                <p className="workspace-page-description">{approvalOnly ? "Review and approve pending employee registrations." : "Manage who can sign in and what they can access."}</p>
              </div>
            </header>

            {isSuperAdmin && (
              <div
                role="tablist"
                aria-label="User administration views"
                className="workspace-tabs mb-4"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-user-accounts"
                  aria-selected={activeView === "users"}
                  aria-controls="panel-user-accounts"
                  onClick={() => setActiveView("users")}
                  className="workspace-tab"
                >
                  User Accounts
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-audit-logs"
                  aria-selected={activeView === "audit"}
                  aria-controls="panel-audit-logs"
                  onClick={() => setActiveView("audit")}
                  className="workspace-tab"
                >
                  Audit Logs
                </button>
              </div>
            )}

            {activeView === "audit" && isSuperAdmin ? (
              <div role="tabpanel" id="panel-audit-logs" aria-labelledby="tab-audit-logs">
                <AuditLogViewer />
              </div>
            ) : (
              <div role="tabpanel" id="panel-user-accounts" aria-labelledby="tab-user-accounts">
                <section
                  aria-label="User account filters"
                  className="workspace-panel workspace-filters"
                >
                  <label className="workspace-filter-search">
                    <span className="workspace-label">Search users</span>
                    <span className="relative block">
                      <DashboardIcon
                        name="search"
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                      />
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value)
                          setPage(1)
                        }}
                        placeholder="Name, email, employee no, or role"
                        className="workspace-control workspace-control--search"
                      />
                    </span>
                  </label>

                  <label>
                    <span className="workspace-label">Role</span>
                    <span className="relative block">
                      <select
                        value={approvalOnly ? "employee" : roleFilter}
                        disabled={approvalOnly}
                        onChange={(event) => {
                          setRoleFilter(event.target.value as "all" | UserRole)
                          setPage(1)
                        }}
                        className="workspace-control"
                      >
                        <option value="all">All roles</option>
                        {isSuperAdmin && <option value="superadmin">Superadmin</option>}
                        <option value="it_admin">IT Admin</option>
                        <option value="admin">{userRoleLabels.admin}</option>
                        <option value="employee">Employee</option>
                      </select>
                    </span>
                  </label>

                  <label>
                    <span className="workspace-label">Status</span>
                    <span className="relative block">
                      <select
                        value={approvalOnly ? "pending" : statusFilter}
                        disabled={approvalOnly}
                        onChange={(event) => {
                          setStatusFilter(
                            event.target.value as "all" | "active" | "blocked" | "pending" | "disabled",
                          )
                          setPage(1)
                        }}
                        className="workspace-control"
                      >
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="blocked">Blocked</option>
                        <option value="pending">Pending</option>
                        <option value="disabled">Rejected</option>
                      </select>
                    </span>
                  </label>

                  {!approvalOnly && <button
                    type="button"
                    onClick={openAddPanel}
                    className="workspace-primary-action"
                  >
                    <DashboardIcon name="plus" className="h-4 w-4" />
                    Add user
                  </button>}
                </section>

                {loadError && (
                  <div
                    role="alert"
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
                  >
                    <span>{loadError}</span>
                    <button
                      type="button"
                      onClick={() => setRefresh((current) => current + 1)}
                      className="underline underline-offset-4 hover:text-red-950"
                    >
                      Try again
                    </button>
                  </div>
                )}

                <UserTable canViewAudit={isAdminRole(currentUser?.role) || isItAdmin}
                  users={users}
                  pagination={pagination}
                  loading={loading}
                  error={Boolean(loadError)}
                  isSuperAdmin={isSuperAdmin}
          isItAdmin={isItAdmin}
                  approvalOnly={approvalOnly}
                  currentUserId={currentUserId}
                  togglingId={togglingId}
                  approvingId={approvingId}
                  rejectingId={rejectingId}
                  reReviewingId={reReviewingId}
                  onPageChange={setPage}
                  onApprove={handleApproveUser}
                  onReject={handleRejectUser}
                  onReReview={handleReReviewUser}
                  onDeletePermanently={(user) => {
                    setDeleteError("")
                    setDeletingUser(user)
                  }}
                  onToggleBlock={handleToggleBlock}
                  onOpenRights={setRightsUser}
                  onEdit={openEditPanel}
                />
              </div>
            )}
          </div>
        </main>

        <UserPanel
          user={selectedUser}
          open={panelOpen}
          isSuperAdmin={isSuperAdmin}
          isItAdmin={isItAdmin}
          currentUserId={currentUserId}
          availableEmployees={availableEmployees}
          onClose={() => setPanelOpen(false)}
          onCreate={handleCreateUser}
          onUpdate={handleUpdateUser}
        />

        <RightsModal
          user={rightsUser}
          canAssignAdmin={isSuperAdmin || isItAdmin}
          onClose={() => setRightsUser(null)}
          onSave={handleSaveRights}
        />

        <DeleteUserModal
          user={deletingUser}
          open={Boolean(deletingUser)}
          onCancel={() => {
            if (!deletingLoading) {
              setDeletingUser(null)
              setDeleteError("")
            }
          }}
          onConfirm={handleDeleteUserPermanently}
          loading={deletingLoading}
          error={deleteError}
        />

        {notice && (
          <SuccessToast
            key={notice.id}
            message={notice.message}
            onClose={() =>
              setNotice((current) => (current?.id === notice.id ? null : current))
            }
          />
        )}
      </>
    </DashboardLayout>
  )
}
