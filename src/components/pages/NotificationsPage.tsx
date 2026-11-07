import { useEffect, useState } from "react"
import DashboardLayout from "../../layouts/DashboardLayout"
import NotificationList from "../common/NotificationList"
import { useWorkspace } from "../common/WorkspaceProvider"
import usePageQuery from "../../hooks/usePageQuery"

export default function NotificationsPage() {
  const { inbox: latest, inboxError, read, refreshInbox, cachedInboxPage, loadInboxPage } = useWorkspace()
  const [page, setPage] = usePageQuery()
  const [history, setHistory] = useState(() => cachedInboxPage(page))
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const inbox = page === 1 ? latest : history?.page === page ? history : cachedInboxPage(page)
  const loading = !inbox && !error
  useEffect(() => {
    if (page === 1) return
    let active = true; setError("")
    loadInboxPage(page).then((result) => {
      if (!active) return
      if (page > result.totalPages) setPage(Math.max(1, result.totalPages))
      else setHistory(result)
    })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load inbox.") })
    return () => { active = false }
  }, [page, retry, latest, loadInboxPage])
  const markAll = async () => {
    try { setError(""); await read() }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update inbox.") }
  }
  return <DashboardLayout activeNavigation="Notifications"><main className="workspace-page"><div className="mx-auto max-w-3xl">
    <header className="workspace-page-header"><div><h1 className="workspace-page-title">Notifications</h1><p className="workspace-page-description">Your account updates and relevant business activity.</p></div><button type="button" disabled={!latest.unreadCount} onClick={() => void markAll()} className="workspace-secondary-action">Mark all read</button></header>
    {(error || inboxError) && <p role="alert" className="mb-4 text-sm text-red-700">{error || inboxError} <button type="button" className="underline" onClick={() => { setError(""); setRetry((value) => value + 1); void refreshInbox() }}>Retry loading inbox</button></p>}
    <section aria-label="Employee inbox" className="workspace-panel" aria-busy={loading}>{loading ? <p role="status" className="p-5 text-sm">Loading inbox page…</p> : inbox?.items.length ? <NotificationList items={inbox.items} /> : <p className="p-5 text-sm text-neutral-500">{error ? "Unable to load this inbox page. Try again above." : "You’re all caught up. New notifications will appear here."}</p>}</section>
    <nav aria-label="Inbox pagination" className="workspace-pagination mt-4"><button disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="px-3 text-xs">Page {page} of {inbox?.totalPages ?? latest.totalPages}</span><button disabled={loading || page >= (inbox?.totalPages ?? latest.totalPages)} onClick={() => setPage(page + 1)}>Next</button></nav>
  </div></main></DashboardLayout>
}
