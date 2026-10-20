import { useEffect, useState } from "react"

import { useAuth } from "../components/auth/AuthProvider"
import SuccessToast from "../components/common/SuccessToast"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import RightsModal from "../components/users/RightsModal"
import UserPanel from "../components/users/UserPanel"
import UserTable from "../components/users/UserTable"
import useDebouncedValue from "../hooks/useDebouncedValue"
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
  const isSuperAdmin = isSuperAdminRole(currentUser?.role)
  const currentUserId = String(currentUser?.userId ?? "")

  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked" | "pending">("all")
  const [page, setPage] = useState(1)
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
        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
          setPage(result.pagination.totalPages)
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

  const handleSaveRights = async (userId: string, rights: string[]) => {
    await userApi.updateRights(userId, rights)
    showNotice("User permissions updated successfully.")
    setRefresh((current) => current + 1)
  }

  return (
    <DashboardLayout activeNavigation="User Management" searchPlaceholder="Search workspace">
      <>
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-7xl">
            <header className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                  Administration / Access control
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  User Management
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Manage user accounts, role assignments, account blocking, and granular module
                  permissions.
                </p>
              </div>
              <div className="flex items-center gap-3 self-start border-l-2 border-blue-800 pl-4 sm:self-auto">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-950">
                  {loading || loadError ? "—" : pagination.total}
                </span>
                <span className="max-w-20 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-slate-500">
                  Matching accounts
                </span>
              </div>
            </header>

            <section
              aria-label="User account filters"
              className="mb-5 grid gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-[0_8px_28px_rgba(15,39,67,0.04)] md:grid-cols-2 md:items-end lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"
            >
              <label>
                <span className="mb-2 block text-xs font-bold text-slate-700">Search users</span>
                <span className="relative block">
                  <DashboardIcon
                    name="search"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Name, email, employee no, or role"
                    className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  />
                </span>
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold text-slate-700">Role</span>
                <span className="relative block">
                  <select
                    value={roleFilter}
                    onChange={(event) => {
                      setRoleFilter(event.target.value as "all" | UserRole)
                      setPage(1)
                    }}
                    className="h-11 w-full appearance-none rounded-md border border-slate-300 bg-slate-50 px-3 pr-9 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  >
                    <option value="all">All roles</option>
                    {isSuperAdmin && <option value="superadmin">Superadmin</option>}
                    <option value="admin">Admin</option>
                    <option value="employee">Employee</option>
                  </select>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="m6 8 4 4 4-4" />
                  </svg>
                </span>
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold text-slate-700">Status</span>
                <span className="relative block">
                  <select
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(
                        event.target.value as "all" | "active" | "blocked" | "pending",
                      )
                      setPage(1)
                    }}
                    className="h-11 w-full appearance-none rounded-md border border-slate-300 bg-slate-50 px-3 pr-9 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                    <option value="pending">Pending</option>
                  </select>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="m6 8 4 4 4-4" />
                  </svg>
                </span>
              </label>

              <button
                type="button"
                onClick={openAddPanel}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
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
