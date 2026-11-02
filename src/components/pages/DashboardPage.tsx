import { useEffect, useState } from "react"
import { useAuth } from "../auth/AuthProvider"
import ChangePasswordModal from "../auth/ChangePasswordModal"
import { DashboardIcon, ModuleTile, modules } from "../dashboard/DashboardComponents"
import ActiveEmployees from "../dashboard/ActiveEmployees"
import DashboardLayout from "../../layouts/DashboardLayout"
import { getUserDisplayName, hasUserRight } from "../../lib/auth"
import {
  canAccessModule,
  type ErpModuleKey,
} from "../../lib/rbac"
import {
  formatCurrencyStat,
  formatIntegerStat,
  getDashboardStats,
  type DashboardStats,
} from "../../lib/dashboard-api"

const MODULE_KEY_MAP: Record<string, ErpModuleKey> = {
  crm: "customers",
  inventory: "products",
  hr: "hr",
  sales: "sales",
  reports: "reports",
  users: "users",
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState("")
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    if (user?.mustChangePassword) {
      setStatsLoading(false)
      return
    }

    const controller = new AbortController()
    setStatsLoading(true)
    setStatsError("")

    getDashboardStats({
      signal: controller.signal,
      refresh: refreshCount > 0,
    })
      .then((data) => {
        setStats(data)
        setStatsLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setStatsError(err?.message || "Failed to load dashboard stats")
        setStatsLoading(false)
      })

    return () => controller.abort()
  }, [refreshCount])

  const kpiCards = [
    {
      label: "Customers",
      value: stats ? formatIntegerStat(stats.customers) : "—",
      icon: "crm" as const,
      subtext: "Active customer accounts",
      visible: canAccessModule(user, "customers"),
    },
    {
      label: "Products",
      value: stats ? formatIntegerStat(stats.products) : "—",
      icon: "inventory" as const,
      subtext: "Active catalog items",
      visible: canAccessModule(user, "products"),
    },
    {
      label: "Open Orders",
      value: stats ? formatIntegerStat(stats.openOrders) : "—",
      icon: "sales" as const,
      subtext: "Pending balance orders",
      visible: canAccessModule(user, "sales"),
    },
    {
      label: "Revenue",
      value: stats ? formatCurrencyStat(stats.revenue) : "—",
      icon: "sales" as const,
      subtext: "Total sales revenue",
      visible: canAccessModule(user, "sales"),
    },
  ].filter((card) => card.visible)

  const visibleModules = modules.filter(
    (module) => module.visible && canAccessModule(user, MODULE_KEY_MAP[module.id]),
  )
  const groups = [
    {
      title: "Manage your business",
      description: "Keep everyday records and transactions up to date.",
      items: visibleModules.filter((module) => !["reports", "users"].includes(module.id)),
    },
    {
      title: "Reports and access",
      description: "Review business reports and manage team access.",
      items: visibleModules.filter((module) => ["reports", "users"].includes(module.id)),
    },
  ].filter((group) => group.items.length > 0)

  return (
    <DashboardLayout>
      <main className="workspace-page">
        <div className="mx-auto max-w-5xl">
          <header className="workspace-page-header">
            <h1 className="workspace-page-title">Home</h1>
            <span className="text-xs text-neutral-500">HOPE, Inc.</span>
          </header>

          <div className="mb-7">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.4px] text-neutral-900 [overflow-wrap:anywhere] sm:text-2xl">
                Welcome back, {getUserDisplayName(user)}
              </h2>
              <p className="mt-2 text-[13px] leading-5 text-neutral-500">
                Everything you need to keep your work moving.
              </p>
            </div>
          </div>

          {statsError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              <span>{statsError}</span>
              <button
                type="button"
                onClick={() => setRefreshCount((current) => current + 1)}
                className="underline underline-offset-4 hover:text-red-950"
              >
                Try again
              </button>
            </div>
          )}

          {kpiCards.length > 0 && (
            <section aria-label="Key performance indicators" className="mb-7">
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${kpiCards.length >= 4 ? "lg:grid-cols-4" : kpiCards.length === 3 ? "lg:grid-cols-3" : ""}`}>
                {kpiCards.map((card) => (
                  <div key={card.label} className="workspace-panel p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        {card.label}
                      </span>
                      <span className="grid h-8 w-8 place-items-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600">
                        <DashboardIcon name={card.icon} className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="mt-3">
                      {statsLoading ? (
                        <div
                          aria-busy="true"
                          aria-label={`Loading ${card.label}`}
                          className="h-8 w-24 animate-pulse rounded bg-slate-200"
                        />
                      ) : (
                        <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
                          {card.value}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{card.subtext}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
            <section aria-label="ERP modules" className="space-y-5">
              {groups.map((group) => (
                <section key={group.title} aria-label={group.title} className="workspace-panel">
                  <div className="border-b border-neutral-100 px-5 py-4">
                    <h3 className="text-sm font-semibold text-neutral-900">{group.title}</h3>
                    <p className="mt-1 text-[13px] leading-5 text-neutral-500">{group.description}</p>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {group.items.map((module) => (
                      <ModuleTile key={module.id} module={module} />
                    ))}
                  </ul>
                </section>
              ))}
              {visibleModules.length === 0 && (
                <div className="workspace-panel px-6 py-10">
                  <DashboardIcon name="dashboard" className="mb-4 h-7 w-7 text-neutral-400" />
                  <h3 className="text-sm font-semibold">Your workspace is getting ready</h3>
                  <p className="mt-2 max-w-md text-[13px] leading-5 text-neutral-500">
                    You don’t have access to any business tools yet. Ask your administrator to set up access for your role.
                  </p>
                </div>
              )}
            </section>

            <aside aria-label="Workspace information" className="space-y-5">
              {hasUserRight(user, "activity.access") && !user?.mustChangePassword && <ActiveEmployees />}
              <section className="workspace-panel p-5">
                <h2 className="text-sm font-semibold">Your workspace</h2>
                <dl className="mt-4 space-y-4 text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-neutral-500">Business</dt>
                    <dd className="font-medium">HOPE, Inc.</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-neutral-500">Your role</dt>
                    <dd className="font-medium capitalize">{user?.role || "—"}</dd>
                  </div>
                  {user?.departmentName && (
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-neutral-500">Department</dt>
                      <dd className="break-words text-right font-medium">{user.departmentName}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                    <dt className="text-neutral-500">Available tools</dt>
                    <dd className="font-medium tabular-nums">{visibleModules.length}</dd>
                  </div>
                </dl>
              </section>
              <section className="px-1">
                <div className="flex items-center gap-2 text-[13px] font-medium text-neutral-700">
                  <DashboardIcon name="search" className="h-4 w-4" />
                  <h2>Find your next task</h2>
                </div>
                <p className="mt-2 text-[13px] leading-5 text-neutral-500">
                  Search the menu for a tool, or press{" "}
                  <kbd className="rounded border border-neutral-200 bg-white px-1 font-sans text-[11px]">
                    Ctrl K
                  </kbd>{" "}
                  to jump to search.
                </p>
              </section>
            </aside>
          </div>
        </div>
      </main>
      {user?.mustChangePassword && <ChangePasswordModal />}
    </DashboardLayout>
  )
}
