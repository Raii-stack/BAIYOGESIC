import { useEffect, useState } from "react"
import DashboardLayout from "../../layouts/DashboardLayout"
import NotificationList from "../common/NotificationList"
import { useWorkspace } from "../common/WorkspaceProvider"
import { emptyInbox, workspaceApi } from "../../lib/workspace-api"

export default function NotificationsPage() {
  const { inbox: latest, inboxError, read, refreshInbox } = useWorkspace()
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState(emptyInbox)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const inbox = page === 1 ? latest : history
  useEffect(() => {
    if (page === 1) return
    const controller = new AbortController(); setLoading(true); setError("")
    workspaceApi.inbox(page, controller.signal).then((result) => { if (!controller.signal.aborted) setHistory(result) })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load inbox.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, retry, latest])
  const markAll = async () => {
    try { await read(); setRetry((value) => value + 1) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update inbox.") }
  }
  return <DashboardLayout activeNavigation="Notifications"><main className="workspace-page"><div className="mx-auto max-w-3xl">
    <header className="workspace-page-header"><div><h1 className="workspace-page-title">Notifications</h1><p className="workspace-page-description">Your account updates and relevant business activity.</p></div><button type="button" disabled={!latest.unreadCount} onClick={() => void markAll()} className="workspace-secondary-action">Mark all read</button></header>
    {(error || inboxError) && <p role="alert" className="mb-4 text-sm text-red-700">{error || inboxError} <button type="button" className="underline" onClick={() => { setError(""); setRetry((value) => value + 1); void refreshInbox() }}>Retry loading inbox</button></p>}
    <section aria-label="Employee inbox" className="workspace-panel" aria-busy={loading}>{loading ? <p role="status" className="p-5 text-sm">Loading inbox page…</p> : inbox.items.length ? <NotificationList items={inbox.items} onRead={async () => setRetry((value) => value + 1)} /> : <p className="p-5 text-sm text-neutral-500">You’re all caught up. New notifications will appear here.</p>}</section>
    <nav aria-label="Inbox pagination" className="workspace-pagination mt-4"><button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="px-3 text-xs">Page {page} of {inbox.totalPages}</span><button disabled={loading || page >= inbox.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav>
  </div></main></DashboardLayout>
}
