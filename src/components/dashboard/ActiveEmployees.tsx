import { useEffect, useState } from "react"
import { authApi, type ActiveEmployee } from "../../lib/auth"
import { activityCache } from "../../lib/dashboard-live-cache"

export default function ActiveEmployees() {
  const cache = activityCache
  const [employees, setEmployees] = useState<ActiveEmployee[]>(() => cache.data ?? [])
  const [loading, setLoading] = useState(() => !cache.data)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    const load = async (force = false) => {
      if (pending || document.visibilityState === "hidden" || (!force && cache.data && Date.now() - cache.checkedAt < 60000)) return
      pending = true
      try {
        const result = await authApi.activeEmployees(controller.signal)
        if (!controller.signal.aborted) {
          cache.checkedAt = Date.now()
          if (JSON.stringify(cache.data) !== JSON.stringify(result.employees)) {
            cache.data = result.employees
            setEmployees(result.employees)
          }
          setError("")
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load active employees.")
      } finally {
        pending = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load(refresh > 0)
    const timer = window.setInterval(() => void load(), 60000)
    const visible = () => void load()
    document.addEventListener("visibilitychange", visible)
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", visible) }
  }, [refresh])

  return (
    <section aria-label="Active employees" className="workspace-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Employees online</h2>
        <span className="workspace-badge workspace-badge--neutral">{loading ? "Loading…" : error ? "Unavailable" : employees.length}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-500">Activity in the last 2 minutes. Updates every minute.</p>
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>
        : loading ? <p role="status" className="mt-4 text-sm text-neutral-500">Loading active employees…</p>
          : employees.length === 0 ? <p className="mt-4 text-sm text-neutral-500">No employees are currently online.</p>
            : <ul className="workspace-scrollbar mt-4 max-h-72 space-y-3 overflow-y-auto">
              {employees.map((employee) => <li key={employee.userId} className="flex items-start gap-2.5 text-[13px]">
                <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                <div className="min-w-0"><p className="break-words font-medium">{employee.name || employee.empno}</p><p className="mt-0.5 text-xs text-neutral-500">{employee.empno} · {new Date(employee.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>
              </li>)}
            </ul>}
      <button type="button" onClick={() => setRefresh((current) => current + 1)} disabled={loading} className="workspace-secondary-action mt-4 w-full">Refresh activity</button>
    </section>
  )
}
