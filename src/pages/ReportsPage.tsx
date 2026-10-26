import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import ReportTable, { type ReportName } from "../components/reports/ReportTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { getAllowedReports } from "../lib/rbac"

const reports: ReportName[] = [
  "Top Customers", "Product Master List", "Top Products", "Active Employees",
  "All Employees", "Employee Job History", "Top Sales",
]
const topReports: ReportName[] = ["Top Customers", "Top Products", "Top Sales"]

export default function ReportsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const allowedReports = useMemo(() => getAllowedReports(user, reports), [user])
  const reportQuery = searchParams.get("search")?.trim().toLowerCase() || ""
  const activeReport = allowedReports.find((report) => report === searchParams.get("report"))
    || allowedReports.find((report) => reportQuery && report.toLowerCase().includes(reportQuery))
    || allowedReports[0]
  const [topN, setTopN] = useState(10)
  const isTopReport = activeReport && topReports.includes(activeReport)

  const selectReport = (report: string) => {
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
            {activeReport && <button type="button" onClick={() => window.print()} className="workspace-secondary-action workspace-report-controls">Print / save PDF</button>}
          </header>
          {!activeReport ? (
            <div className="workspace-panel workspace-empty-state">
              <p>No reports are enabled for your account.</p>
              <p>Contact an administrator to request report permissions.</p>
            </div>
          ) : (
            <>
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
                {isTopReport && (
                  <label className="mb-4 flex items-center gap-3 text-[13px] text-neutral-600 workspace-report-controls">
                    <span>Number of results</span>
                    <span className="block w-20">
                    <input type="number" min="1" max="100" step="1" value={topN}
                      onChange={(event) => setTopN(Math.min(100, Math.max(1, Math.trunc(Number(event.target.value)) || 1)))}
                      className="workspace-control" />
                    </span>
                  </label>
                )}
              <div className="workspace-notice mb-4 workspace-report-notice">
                <p>Sample report data. Live reporting is not connected yet. To save a PDF, choose “Save as PDF” in the print dialog.</p>
              </div>
              <ReportTable report={activeReport} limit={isTopReport ? topN : undefined} />
              </div>
            </>
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}
