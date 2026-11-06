import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router"
import { useWorkspace } from "../common/WorkspaceProvider"
import NotificationList from "../common/NotificationList"
import RegistrationNotifications from "./RegistrationNotifications"
import { DashboardIcon } from "./DashboardComponents"

export default function WorkspaceNotifications({ canApprove }: { canApprove: boolean }) {
  const { inbox, inboxError, refreshInbox, read, preferences } = useWorkspace()
  const [pending, setPending] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState("")
  const details = useRef<HTMLDetailsElement>(null)
  const { pathname, search } = useLocation()
  const close = () => { if (details.current) details.current.open = false; setOpen(false) }
  useEffect(() => { close() }, [pathname, search])
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !details.current?.contains(event.target)) close() }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [])
  const count = inbox.unreadCount + (canApprove ? pending : 0)
  return <details ref={details} className="relative shrink-0" onToggle={(event) => setOpen(event.currentTarget.open)} onKeyDown={(event) => { if (event.key === "Escape") { close(); details.current?.querySelector("summary")?.focus() } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
    <summary title="Notifications" aria-label={`Notifications: ${inbox.unreadCount} unread${canApprove ? `, ${pending} pending registrations` : ""}`} className="relative grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg text-neutral-600 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 [&::-webkit-details-marker]:hidden"><DashboardIcon name="bell" />{count > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-5 text-white">{count > 99 ? "99+" : count}</span>}</summary>
    <section hidden={!open} aria-label="Notification center" className="workspace-scrollbar fixed inset-x-4 top-20 z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3"><h2 className="text-sm font-semibold">Notifications <span className="font-normal text-neutral-500">({inbox.unreadCount} unread)</span></h2><button type="button" disabled={!inbox.unreadCount} className="workspace-text-action text-xs" onClick={() => { setError(""); void read().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to update inbox.")) }}>Mark all read</button></div>
      {(inboxError || error) && <div role="alert" className="p-4 text-xs text-red-700">{error || inboxError} <button type="button" className="underline" onClick={() => { setError(""); void refreshInbox() }}>Retry</button></div>}
      {inbox.items.length ? <NotificationList items={inbox.items.slice(0, 5)} /> : <p className="p-4 text-xs text-neutral-500">You’re all caught up.</p>}
      <Link to="/notifications" className="block border-t border-neutral-100 px-4 py-3 text-center text-[13px] font-semibold hover:bg-neutral-50">View all notifications</Link>
      {canApprove && <RegistrationNotifications embedded onPendingCount={setPending} popups={preferences.popups} />}
    </section>
  </details>
}
