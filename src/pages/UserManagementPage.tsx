import { useMemo, useState } from "react"

import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import RightsModal from "../components/users/RightsModal"
import UserTable from "../components/users/UserTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { systemUsers } from "../lib/users"
import type { SystemUser } from "../types/user"

export default function UserManagementPage() {
  const [users, setUsers] = useState<SystemUser[]>(systemUsers)
  const [query, setQuery] = useState("")
  const [rightsUser, setRightsUser] = useState<SystemUser | null>(null)

  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return users

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.role.toLowerCase().includes(normalizedQuery),
    )
  }, [query, users])

  const toggleBlock = (userId: string) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId && user.role === "USER"
          ? {
              ...user,
              status: user.status === "Blocked" ? "Active" : "Blocked",
            }
          : user,
      ),
    )
  }

  const saveRights = (userId: string, rights: string[]) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId && user.role === "USER" ? { ...user, rights } : user,
      ),
    )
  }

  return (
    <DashboardLayout
      activeNavigation="User Management"
      searchPlaceholder="Search workspace"
    >
      <>
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-7 border-b border-slate-300 pb-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                Administration / Access control
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                User Management
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Manage user access, account availability, and granular module
                permissions.
              </p>
            </div>

            <section
              aria-label="User account search"
              className="mb-5 border border-slate-300 bg-white p-4"
            >
              <label className="block max-w-2xl">
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Search users
                </span>
                <span className="relative block">
                  <DashboardIcon
                    name="search"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Name, email, or role"
                    className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  />
                </span>
              </label>
            </section>

            <UserTable
              users={visibleUsers}
              onToggleBlock={toggleBlock}
              onOpenRights={setRightsUser}
            />
          </div>
        </main>

        <RightsModal
          user={rightsUser}
          onClose={() => setRightsUser(null)}
          onSave={saveRights}
        />
      </>
    </DashboardLayout>
  )
}
