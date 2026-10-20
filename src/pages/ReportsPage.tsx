import { useMemo, useState } from "react"

import { useAuth } from "../components/auth/AuthProvider"
import ReportTable, { type ReportName } from "../components/reports/ReportTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { getAllowedReports } from "../lib/rbac"

const reports: ReportName[] = [
  "Top Customers",
  "Product Master List",
  "Top Products",
  "Active Employees",
  "All Employees",
  "Employee Job History",
  "Top Sales",
]

const topReports: ReportName[] = ["Top Customers", "Top Products", "Top Sales"]

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function PrinterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6z" />
    </svg>
  )
}

function PdfIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3h10l4 4v14H5V3Z" />
      <path d="M15 3v5h5M8 16h8M8 12h5" />
    </svg>
  )
}

export default function ReportsPage() {
  const { user } = useAuth()
  const allowedReports = useMemo(
    () => getAllowedReports(user, reports),
    [user],
  )
  const [selectedReport, setSelectedReport] = useState<ReportName>("Top Customers")
  const activeReport = allowedReports.includes(selectedReport)
    ? selectedReport
    : (allowedReports[0] ?? "Top Customers")
  const [fromDate, setFromDate] = useState("2026-10-01")
  const [toDate, setToDate] = useState("2026-10-31")
  const [topN, setTopN] = useState(10)
  const [employee, setEmployee] = useState("")

  const isTopReport = topReports.includes(activeReport)
  const isEmployeeHistory = activeReport === "Employee Job History"

  return (
    <DashboardLayout
      activeNavigation="Reports"
      searchPlaceholder="Search workspace"
    >
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-7 border-b border-slate-300 pb-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
              Reports / Read-only analytics
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              Reports
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Filter, review, print, and export operational ERP reports.
            </p>
          </div>

          {allowedReports.length === 0 ? (
            <div className="rounded-lg border border-slate-300 bg-white px-6 py-14 text-center">
              <p className="text-sm font-semibold text-slate-800">
                No individual reports are enabled for your account.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Contact an administrator to request report permissions.
              </p>
            </div>
          ) : (
            <>
              <nav
                aria-label="Report selection"
                className="overflow-x-auto border border-slate-300 bg-white"
              >
                <div
                  className="grid min-w-[640px]"
                  style={{
                    gridTemplateColumns: `repeat(${allowedReports.length}, minmax(150px, 1fr))`,
                  }}
                  role="tablist"
                >
                  {allowedReports.map((report, index) => (
                    <button
                      key={report}
                      type="button"
                      role="tab"
                      aria-selected={activeReport === report}
                      onClick={() => setSelectedReport(report)}
                      className={`relative flex h-[74px] flex-col items-start justify-center border-r border-slate-200 px-4 text-left transition last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 ${
                        activeReport === report
                          ? "bg-[#0d2743] text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <span
                        className={`font-mono text-[9px] font-bold tracking-[0.14em] ${
                          activeReport === report
                            ? "text-blue-200"
                            : "text-slate-400"
                        }`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="mt-1 text-xs font-bold leading-4">
                        {report}
                      </span>
                      {activeReport === report && (
                        <span className="absolute inset-x-4 bottom-0 h-0.5 bg-blue-300" />
                      )}
                    </button>
                  ))}
                </div>
              </nav>

              <section
                aria-label={`${activeReport} filters and exports`}
                className="mb-5 border-x border-b border-slate-300 bg-white p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
                  {isTopReport && (
                    <div className="grid flex-1 gap-3 sm:grid-cols-[200px_200px_110px]">
                      <DateFilter
                        label="From"
                        value={fromDate}
                        onChange={setFromDate}
                      />
                      <DateFilter label="To" value={toDate} onChange={setToDate} />
                      <label>
                        <span className="mb-2 block text-xs font-bold text-slate-700">
                          Top N
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={topN}
                          onChange={(event) => setTopN(Number(event.target.value))}
                          className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm tabular-nums text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                        />
                      </label>
                    </div>
                  )}

                  {isEmployeeHistory && (
                    <label className="block flex-1 xl:max-w-xl">
                      <span className="mb-2 block text-xs font-bold text-slate-700">
                        Choose an employee
                      </span>
                      <input
                        type="search"
                        list="report-employees"
                        value={employee}
                        onChange={(event) => setEmployee(event.target.value)}
                        placeholder="Search employee ID or name"
                        className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                      />
                      <datalist id="report-employees">
                        <option value="E-001 — Maria Santos" />
                        <option value="E-002 — Juan Reyes" />
                        <option value="E-003 — Employee Record 03" />
                      </datalist>
                    </label>
                  )}

                  {!isTopReport && !isEmployeeHistory && (
                    <p className="flex-1 text-xs font-medium text-slate-500">
                      This report uses the complete current dataset.
                    </p>
                  )}

                  <div className="flex shrink-0 items-center gap-3 xl:ml-auto">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                    >
                      <PrinterIcon />
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex h-11 items-center gap-2 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                    >
                      <PdfIcon />
                      Save as PDF
                    </button>
                  </div>
                </div>
              </section>

              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-800">
                    Current report
                  </p>
                  <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-slate-950">
                    {activeReport}
                  </h2>
                </div>
                <p className="text-xs font-medium text-slate-500">Read-only</p>
              </div>

              <ReportTable
                report={activeReport}
                limit={isTopReport ? topN : undefined}
              />
            </>
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold text-slate-700">
        {label}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <CalendarIcon />
        </span>
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
        />
      </span>
    </label>
  )
}
