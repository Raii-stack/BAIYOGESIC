import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import DashboardLayout from "../layouts/DashboardLayout"
import { employeeApi } from "../lib/employee-api"
import type { Employee, JobHistoryEntry } from "../types/employee"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export default function EmployeeProfilePage() {
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
      if (!controller.signal.aborted) { setEmployee(result.employee); setHistory(result.history) }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load employee.")
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [employeeId, refresh])

  return <DashboardLayout activeNavigation="Human Resources" searchPlaceholder="Search workspace"><main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12"><div className="mx-auto max-w-7xl">
    <nav className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500"><Link to="/employees" className="hover:text-blue-800">Employee Directory</Link><span>/</span><span className="text-slate-800">Employee Profile</span></nav>
    {loading ? <div aria-busy="true" className="space-y-5"><div className="h-48 animate-pulse rounded-lg bg-slate-200" /><div className="h-80 animate-pulse rounded-lg bg-slate-200" /></div> : error ? <div role="alert" className="border-l-2 border-red-600 bg-red-50 p-5 text-sm text-red-800">{error} <button type="button" onClick={() => setRefresh((current) => current + 1)} className="ml-3 font-bold underline">Try again</button></div> : employee && <>
      <section aria-labelledby="employee-profile-title" className="rounded-lg border border-slate-300 border-t-[3px] border-t-blue-800 bg-white shadow-sm"><div className="flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-center sm:px-8"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#0d2743] text-xl font-bold text-white">{[employee.firstName?.[0], employee.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "E"}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><p className="font-mono text-xs font-bold text-blue-800">{employee.id}</p><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${employee.archived ? "bg-slate-200 text-slate-700" : employee.separationDate ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>{employee.archived ? "Archived" : employee.separationDate ? "Separated" : "Active"}</span></div><h1 id="employee-profile-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{employee.fullName}</h1><p className="mt-2 text-sm font-semibold text-slate-700">{employee.jobTitle} · {employee.department}</p><p className="mt-1 text-sm text-slate-500">{employee.email}</p></div><dl className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-slate-200 pt-5 text-sm sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0"><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Hire date</dt><dd className="mt-1 font-mono text-xs text-slate-800">{employee.hireDate || "—"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Separation</dt><dd className="mt-1 font-mono text-xs text-slate-800">{employee.separationDate || "—"}</dd></div></dl></div></section>
      <section aria-labelledby="job-history-title" className="mt-5 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">Employment record</p><h2 id="job-history-title" className="mt-1 text-xl font-bold text-slate-950">Job history</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50">{["Effective date", "Job title", "Department", "Salary", "Last change"].map((heading) => <th key={heading} className="px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{heading}</th>)}</tr></thead><tbody>{history.map((entry, index) => <tr key={entry.id} className={`border-b border-slate-100 last:border-0 ${index === 0 ? "bg-blue-50/40" : ""}`}><td className="px-6 py-4 font-mono text-xs text-slate-700">{entry.effectiveDate}</td><td className="px-6 py-4 text-sm font-semibold text-slate-900">{entry.jobTitle}</td><td className="px-6 py-4 text-sm text-slate-700">{entry.department}</td><td className="px-6 py-4 text-sm font-semibold text-slate-800">{entry.canViewSalary ? money.format(entry.salary) : "••••••"}</td><td className="px-6 py-4 font-mono text-[11px] text-slate-500">{entry.stamp || "—"}</td></tr>)}</tbody></table>{history.length === 0 && <p className="px-6 py-10 text-center text-sm text-slate-500">No job history recorded.</p>}</div></section>
    </>}
  </div></main></DashboardLayout>
}
