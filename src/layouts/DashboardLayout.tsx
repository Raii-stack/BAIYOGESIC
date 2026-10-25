import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon, DashboardLogo, modules, navigationItems } from "../components/dashboard/DashboardComponents"
import { safeErrorMessage } from "../lib/api-errors"
import { getUserDisplayName, getUserInitials } from "../lib/auth"
import { canAccessModule, type ErpModuleKey } from "../lib/rbac"
import { notifyToast } from "../lib/toast"

const HREF_MODULE_MAP: Record<string, ErpModuleKey> = {
  "/customers": "customers",
  "/inventory": "products",
  "/employees": "hr",
  "/sales": "sales",
  "/reports": "reports",
  "/users": "users",
}

type DashboardLayoutProps = {
  children: ReactNode
  activeNavigation?: string
  searchPlaceholder?: string
}

const sidebarPreferenceKey = "hope-erp-sidebar-collapsed"

function pathnameFromHref(href: string) {
  return href.split("?", 1)[0]
}

export default function DashboardLayout({ children, activeNavigation = "Home", searchPlaceholder = "Search workspace" }: DashboardLayoutProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { logout, user } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem(sidebarPreferenceKey) === "true")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const accountRef = useRef<HTMLDetailsElement>(null)
  const displayName = getUserDisplayName(user)
  const visibleNavigation = useMemo(() => navigationItems.filter((item) => {
    const moduleKey = item.href ? HREF_MODULE_MAP[pathnameFromHref(item.href)] : undefined
    return !moduleKey || canAccessModule(user, moduleKey)
  }), [user])
  const navigationGroups = [
    { label: "Business", items: visibleNavigation.filter((item) => !["Employees", "Users"].includes(item.label)) },
    { label: "Organization", items: visibleNavigation.filter((item) => ["Employees", "Users"].includes(item.label)) },
  ].filter((group) => group.items.length > 0)
  const currentItem = visibleNavigation.find((item) => item.href && (pathname === pathnameFromHref(item.href) || pathname.startsWith(`${pathnameFromHref(item.href)}/`)))
  const isHome = pathname === "/dashboard"
  const isSubPage = currentItem?.href && pathname !== pathnameFromHref(currentItem.href)
  const pageLabel = pathname === "/profile" ? "My account" : pathname === "/sales/new" ? "Create sale" : isSubPage ? "Employee details" : currentItem?.label || activeNavigation
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return modules.filter((module) => {
      const key = HREF_MODULE_MAP[pathnameFromHref(module.href)]
      return module.visible && (!key || canAccessModule(user, key)) && `${module.title} ${module.description}`.toLowerCase().includes(query)
    }).slice(0, 6)
  }, [search, user])

  const closeMobileNavigation = () => {
    setMobileSidebarOpen(false)
    menuButtonRef.current?.focus()
  }

  const focusSearch = () => {
    setSidebarCollapsed(false)
    if (window.innerWidth < 1024) setMobileSidebarOpen(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    if (!searchResults[0]) return
    navigate(searchResults[0].href)
    setSearch("")
    setMobileSidebarOpen(false)
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/", { replace: true })
    } catch (error) {
      notifyToast(safeErrorMessage(error), "error")
    }
  }

  useEffect(() => {
    window.localStorage.setItem(sidebarPreferenceKey, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    document.title = `${pageLabel} | HOPE, Inc.`
  }, [pageLabel])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        focusSearch()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!mobileSidebarOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    sidebarRef.current?.querySelector<HTMLAnchorElement>("nav a")?.focus()
    const closeOnDesktop = () => { if (window.innerWidth >= 1024) setMobileSidebarOpen(false) }
    window.addEventListener("resize", closeOnDesktop)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("resize", closeOnDesktop)
    }
  }, [mobileSidebarOpen])

  return (
    <div className="erp-workspace flex min-h-screen bg-[#1c1c1c] font-sans text-neutral-900 antialiased">
      {mobileSidebarOpen && <button type="button" aria-label="Close navigation" onClick={closeMobileNavigation} className="fixed inset-0 z-30 bg-black/45 lg:hidden" />}

      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        onKeyDown={(event) => {
          if (event.key === "Escape") { setSearch(""); closeMobileNavigation() }
          if (event.key !== "Tab" || !mobileSidebarOpen) return
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a, button, input")).filter((element) => element.getClientRects().length > 0)
          const first = controls[0]
          const last = controls.at(-1)
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }}
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col overflow-x-clip bg-[#1c1c1c] text-neutral-200 transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none lg:visible lg:translate-x-0 ${mobileSidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full"} ${sidebarCollapsed ? "lg:w-20" : "lg:w-60"}`}
      >
        <DashboardLogo collapsed={sidebarCollapsed} />

        <form onSubmit={submitSearch} className="relative mx-3 mb-5 h-10" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setSearch("") }}>
          <button type="button" onClick={focusSearch} aria-label="Open search" title="Search (Ctrl+K)" className={`absolute inset-0 z-10 hidden h-10 w-full items-center rounded-lg px-5 text-neutral-300 transition-opacity duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:flex ${sidebarCollapsed ? "lg:pointer-events-auto lg:opacity-100" : "lg:pointer-events-none lg:opacity-0"}`}><DashboardIcon name="search" className="h-4 w-4" /></button>
          <div className={`relative transition-opacity duration-150 ${sidebarCollapsed ? "lg:pointer-events-none lg:opacity-0" : "lg:opacity-100"}`}>
            <DashboardIcon name="search" className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && search) { event.stopPropagation(); setSearch("") }
                if (event.key === "ArrowDown") { event.preventDefault(); document.getElementById("workspace-search-results")?.querySelector<HTMLAnchorElement>("a")?.focus() }
              }}
              placeholder="Search"
              aria-label={searchPlaceholder}
              aria-controls="workspace-search-results"
              aria-expanded={Boolean(search.trim())}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-12 pr-12 text-[13px] text-white outline-none transition placeholder:text-neutral-400 hover:bg-white/10 focus:border-neutral-400 focus:bg-white/10 focus:ring-2 focus:ring-blue-400"
            />
            {!search && <kbd aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-sans text-[10px] text-neutral-500">Ctrl K</kbd>}
          </div>
          {search.trim() && (
            <div className={`absolute inset-x-0 top-12 z-50 min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-xl ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="border-b border-neutral-100 px-4 py-3 text-xs font-medium text-neutral-500">{searchResults.length} {searchResults.length === 1 ? "result" : "results"}</p>
              <div id="workspace-search-results" role="listbox" aria-label="Workspace search results" className="max-h-[min(24rem,calc(100dvh-11rem))] overflow-y-auto overscroll-contain">
                {searchResults.map((module) => (
                  <Link key={module.id} to={module.href} role="option" aria-selected="false" onClick={() => { setSearch(""); setMobileSidebarOpen(false) }} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 hover:bg-neutral-50 focus-visible:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">
                    <DashboardIcon name={module.icon} className="h-5 w-5 shrink-0 text-neutral-500" />
                    <span className="min-w-0 [overflow-wrap:anywhere]"><span className="block text-[13px] font-semibold">{module.title}</span><span className="mt-0.5 block text-xs leading-5 text-neutral-500">{module.description}</span></span>
                  </Link>
                ))}
              </div>
              {searchResults.length === 0 && <p role="status" className="px-4 py-5 text-[13px] leading-5 text-neutral-500">No matching modules. Try a different name.</p>}
            </div>
          )}
        </form>

        <nav aria-label="Primary navigation" className="min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-3 pb-5">
          {navigationGroups.map((group, index) => (
            <div key={group.label}>
              {index > 0 && <p className={`mb-2 whitespace-nowrap px-3 text-xs font-medium text-neutral-500 transition-opacity duration-150 ${sidebarCollapsed ? "lg:opacity-0" : "lg:opacity-100"}`}>{group.label}</p>}
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link to={item.href || "/dashboard?view=overview"} title={sidebarCollapsed ? item.label : undefined} aria-current={currentItem?.label === item.label ? "page" : undefined} onClick={() => setMobileSidebarOpen(false)} className={`grid h-10 grid-cols-[56px_minmax(0,1fr)] items-center rounded-lg text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${currentItem?.label === item.label ? "bg-white/12 font-semibold text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"}`}>
                      <DashboardIcon name={item.icon} className="h-[18px] w-[18px] shrink-0 justify-self-center" />
                      <span className={`-ml-2 max-w-40 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${sidebarCollapsed ? "lg:max-w-0 lg:opacity-0" : "lg:opacity-100"}`}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 space-y-1 border-t border-white/10 p-3">
          <Link to="/profile?view=account" aria-label={`${displayName}, ${user?.role || "Workspace user"}. View profile`} title={sidebarCollapsed ? "My account" : undefined} aria-current={pathname === "/profile" ? "page" : undefined} onClick={() => setMobileSidebarOpen(false)} className={`grid h-[52px] grid-cols-[56px_minmax(0,1fr)] items-center rounded-lg transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${pathname === "/profile" ? "bg-white/10" : ""}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center justify-self-center rounded-lg bg-[#c5eed2] text-[11px] font-semibold text-[#163c25]">{getUserInitials(user)}</span>
            <span className={`min-w-0 max-w-36 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out ${sidebarCollapsed ? "lg:max-w-0 lg:opacity-0" : "lg:opacity-100"}`}><span className="block truncate text-[13px] font-medium text-neutral-100">{displayName}</span><span className="mt-0.5 block text-[11px] text-neutral-500">My account</span></span>
          </Link>
          <button type="button" onClick={handleLogout} aria-label="Log out" title="Log out" className="grid h-9 w-full grid-cols-[56px_minmax(0,1fr)] items-center rounded-lg text-xs text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 justify-self-center" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg>
            <span className={`-ml-2 max-w-20 overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity] duration-200 ease-out ${sidebarCollapsed ? "lg:max-w-0 lg:opacity-0" : "lg:opacity-100"}`}>Log out</span>
          </button>
          <button type="button" onClick={() => setSidebarCollapsed((current) => !current)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : undefined} className="hidden h-9 w-full grid-cols-[56px_minmax(0,1fr)] items-center overflow-hidden rounded-lg text-xs text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:grid">
            <DashboardIcon name="collapse" className="h-[18px] w-[18px] justify-self-center" />
            <span className={`-ml-2 max-w-32 overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity] duration-200 ease-out ${sidebarCollapsed ? "max-w-0 opacity-0" : "opacity-100"}`}>Collapse menu</span>
          </button>
        </div>
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col bg-[#f6f6f7] transition-[margin] duration-300 ease-in-out motion-reduce:transition-none lg:mt-2 lg:min-h-[calc(100vh-0.5rem)] lg:rounded-tl-2xl ${sidebarCollapsed ? "lg:ml-20" : "lg:ml-60"}`}>
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-neutral-200/70 bg-[#f6f6f7] px-4 sm:px-8 lg:rounded-tl-2xl xl:px-12">
          <button ref={menuButtonRef} type="button" onClick={() => setMobileSidebarOpen(true)} aria-label="Open navigation" aria-expanded={mobileSidebarOpen} aria-controls="workspace-navigation" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"><DashboardIcon name="menu" /></button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-neutral-500">
            {isHome ? <span aria-current="page" className="font-medium text-neutral-700">Home</span> : <>
              <Link to="/dashboard?view=overview" className="rounded hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Home</Link>
              <span aria-hidden="true" className="text-neutral-400">/</span>
              {isSubPage && currentItem?.href && <><Link to={currentItem.href} className="rounded hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{currentItem.label}</Link><span aria-hidden="true" className="text-neutral-400">/</span></>}
              <span aria-current="page" className="truncate font-medium text-neutral-700">{pageLabel}</span>
            </>}
          </nav>
          <button type="button" onClick={focusSearch} aria-label="Open search" title="Search (Ctrl+K)" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"><DashboardIcon name="search" className="h-[18px] w-[18px]" /></button>
          <details ref={accountRef} className="relative shrink-0" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }} onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus() } }}>
            <summary aria-label="Account menu" className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1.5 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 [&::-webkit-details-marker]:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#c5eed2] text-[11px] font-semibold text-[#163c25]">{getUserInitials(user)}</span>
              <span className="hidden max-w-32 truncate text-[13px] font-medium text-neutral-700 sm:block">{displayName}</span>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
            </summary>
            <div className="absolute right-0 top-13 z-50 w-64 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
              <div className="mb-1 border-b border-neutral-100 px-3 py-3"><p className="truncate text-[13px] font-semibold">{displayName}</p><p className="mt-1 truncate text-xs text-neutral-500">{user?.email}</p><p className="mt-1 text-xs capitalize text-neutral-500">{user?.role}</p></div>
              <Link to="/profile?view=account" onClick={() => { if (accountRef.current) accountRef.current.open = false }} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><DashboardIcon name="profile" className="h-4 w-4" />My account</Link>
              <button type="button" onClick={handleLogout} className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Log out</button>
            </div>
          </details>
        </header>
        {children}
      </div>
    </div>
  )
}
