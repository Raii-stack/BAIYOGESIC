import type { ReactNode } from "react"
import { Link } from "react-router"

import type { Employee } from "../../types/employee"

const salaryFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="8" width="12" height="9" rx="2" />
      <path d="M7 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

function EditIcon() {
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
      <path d="m14 5 5 5M4 20l3.5-.7L20 6.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
}

function ActionButton({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
    >
      {children}
    </button>
  )
}

export default function EmployeeTable({
  employees,
}: {
  employees: Employee[]
}) {
  return (
    <div className="overflow-hidden border border-slate-300 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1260px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {[
                "Employee ID",
                "Full Name",
                "Department",
                "Job Title",
                "Hire Date",
                "Separation Date",
                "Salary",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`px-4 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 first:pl-6 last:pr-6 ${
                    heading === "Salary" ? "text-right" : ""
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <tr
                key={employee.id}
                className={`border-b border-slate-200 last:border-b-0 ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}
              >
                <td className="whitespace-nowrap px-4 py-4 pl-6 font-mono text-xs font-semibold text-blue-800">
                  {employee.id}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-bold text-slate-900">
                  <Link
                    to={`/employees/${employee.id}`}
                    className="underline-offset-4 transition hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                  >
                    {employee.fullName}
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">
                  {employee.department}
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">
                  {employee.jobTitle}
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-600">
                  {employee.hireDate}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  {employee.separationDate ? (
                    <span className="inline-flex border border-red-200 bg-red-50 px-2 py-1 font-mono text-xs font-bold text-red-700">
                      {employee.separationDate}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right">
                  {employee.canViewSalary ? (
                    <span className="text-sm font-bold tabular-nums text-slate-950">
                      {salaryFormatter.format(employee.salary)}
                    </span>
                  ) : (
                    <span
                      aria-label="Salary hidden due to permissions"
                      className="inline-flex items-center justify-end gap-1.5 text-sm font-bold tracking-[0.08em] text-slate-500"
                    >
                      ••••••••
                      <span className="text-slate-400">
                        <LockIcon />
                      </span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 pr-6">
                  <div className="flex items-center gap-1">
                    <ActionButton label={`Edit ${employee.fullName}`}>
                      <EditIcon />
                    </ActionButton>
                    <ActionButton
                      label={`More actions for ${employee.fullName}`}
                    >
                      <MoreIcon />
                    </ActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {employees.length === 0 && (
        <div className="border-t border-slate-200 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No employees match these filters.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust the employee name, department, or job title.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-300 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-slate-600">
          Showing {employees.length} employee records
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <LockIcon />
          Salary visibility follows role permissions.
        </p>
      </div>
    </div>
  )
}
