import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router"

import {
  DashboardIcon,
  DashboardLogo,
  navigationItems,
} from "../components/dashboard/DashboardComponents"

type DashboardLayoutProps = {
  children: ReactNode
  activeNavigation?: string
  searchPlaceholder?: string
}

const sidebarPreferenceKey = "hope-erp-sidebar-collapsed"

export default function DashboardLayout({
  children,
  activeNavigation = "Dashboard",
  searchPlaceholder = "Search workspace",
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(sidebarPreferenceKey) === "true",
  )
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(
      sidebarPreferenceKey,
      String(sidebarCollapsed),
    )
  }, [sidebarCollapsed])

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans text-slate-950 antialiased">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0d2743] text-white transition-[width,transform] duration-200 lg:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        <DashboardLogo collapsed={sidebarCollapsed} />

        <nav aria-label="Primary navigation" className="flex-1 px-3 py-6">
          <p
            className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300/70 ${
              sidebarCollapsed ? "lg:sr-only" : ""
            }`}
          >
            Workspace
          </p>
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const active = item.label === activeNavigation
              const className = `flex h-11 w-full items-center rounded-md text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                sidebarCollapsed ? "lg:justify-center lg:px-0" : "gap-3 px-3"
              } ${
                active
                  ? "bg-white text-[#0d2743]"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`
              const content = (
                <>
                  <DashboardIcon
                    name={item.icon}
                    className="h-[18px] w-[18px] shrink-0"
                  />
                  <span
                    className={
                      sidebarCollapsed
                        ? "lg:pointer-events-none lg:absolute lg:opacity-0"
                        : ""
                    }
                  >
                    {item.label}
                  </span>
                </>
              )

              return (
                <li key={item.label}>
                  {item.label === "Dashboard" ? (
                    <Link
                      to="/dashboard"
                      title={sidebarCollapsed ? item.label : undefined}
                      className={className}
                      onClick={() => setMobileSidebarOpen(false)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      title={sidebarCollapsed ? item.label : undefined}
                      className={className}
                    >
                      {content}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className={`hidden h-10 w-full items-center rounded-md text-xs font-semibold text-slate-300 transition hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:flex ${
              sidebarCollapsed ? "justify-center" : "gap-3 px-3"
            }`}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            <DashboardIcon
              name="collapse"
              className={`h-[18px] w-[18px] transition-transform ${
                sidebarCollapsed ? "rotate-180" : ""
              }`}
            />
            {!sidebarCollapsed && <span>Collapse sidebar</span>}
          </button>
          <p
            className={`px-3 pt-4 text-[10px] leading-4 text-slate-400 ${
              sidebarCollapsed ? "lg:hidden" : ""
            }`}
          >
            HOPE ERP · Secure workspace
          </p>
        </div>
      </aside>

      <div
        className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ${
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:gap-5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 lg:hidden"
          >
            <DashboardIcon name="menu" />
          </button>

          <label className="relative min-w-0 max-w-xl flex-1">
            <span className="sr-only">{searchPlaceholder}</span>
            <DashboardIcon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
            />
          </label>

          <button
            type="button"
            aria-label="Notifications"
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            <DashboardIcon name="bell" className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-blue-700" />
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-3 border-l border-slate-200 pl-3 sm:pl-5">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0d2743] text-xs font-bold text-white">
              SA
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-900">Account</p>
              <span className="mt-0.5 inline-block border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-blue-800">
                Superadmin
              </span>
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
