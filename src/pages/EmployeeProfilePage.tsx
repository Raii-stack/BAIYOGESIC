import CareerTimeline from "../components/employees/CareerTimeline"
import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { useAuth } from "../components/auth/AuthProvider"
import DashboardLayout from "../layouts/DashboardLayout"
import { employeeApi } from "../lib/employee-api"
import { getHrPermissions } from "../lib/rbac"
import type { Employee, JobHistoryEntry } from "../types/employee"

export default function EmployeeProfilePage() {
  const { user } = useAuth()
  const { canViewHistory, canViewAudit } = getHrPermissions(user)
  const { employeeId } = useParams()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [history, setHistory] = useState<JobHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!employeeId) return
    const controller = new AbortController()
    setLoading(true)
    setError("")
    employeeApi.get(employeeId, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setEmployee(result.employee)
        setHistory(result.history)
      }
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Unable to load employee.")
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [employeeId, refresh])

  return (
    <DashboardLayout activeNavigation="Employees" searchPlaceholder="Search workspace">
      <main className="workspace-page">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div aria-busy="true" className="space-y-5">
              <div className="h-48 animate-pulse rounded-lg bg-slate-200" />
              {canViewHistory && (
                <section className="workspace-panel">
                  <CareerTimeline entries={[]} loading={true} showAudit={canViewAudit} />
                </section>
              )}
            </div>
          ) : error ? (
            <div role="alert" className="border-l-2 border-red-600 bg-red-50 p-5 text-sm text-red-800">
              {error}{" "}
              <button
                type="button"
                onClick={() => setRefresh((current) => current + 1)}
                className="ml-3 font-bold underline"
              >
                Try again
              </button>
            </div>
          ) : (
            employee && (
              <>
                <section aria-labelledby="employee-profile-title" className="workspace-panel">
                  <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#c5eed2] text-xl font-semibold text-[#163c25]">
                      {[employee.firstName?.[0], employee.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "E"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-mono text-xs font-bold text-blue-800">{employee.id}</p>
                        {canViewAudit && (
                          <span
                            className={`workspace-badge workspace-profile-badge ${
                              employee.archived
                                ? "bg-slate-200 text-slate-700"
                                : employee.separationDate
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {employee.archived ? "Archived" : employee.separationDate ? "Separated" : "Active"}
                          </span>
                        )}
                      </div>
                      <h1 id="employee-profile-title" className="workspace-page-title mt-2">
                        {employee.fullName}
                      </h1>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        {employee.jobTitle} · {employee.department}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{employee.email}</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-slate-200 pt-5 text-sm sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                      <div>
                        <dt className="text-xs font-medium text-neutral-500">Hire date</dt>
                        <dd className="mt-1 font-mono text-xs text-slate-800">{employee.hireDate || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-neutral-500">Separation</dt>
                        <dd className="mt-1 font-mono text-xs text-slate-800">{employee.separationDate || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                </section>
                {canViewHistory && (
                  <section aria-labelledby="job-history-title" className="workspace-panel mt-4">
                    <div className="workspace-table-header">
                      <div>
                        <h2 id="job-history-title" className="mt-1 text-xl font-bold text-slate-950">
                          Job history
                        </h2>
                        <p>Most recent assignment first</p>
                      </div>
                    </div>
                    <CareerTimeline entries={history} loading={false} showAudit={canViewAudit} />
                  </section>
                )}
              </>
            )
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}
