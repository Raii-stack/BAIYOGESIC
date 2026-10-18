import {
  ModuleTile,
  modules,
} from "../dashboard/DashboardComponents"
import DashboardLayout from "../../layouts/DashboardLayout"

export default function DashboardPage() {
  const visibleModules = modules.filter((module) => module.visible)

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
        </div>
      </main>
    </DashboardLayout>
  )
}
