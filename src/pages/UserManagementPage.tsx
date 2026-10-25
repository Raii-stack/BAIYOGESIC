import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import SuccessToast from "../components/common/SuccessToast"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import RightsModal from "../components/users/RightsModal"
import UserPanel from "../components/users/UserPanel"
import UserTable from "../components/users/UserTable"
import useDebouncedValue from "../hooks/useDebouncedValue"
import usePageQuery from "../hooks/usePageQuery"
import DashboardLayout from "../layouts/DashboardLayout"
import { isSuperAdminRole } from "../lib/auth"
import {
  userApi,
  type UserCreateInput,
  type UserPagination,
  type UserUpdateInput,
} from "../lib/user-api"
import type { AvailableEmployee, SystemUser, UserRole } from "../types/user"

const PAGE_SIZE = 10
const emptyPagination: UserPagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

function AddIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth()
  const [searchParams] = useSearchParams()
  const isSuperAdmin = isSuperAdminRole(currentUser?.role)
  const currentUserId = String(currentUser?.userId ?? "")

  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "pending">("all")
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
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)

  useEffect(() => {
    document.title = "User Management | HOPE, Inc."
    return () => {
      document.title = "Sign in | HOPE, Inc."
    }
  }, [])

  useEffect(() => {
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
  }, [refresh])

  useEffect(() => {
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
          role: roleFilter,
          status: statusFilter,
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
  }, [page, roleFilter, statusFilter, debouncedQuery, searchPending, refresh])

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
    await userApi.update(userId, input)
    showNotice("User account updated successfully.")
    setRefresh((current) => current + 1)
  }

  const handleApproveUser = async (target: SystemUser) => {
    setApprovingId(target.userId)
    try {
      await userApi.approve(target.userId)
      showNotice(`${target.name} has been accepted and activated.`)
      setRefresh((current) => current + 1)
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
      await userApi.setBlocked(target.userId, nextBlocked)
      showNotice(
        nextBlocked
          ? `${target.name} has been blocked.`
          : `${target.name} has been unblocked.`,
      )
      setRefresh((current) => current + 1)
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setTogglingId(null)
    }
  }

  const handleSaveRights = async (userId: string, rights: string[], role: UserRole) => {
    const updated = await userApi.updateRights(userId, rights, role)
    setUsers((current) =>
      current.map((user) => (user.userId === updated.userId ? updated : user)),
    )
    showNotice("User permissions updated successfully.")
    setRefresh((current) => current + 1)
  }

  return (
    <DashboardLayout activeNavigation="Users" searchPlaceholder="Search workspace">
      <>
        <main className="workspace-page">
          <div className="mx-auto max-w-7xl">
            <header className="workspace-page-header">
              <div>
                <h1 className="workspace-page-title">Users</h1>
                <p className="workspace-page-description">Manage who can sign in and what they can access.</p>
              </div>
            </header>

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
                    value={roleFilter}
                    onChange={(event) => {
                      setRoleFilter(event.target.value as "all" | UserRole)
                      setPage(1)
                    }}
                    className="workspace-control"
                  >
                    <option value="all">All roles</option>
                    {isSuperAdmin && <option value="superadmin">Superadmin</option>}
                    <option value="admin">Admin</option>
                    <option value="employee">Employee</option>
                  </select>
                </span>
              </label>

              <label>
                <span className="workspace-label">Status</span>
                <span className="relative block">
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(
                        event.target.value as "all" | "active" | "blocked" | "pending",
                      )
                      setPage(1)
                    }}
                    className="workspace-control"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                    <option value="pending">Pending</option>
                  </select>
                </span>
              </label>

              <button
                type="button"
                onClick={openAddPanel}
                className="workspace-primary-action"
              >
                <AddIcon />
                Add user
              </button>
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

            <UserTable
              users={users}
              pagination={pagination}
              loading={loading}
              error={Boolean(loadError)}
              isSuperAdmin={isSuperAdmin}
              currentUserId={currentUserId}
              togglingId={togglingId}
              approvingId={approvingId}
              onPageChange={setPage}
              onApprove={handleApproveUser}
              onToggleBlock={handleToggleBlock}
              onOpenRights={setRightsUser}
              onEdit={openEditPanel}
            />
          </div>
        </main>

        <UserPanel
          user={selectedUser}
          open={panelOpen}
          isSuperAdmin={isSuperAdmin}
          currentUserId={currentUserId}
          availableEmployees={availableEmployees}
          onClose={() => setPanelOpen(false)}
          onCreate={handleCreateUser}
          onUpdate={handleUpdateUser}
        />

        <RightsModal
          user={rightsUser}
          canAssignAdmin={isSuperAdmin}
          onClose={() => setRightsUser(null)}
          onSave={handleSaveRights}
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
