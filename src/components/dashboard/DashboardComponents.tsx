import type { ReactNode } from "react"
import { Link } from "react-router"

import type {
  DashboardIconName,
  ModuleDefinition,
  NavigationItem,
} from "../../types/dashboard"

export function DashboardIcon({
  name,
  className = "h-5 w-5",
}: {
  name: DashboardIconName
  className?: string
}) {
  const paths: Record<DashboardIconName, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
        <path d="M10 20h4" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    collapse: <path d="m14 6-6 6 6 6M20 4v16" />,
    crm: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 8h5M18.5 5.5v5" />
      </>
    ),
    inventory: (
      <>
        <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
        <path d="m4 12 8 4.5 8-4.5M4 16.5 12 21l8-4.5" />
      </>
    ),
    hr: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 16a4.5 4.5 0 0 1 6.5 4" />
      </>
    ),
    sales: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        <path d="m4 7 5-4 6 6 6-5" />
      </>
    ),
    reports: (
      <>
        <path d="M5 3h10l4 4v14H5V3Z" />
        <path d="M15 3v5h5M8 17v-4M12 17V9M16 17v-6" />
      </>
    ),
    userManagement: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0M17 8v6M14 11h6" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", icon: "dashboard", href: "/dashboard" },
  { label: "Customers", icon: "crm", href: "/customers" },
  { label: "Products", icon: "inventory", href: "/inventory" },
  { label: "Human Resources", icon: "hr", href: "/employees" },
  { label: "Sales", icon: "sales", href: "/sales" },
  { label: "Reports", icon: "reports", href: "/reports" },
  { label: "User Management", icon: "userManagement", href: "/users" },
]

export const modules: ModuleDefinition[] = [
  {
    id: "crm",
    index: "01",
    title: "CRM",
    description:
      "Manage customer relationships, account activity, and communication records.",
    href: "/customers",
    icon: "crm",
    accent: "border-t-blue-700",
    iconStyle: "bg-blue-50 text-blue-800",
    visible: true,
  },
  {
    id: "inventory",
    index: "02",
    title: "Inventory",
    description:
      "Track stock levels, item movement, warehousing, and product availability.",
    href: "/inventory",
    icon: "inventory",
    accent: "border-t-amber-600",
    iconStyle: "bg-amber-50 text-amber-800",
    visible: true,
  },
  {
    id: "hr",
    index: "03",
    title: "Human Resources",
    description:
      "Maintain employee records, organizational details, and workforce processes.",
    href: "/employees",
    icon: "hr",
    accent: "border-t-emerald-700",
    iconStyle: "bg-emerald-50 text-emerald-800",
    visible: true,
  },
  {
    id: "sales",
    index: "04",
    title: "Sales",
    description:
      "Coordinate sales activity, order workflows, and commercial performance.",
    href: "/sales",
    icon: "sales",
    accent: "border-t-violet-700",
    iconStyle: "bg-violet-50 text-violet-800",
    visible: true,
  },
]

export function DashboardLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={`flex h-20 items-center border-b border-white/10 px-5 ${
        collapsed ? "lg:justify-center lg:px-0" : ""
      }`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white text-[#0d2743]">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M6 4v16M18 4v16M6 12h12" />
        </svg>
      </div>
      <div
        className={`ml-3 min-w-0 transition-opacity ${
          collapsed ? "lg:pointer-events-none lg:w-0 lg:opacity-0" : ""
        }`}
      >
        <p className="whitespace-nowrap text-sm font-bold text-white">
          HOPE, Inc.
        </p>
        <p className="mt-0.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-200">
          Enterprise Resource Planning
        </p>
      </div>
    </div>
  )
}

export function ModuleTile({ module }: { module: ModuleDefinition }) {
  return (
    <article
      className={`group flex min-h-[280px] flex-col border border-slate-200 border-t-[3px] bg-white p-6 transition hover:border-x-slate-300 hover:border-b-slate-300 sm:p-7 ${module.accent}`}
    >
      <div className="flex items-start justify-between gap-5">
        <div
          className={`grid h-12 w-12 place-items-center rounded-lg ${module.iconStyle}`}
        >
          <DashboardIcon name={module.icon} className="h-6 w-6" />
        </div>
        <span className="font-mono text-xs tracking-[0.12em] text-slate-400">
          {module.index}
        </span>
      </div>
      <div className="mt-8">
        <h2 className="text-xl font-bold tracking-[-0.025em] text-slate-950">
          {module.title}
        </h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
          {module.description}
        </p>
      </div>
      <div className="mt-auto border-t border-slate-100 pt-5">
        {module.href ? (
          <Link
            to={module.href}
            className="flex w-fit items-center gap-2 text-sm font-bold text-blue-800 transition hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-4"
          >
            Go to module
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10h12m-4-4 4 4-4 4" />
            </svg>
          </Link>
        ) : (
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-bold text-blue-800 transition hover:text-blue-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-4"
          >
            Go to module
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10h12m-4-4 4 4-4 4" />
            </svg>
          </button>
        )}
      </div>
    </article>
  )
}
