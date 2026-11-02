import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import ReportTable, { type ReportName } from "../components/reports/ReportTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { safeErrorMessage } from "../lib/api-errors"
import { getAllowedReports } from "../lib/rbac"
import { reportsApi, type ReportEmployee, type ReportRow } from "../lib/reports-api"

const reports: ReportName[] = [
  "Top Customers", "Product Master List", "Top Products", "Active Employees",
  "All Employees", "Employee Job History", "Top Sales",
]
const topReports = new Set<ReportName>(["Top Customers", "Top Products", "Top Sales"])

export default function ReportsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const allowedReports = useMemo(() => getAllowedReports(user, reports), [user])
  const reportQuery = searchParams.get("search")?.trim().toLowerCase() || ""
  const activeReport = allowedReports.find((report) => report === searchParams.get("report"))
    || allowedReports.find((report) => reportQuery && report.toLowerCase().includes(reportQuery))
    || allowedReports[0]
  const [topN, setTopN] = useState(10)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [employee, setEmployee] = useState("")
  const [employees, setEmployees] = useState<ReportEmployee[]>([])
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const isTopReport = Boolean(activeReport && topReports.has(activeReport))

  useEffect(() => {
    if (!activeReport) return
    const controller = new AbortController()
    setLoading(true)
    setError("")

    reportsApi.get(activeReport, {
      startDate: isTopReport ? startDate : undefined,
      endDate: isTopReport ? endDate : undefined,
      limit: isTopReport ? topN : undefined,
      empno: activeReport === "Employee Job History" ? employee : undefined,
    }, controller.signal).then((result) => {
      setRows(result.rows)
      if (activeReport === "Employee Job History") {
        const options = result.employees || []
        setEmployees(options)
        if (!employee && options.length > 0) setEmployee(options[0].empno)
      } else {
        setEmployees([])
      }
    }).catch((requestError: unknown) => {
      if (!controller.signal.aborted) {
        setRows([])
        setError(safeErrorMessage(requestError))
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    return () => controller.abort()
  }, [activeReport, employee, endDate, isTopReport, retry, startDate, topN])

  const selectReport = (report: string) => {
    setRows([])
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("view", "reports")
      next.set("report", report)
      next.delete("search")
      return next
    })
  }

  return (
    <DashboardLayout activeNavigation="Reports" searchPlaceholder="Search workspace">
      <main className="workspace-page workspace-report-page">
        <div className="mx-auto max-w-7xl">
          <header className="workspace-page-header">
            <div>
              <h1 className="workspace-page-title">Reports</h1>
              <p className="workspace-page-description">Review customer, product, employee, and sales reports.</p>
            </div>
            {activeReport ? <button type="button" onClick={() => window.print()} className="workspace-secondary-action workspace-report-controls">Print / save PDF</button> : null}
          </header>
          {!activeReport ? (
            <div className="workspace-panel workspace-empty-state">
              <p>No reports are enabled for your account.</p>
              <p>Contact an administrator to request report permissions.</p>
            </div>
          ) : (
            <>
              <div className="workspace-report-print-header">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xl font-bold uppercase tracking-wider text-slate-950 block">HOPE, Inc. ERP</span>
                    <span className="text-sm font-semibold text-slate-800 block">{activeReport}</span>
                  </div>
                  <div className="text-right text-xs text-slate-600">
                    <p>Generated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}</p>
                    {isTopReport && startDate && endDate ? (
                      <p>Period: {startDate} to {endDate}</p>
                    ) : null}
                    {activeReport === "Employee Job History" && employee ? (
                      <p>Employee No: {employee}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div role="tablist" aria-label="Report selection" className="workspace-tabs workspace-report-controls"
                onKeyDown={(event) => {
                  const index = allowedReports.indexOf(activeReport)
                  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? allowedReports.length - 1
                    : event.key === "ArrowRight" ? (index + 1) % allowedReports.length
                    : event.key === "ArrowLeft" ? (index - 1 + allowedReports.length) % allowedReports.length : -1
                  if (nextIndex < 0) return
                  event.preventDefault()
                  selectReport(allowedReports[nextIndex])
                  event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
                }}>
                {allowedReports.map((report, index) => (
                  <button key={report} type="button" role="tab" id={`report-tab-${index}`}
                    aria-selected={activeReport === report} aria-controls="active-report-panel"
                    tabIndex={activeReport === report ? 0 : -1} onClick={() => selectReport(report)}>
                    {report}
                  </button>
                ))}
              </div>
              <div role="tabpanel" id="active-report-panel" aria-labelledby={`report-tab-${allowedReports.indexOf(activeReport)}`}>
                {isTopReport ? (
                  <section aria-label="Report filters" className="workspace-panel workspace-filters workspace-report-controls">
                    <label><span className="workspace-label">From</span><input aria-label="From" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="workspace-control" /></label>
                    <label><span className="workspace-label">To</span><input aria-label="To" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="workspace-control" /></label>
                    <label><span className="workspace-label">Number of results</span><input aria-label="Number of results" type="number" min="1" max="100" step="1" value={topN} onChange={(event) => setTopN(Math.min(100, Math.max(1, Math.trunc(Number(event.target.value)) || 1)))} className="workspace-control" /></label>
                  </section>
                ) : null}
                {activeReport === "Employee Job History" ? (
                  <section aria-label="Report filters" className="workspace-panel workspace-filters workspace-report-controls">
                    <label>
                      <span className="workspace-label">Employee</span>
                      <select aria-label="Employee" value={employee} onChange={(event) => setEmployee(event.target.value)} className="workspace-control" disabled={loading && employees.length === 0}>
                        {employees.length === 0 ? <option value="">No active employees</option> : null}
                        {employees.map((option) => <option key={option.empno} value={option.empno}>{option.empno} — {option.fullname}</option>)}
                      </select>
                    </label>
                  </section>
                ) : null}
                <ReportTable report={activeReport} rows={rows} loading={loading} error={error} onRetry={() => setRetry((current) => current + 1)} />
              </div>
            </>
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}
