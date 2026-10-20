import { useEffect, useState } from "react"
import { TOAST_EVENT, type ToastNotice } from "../../lib/toast"

export default function ToastHost() {
  const [notices, setNotices] = useState<ToastNotice[]>([])
  useEffect(() => {
    const onNotice = (event: Event) => setNotices((current) => [...current, (event as CustomEvent<ToastNotice>).detail].slice(-4))
    window.addEventListener(TOAST_EVENT, onNotice)
    return () => window.removeEventListener(TOAST_EVENT, onNotice)
  }, [])
  useEffect(() => {
    if (!notices.length) return
    const timer = window.setTimeout(() => setNotices((current) => current.slice(1)), 4500)
    return () => window.clearTimeout(timer)
  }, [notices])
  if (!notices.length) return null
  return <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
    {notices.map((notice) => <div key={notice.id} role={notice.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-4 shadow-[0_16px_48px_rgba(15,39,67,0.18)] ${notice.kind === "error" ? "border-red-200 text-red-900" : notice.kind === "info" ? "border-amber-200 text-amber-900" : "border-emerald-200 text-emerald-900"}`}>
      <span aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notice.kind === "error" ? "bg-red-600" : notice.kind === "info" ? "bg-amber-500" : "bg-emerald-600"}`} />
      <p className="flex-1 text-sm font-semibold leading-5">{notice.message}</p>
      <button type="button" onClick={() => setNotices((current) => current.filter((item) => item.id !== notice.id))} aria-label="Dismiss notification" className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded text-slate-500 hover:bg-slate-100">×</button>
    </div>)}
  </div>
}
