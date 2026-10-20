import { Link } from "react-router"
import type { EmployeePagination } from "../../lib/employee-api"
import type { Employee } from "../../types/employee"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const pages = (current: number, total: number) => { const count = Math.min(total, 5); const start = Math.max(1, Math.min(current - 2, total - count + 1)); return Array.from({ length: count }, (_, i) => start + i) }

export default function EmployeeTable({ employees, pagination, loading, error, onPageChange, onEdit, canEdit }: {
  employees: Employee[]; pagination: EmployeePagination; loading: boolean; error: boolean
  onPageChange: (page: number) => void; onEdit: (employee: Employee) => void; canEdit: boolean
}) {
  const start = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0
  const end = pagination.total ? Math.min(start + employees.length - 1, pagination.total) : 0
  return <section aria-label="Employee records" className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,39,67,0.05)]">
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4"><div><h2 className="text-sm font-bold text-slate-900">Personnel register</h2><p className="mt-0.5 text-xs text-slate-500">Current assignment and employment status</p></div><span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">{loading ? "Loading…" : error ? "Unavailable" : `${pagination.total} records`}</span></div>
    <div className="overflow-x-auto" aria-busy={loading}><table className="w-full min-w-[1080px] border-collapse text-left"><thead><tr className="border-b border-slate-200 bg-slate-50">{["Employee", "ID", "Department", "Job title", "Hire date", "Status", "Salary", ...(canEdit ? ["Actions"] : [])].map((heading) => <th key={heading} scope="col" className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pl-6 last:pr-6">{heading}</th>)}</tr></thead><tbody>
      {loading ? Array.from({ length: 8 }, (_, index) => <tr key={index} aria-hidden="true" className="border-b border-slate-100">{Array.from({ length: canEdit ? 8 : 7 }, (_, column) => <td key={column} className="px-5 py-5"><div className="h-3.5 max-w-full animate-pulse rounded bg-slate-200" style={{ width: column === 0 ? 160 : column === 2 ? 120 : 80 }} /></td>)}</tr>) : employees.map((employee) => {
        const status = employee.archived ? "Archived" : employee.separationDate ? "Separated" : "Active"
        return <tr key={employee.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-blue-50/40">
          <td className="px-5 py-4 pl-6"><Link to={`/employees/${encodeURIComponent(employee.id)}`} className="font-semibold text-slate-950 underline-offset-4 hover:text-blue-800 hover:underline">{employee.fullName}</Link><p className="mt-0.5 text-xs text-slate-500">{employee.email || "—"}</p></td>
          <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-semibold text-blue-800">{employee.id}</td>
          <td className="px-5 py-4 text-sm text-slate-700">{employee.department}</td>
          <td className="px-5 py-4 text-sm text-slate-700">{employee.jobTitle}</td>
          <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-600">{employee.hireDate || "—"}</td>
          <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === "Active" ? "bg-emerald-100 text-emerald-800" : status === "Separated" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"}`}>{status}</span></td>
          <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold tabular-nums text-slate-800">{employee.canViewSalary ? money.format(employee.salary) : <span aria-label="Salary hidden due to permissions" className="text-slate-400">••••••</span>}</td>
          {canEdit && <td className="px-5 py-4 pr-6">{employee.archived ? <span className="text-slate-400">—</span> : <button type="button" onClick={() => onEdit(employee)} aria-label={`Edit ${employee.fullName}`} className="rounded-md px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-700">Edit</button>}</td>}
        </tr>
      })}
    </tbody></table>{!loading && !error && employees.length === 0 && <div className="border-t border-slate-100 px-6 py-14 text-center"><p className="text-sm font-semibold text-slate-800">No employees found</p><p className="mt-1 text-xs text-slate-500">Try a different search or filter.</p></div>}</div>
    <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p aria-live="polite" className="text-xs font-medium text-slate-600">{loading ? "Loading employee records…" : error ? "Employee records unavailable" : `Showing ${start}–${end} of ${pagination.total}`}</p><nav aria-label="Employee table pagination" className="flex items-center gap-1"><button type="button" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:text-slate-400">Previous</button>{pages(pagination.page, pagination.totalPages).map((page) => <button key={page} type="button" onClick={() => onPageChange(page)} disabled={loading} aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined} className={`h-9 min-w-9 rounded-md border text-xs font-bold ${page === pagination.page ? "border-blue-800 bg-blue-800 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>{page}</button>)}<button type="button" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:text-slate-400">Next</button></nav></div>
  </section>
}
