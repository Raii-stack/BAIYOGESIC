import { useMemo } from "react"
import { Link } from "react-router"

import DashboardLayout from "../layouts/DashboardLayout"
import {
  getCurrentUser,
  getUserDisplayName,
  getUserInitials,
  getUserRoleLabel,
} from "../lib/auth"

export default function ProfilePage() {
  const user = getCurrentUser()
  const name = useMemo(() => getUserDisplayName(user), [user])
  const initials = getUserInitials(user)

  return (
    <DashboardLayout activeNavigation="Profile" searchPlaceholder="Search workspace">
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Link
              to="/dashboard"
              className="transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            >
              Dashboard
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-800">Profile</span>
          </div>

          <div className="mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
              Account settings
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950">
              My Profile
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review your identity, access level, and account status in the HOPE ERP workspace.
            </p>
          </div>

          <section
            aria-labelledby="profile-summary-title"
            className="border border-slate-300 border-t-[3px] border-t-blue-800 bg-white"
          >
            <div className="flex flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:px-8">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[#0d2743] text-2xl font-bold tracking-[-0.03em] text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800">
                  {user ? getUserRoleLabel(user) : "Signed-in account"}
                </span>
                <h2
                  id="profile-summary-title"
                  className="mt-3 text-2xl font-bold tracking-[-0.03em] text-slate-950"
                >
                  {name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {user?.email ?? "Sign in to view your account details."}
                </p>
              </div>
              <div className="border-t border-slate-200 pt-4 text-sm sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Account status
                </p>
                <p className="mt-2 inline-flex items-center gap-2 font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {user?.status === "active" ? "Active" : "Unavailable"}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-5 border border-slate-300 bg-white">
            <div className="border-b border-slate-300 px-6 py-5 sm:px-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                Identity details
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-slate-950">
                Account information
              </h2>
            </div>
            <dl className="grid gap-x-8 gap-y-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Work email
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-900">
                  {user?.email ?? "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Employee number
                </dt>
                <dd className="mt-2 font-mono text-sm font-semibold text-slate-900">
                  {user?.empno ?? "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  Access level
                </dt>
                <dd className="mt-2 text-sm font-semibold text-slate-900">
                  {user ? getUserRoleLabel(user) : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  User ID
                </dt>
                <dd className="mt-2 break-all font-mono text-xs text-slate-700">
                  {user?.userId ?? "Not available"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </main>
    </DashboardLayout>
  )
}
