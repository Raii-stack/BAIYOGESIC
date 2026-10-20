import { useAuth } from "../auth/AuthProvider"
import {
  ModuleTile,
  modules,
} from "../dashboard/DashboardComponents"
import DashboardLayout from "../../layouts/DashboardLayout"
import { canAccessModule, type ErpModuleKey } from "../../lib/rbac"

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
  const visibleModules = modules.filter((module) => {
    if (!module.visible) return false
    const key = MODULE_KEY_MAP[module.id]
    return !key || canAccessModule(user, key)
  })

  return (
    <DashboardLayout>
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-5 border-b border-slate-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                System / Module directory
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Main Dashboard
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Select an authorized workspace to continue.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <span className="h-2 w-2 bg-emerald-600" />
              {visibleModules.length} modules available
            </div>
          </div>

          <section
            aria-label="ERP modules"
            className="grid gap-4 md:grid-cols-2 xl:gap-5"
          >
            {visibleModules.map((module) => (
              <ModuleTile key={module.id} module={module} />
            ))}
          </section>
          {visibleModules.length === 0 && (
            <div className="rounded-lg border border-slate-300 bg-white px-6 py-14 text-center">
              <p className="text-sm font-semibold text-slate-800">
                No modules have been assigned to your account yet.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Contact an administrator to request module permissions.
              </p>
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}
