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
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
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
    collapse: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
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
  { label: "Home", icon: "dashboard", href: "/dashboard?view=overview" },
  { label: "Sales", icon: "sales", href: "/sales?view=transactions&page=1" },
  { label: "Products", icon: "inventory", href: "/inventory?view=products&page=1" },
  { label: "Customers", icon: "crm", href: "/customers?view=directory&page=1" },
  { label: "Employees", icon: "hr", href: "/employees?view=employees&page=1" },
  { label: "Reports", icon: "reports", href: "/reports?view=reports" },
  { label: "Users", icon: "userManagement", href: "/users?view=accounts&page=1" },
]

export const modules: ModuleDefinition[] = [
  {
    id: "crm",
    title: "Customers",
    description:
      "Customer accounts, payment terms, and contact details.",
    href: "/customers?view=directory&page=1",
    icon: "crm",
    visible: true,
  },
  {
    id: "inventory",
    title: "Products",
    description:
      "Product inventory, current pricing, and price history.",
    href: "/inventory?view=products&page=1",
    icon: "inventory",
    visible: true,
  },
  {
    id: "hr",
    title: "Employees",
    description:
      "Employee records, departments, and job history.",
    href: "/employees?view=employees&page=1",
    icon: "hr",
    visible: true,
  },
  {
    id: "sales",
    title: "Sales",
    description:
      "Sales transactions, order details, and payments.",
    href: "/sales?view=transactions&page=1",
    icon: "sales",
    visible: true,
  },
  {
    id: "reports",
    title: "Reports",
    description:
      "Operational reports to review, print, and export.",
    href: "/reports?view=reports",
    icon: "reports",
    visible: true,
  },
  {
    id: "users",
    title: "Users",
    description:
      "User accounts, roles, status, and module permissions.",
    href: "/users?view=accounts&page=1",
    icon: "userManagement",
    visible: true,
  },
]

export function DashboardLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex h-18 shrink-0 items-center overflow-hidden px-5">
      <img src="/assets/hope-mark.svg" alt="HOPE logo" width="40" height="40" className="h-10 w-10 shrink-0" />
      <div
        className={`ml-3 min-w-0 max-w-40 overflow-hidden transition-[max-width,opacity] duration-200 ease-out ${
          collapsed ? "lg:max-w-0 lg:opacity-0" : "lg:opacity-100"
        }`}
      >
        <p className="whitespace-nowrap text-sm font-semibold tracking-tight text-white">
          HOPE, Inc.
        </p>
        <p className="mt-0.5 whitespace-nowrap text-[11px] font-normal text-neutral-400">
          Business workspace
        </p>
      </div>
    </div>
  )
}

export function ModuleTile({ module }: { module: ModuleDefinition }) {
  return (
    <li>
      <Link
        to={module.href}
        className="group flex h-full items-center gap-3.5 px-5 py-4 transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
      >
        <span className="workspace-module-icon grid h-10 w-10 shrink-0 place-items-center rounded-lg border">
          <DashboardIcon name={module.icon} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-neutral-900">{module.title}</span>
          <span className="mt-0.5 block text-[13px] leading-5 text-neutral-500">{module.description}</span>
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-800" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 10h12m-4-4 4 4-4 4" />
        </svg>
      </Link>
    </li>
  )
}
