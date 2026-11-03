import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { authApi, type RegistrationNotifications as NotificationData } from "../../lib/auth"
import { notifyToast } from "../../lib/toast"
import { DashboardIcon } from "./DashboardComponents"

const queueUrl = "/users?view=accounts&status=pending&page=1"

export default function RegistrationNotifications() {
  const details = useRef<HTMLDetailsElement>(null)
  const seen = useRef<{ cutoff: number; ids: Set<string> } | null>(null)
  const [data, setData] = useState<NotificationData | null>(null)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    const load = async () => {
      if (pending || document.visibilityState === "hidden") return
      pending = true
      try {
        const result = await authApi.registrationNotifications(controller.signal)
        if (controller.signal.aborted) return
        if (seen.current && result.registrations.some((item) => !seen.current!.ids.has(item.userId) && Date.parse(item.createdAt) >= seen.current!.cutoff)) {
          notifyToast("A new employee registration is awaiting approval.", "info")
        }
        seen.current ??= { cutoff: result.registrations.length ? Date.parse(result.registrations[0].createdAt) : 0, ids: new Set() }
        result.registrations.forEach((item) => seen.current!.ids.add(item.userId))
        setData(result)
        setError("")
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load notifications.")
      } finally { pending = false }
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !details.current?.contains(event.target) && details.current) {
        details.current.open = false
        setOpen(false)
      }
    }
    void load()
    // shortcut: poll visible sessions every 30s; use push delivery if instant alerts become necessary.
    const timer = window.setInterval(() => void load(), 30000)
    window.addEventListener("focus", load)
    window.addEventListener("hope:registrations-changed", load)
    document.addEventListener("visibilitychange", load)
    document.addEventListener("pointerdown", outside)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener("focus", load)
      window.removeEventListener("hope:registrations-changed", load)
      document.removeEventListener("visibilitychange", load)
      document.removeEventListener("pointerdown", outside)
    }
  }, [retry])

  const close = () => { if (details.current) details.current.open = false; setOpen(false) }
  return (
    <details ref={details} className="relative shrink-0"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}
      onKeyDown={(event) => { if (event.key === "Escape") { close(); details.current?.querySelector("summary")?.focus() } }}>
      <summary aria-label={`Registration notifications${data ? `: ${data.total} pending` : ""}`} title="Registration notifications"
        className="relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg text-neutral-600 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 [&::-webkit-details-marker]:hidden">
        <DashboardIcon name="bell" className="h-5 w-5" />
        {Boolean(data?.total) && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-5 text-white">{data!.total > 99 ? "99+" : data!.total}</span>}
      </summary>
      {open && <section aria-label="Registration inbox" className="fixed inset-x-4 top-20 z-50 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80">
        <div className="border-b border-neutral-100 px-4 py-3"><h2 className="text-sm font-semibold">Registration notifications</h2><p className="mt-1 text-xs text-neutral-500">Review accounts waiting for approval.</p></div>
        {error ? <div role="alert" className="p-4 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => { details.current?.querySelector("summary")?.focus(); setRetry((value) => value + 1) }} className="workspace-secondary-action mt-3">Try again</button></div>
          : !data ? <p role="status" className="p-4 text-sm text-neutral-500">Loading notifications…</p>
            : data.total === 0 ? <p className="p-4 text-sm text-neutral-500">No registrations are waiting for approval.</p>
              : <ul className="workspace-scrollbar max-h-[min(20rem,calc(100dvh-14rem))] divide-y divide-neutral-100 overflow-y-auto">
                {data.registrations.map((item) => <li key={item.userId}><Link to={`${queueUrl}&search=${encodeURIComponent(item.email)}`} state={{ registrationEmail: item.email }} onClick={close} className="block px-4 py-3 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"><p className="text-[13px] font-semibold text-neutral-900">{item.name}</p><p className="mt-1 break-all text-xs text-neutral-500">{item.email}</p><p className="mt-1 text-xs text-neutral-500">Awaiting approval · {new Date(item.createdAt).toLocaleDateString()}</p></Link></li>)}
              </ul>}
        <Link to={queueUrl} state={{ registrationEmail: "" }} onClick={close} className="block border-t border-neutral-100 px-4 py-3 text-center text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600">View pending accounts{data ? ` (${data.total})` : ""}</Link>
      </section>}
    </details>
  )
}
