import { useState } from "react"
import { useNavigate } from "react-router"
import { useWorkspace } from "./WorkspaceProvider"
import { useAuth } from "../auth/AuthProvider"
import { workspaceApi, type NotificationItem } from "../../lib/workspace-api"

export default function NotificationList({ items, onRead }: { items: NotificationItem[]; onRead?: () => Promise<void> }) {
  const { read } = useWorkspace()
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const open = async (item: NotificationItem) => {
    setError(""); setBusy(item.id)
    try {
      const { href } = await workspaceApi.open(item.id)
      if (item.category === "account" || item.category === "employment") await refreshUser()
      await read(item.id); await onRead?.()
      if (href && href.startsWith("/") && !href.startsWith("//")) navigate(href)
      else setError("This record is unavailable or you no longer have access to it.")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to open notification.") }
    finally { setBusy(null) }
  }
  const markRead = async (item: NotificationItem) => {
    setError(""); setBusy(item.id)
    try { await read(item.id); await onRead?.() }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to mark notification as read.") }
    finally { setBusy(null) }
  }
  return <>
    {error && <p role="alert" className="p-4 text-sm text-red-700">{error}</p>}
    <ul className="divide-y divide-neutral-100">{items.map((item) => <li key={item.id} className={item.readAt ? "" : "bg-blue-50/40"}>
      <button type="button" disabled={busy !== null} onClick={() => void open(item)} className="block w-full px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"><span className="flex items-center gap-2"><span className="text-[13px] font-semibold">{item.title}</span>{!item.readAt && <span className="workspace-badge workspace-badge--neutral">Unread</span>}</span><span className="mt-1 block text-xs leading-5 text-neutral-600">{item.message}</span><time dateTime={item.createdAt} className="mt-1 block text-[11px] text-neutral-500">{new Date(item.createdAt).toLocaleString()}</time></button>
      {!item.readAt && <button type="button" disabled={busy !== null} onClick={() => void markRead(item)} aria-label={`Mark ${item.title} as read`} className="workspace-text-action ml-3 mb-2 text-xs">Mark read</button>}
    </li>)}</ul>
  </>
}
