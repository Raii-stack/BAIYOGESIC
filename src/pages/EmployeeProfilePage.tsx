import { useState } from "react"
import { Link, useParams } from "react-router"

import AddJobHistoryModal from "../components/employees/AddJobHistoryModal"
import DashboardLayout from "../layouts/DashboardLayout"
import { employeeJobHistory, employees } from "../lib/employees"
import type { JobHistoryEntry } from "../types/employee"

const salaryFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function AddIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export default function EmployeeProfilePage() {
  const { employeeId } = useParams()
  const employee =
    employees.find((record) => record.id === employeeId) ?? employees[0]
  const [history, setHistory] = useState<JobHistoryEntry[]>(
    employeeJobHistory[employee.id] ?? [
      {
        id: `JOB-${employee.id}-01`,
        effectiveDate: employee.hireDate,
        jobTitle: employee.jobTitle,
        department: employee.department,
        salary: employee.salary,
        stamp: "CREATED system 2026-10-01 9:00 AM",
      },
    ],
  )
  const [modalOpen, setModalOpen] = useState(false)
  const separated = Boolean(employee.separationDate)
  const showAdminAudit = true

  const addHistory = (entry: JobHistoryEntry) => {
    setHistory((current) =>
      [...current, entry].sort((a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate),
      ),
    )
  }

  return (
    <DashboardLayout
      activeNavigation="Human Resources"
      searchPlaceholder="Search workspace"
    >
      <>
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Link
                to="/employees"
                className="transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                Employee Directory
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-slate-800">Employee Profile</span>
            </div>

            <section
              aria-labelledby="employee-profile-title"
              className="border border-slate-300 border-t-[3px] border-t-blue-800 bg-white"
            >
              <div className="flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-center sm:px-8">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#0d2743] text-xl font-bold tracking-[-0.03em] text-white">
                  ER
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                      {employee.id}
                    </p>
                    <span
                      className={`inline-flex border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                        separated
                          ? "border-slate-300 bg-slate-100 text-slate-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {separated ? "Separated" : "Active"}
                    </span>
                  </div>
                  <h1
                    id="employee-profile-title"
                    className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950"
                  >
                    {employee.fullName}
                  </h1>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {employee.jobTitle}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {employee.department}
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-2 border-t border-slate-200 pt-5 text-sm sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Hire date
                    </dt>
                    <dd className="mt-1 font-mono text-xs font-semibold text-slate-800">
                      {employee.hireDate}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Department
                    </dt>
                    <dd className="mt-1 text-xs font-semibold text-slate-800">
                      {employee.department}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section
              aria-labelledby="job-history-title"
              className="mt-5 border border-slate-300 bg-white"
            >
              <div className="flex flex-col gap-4 border-b border-slate-300 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                    Employment record
                  </p>
                  <h2
                    id="job-history-title"
                    className="mt-1 text-xl font-bold tracking-[-0.025em] text-slate-950"
                  >
                    Job History
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                >
                  <AddIcon />
                  Add Job History
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100">
                      {[
                        "Effective Date",
                        "Job Title",
                        "Department",
                        "Salary",
                        ...(showAdminAudit ? ["Stamp"] : []),
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 ${
                            heading === "Salary" ? "text-right" : ""
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, index) => (
                      <tr
                        key={entry.id}
                        className={`border-b border-slate-200 last:border-b-0 ${
                          index === 0 ? "bg-blue-50/50" : "bg-white"
                        }`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-2 w-2 shrink-0 ${
                                index === 0 ? "bg-blue-700" : "bg-slate-300"
                              }`}
                            />
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {entry.effectiveDate}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm font-bold text-slate-900">
                          {entry.jobTitle}
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-600">
                          {entry.department}
                        </td>
                        <td className="px-6 py-5 text-right text-sm font-bold tabular-nums text-slate-950">
                          {salaryFormatter.format(entry.salary)}
                        </td>
                        {showAdminAudit && (
                          <td className="max-w-52 px-6 py-5 font-mono text-[10px] leading-5 text-slate-500">
                            {entry.stamp}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>

        <AddJobHistoryModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={addHistory}
        />
      </>
    </DashboardLayout>
  )
}
