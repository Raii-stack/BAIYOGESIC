import { useEffect, useState } from "react"

import { useAuth } from "../components/auth/AuthProvider"
import SuccessToast from "../components/common/SuccessToast"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import EmployeePanel from "../components/employees/EmployeePanel"
import EmployeeTable from "../components/employees/EmployeeTable"
import useDebouncedValue from "../hooks/useDebouncedValue"
import DashboardLayout from "../layouts/DashboardLayout"
import { employeeApi, type EmployeeInput, type EmployeePagination, type Lookup } from "../lib/employee-api"
import type { Employee } from "../types/employee"

const PAGE_SIZE = 10
const emptyPagination: EmployeePagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

export default function EmployeeDirectoryPage() {
  const { user } = useAuth()
  const canEdit = user?.role === "administrator" || user?.role === "admin"
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [department, setDepartment] = useState("")
  const [job, setJob] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pagination, setPagination] = useState<EmployeePagination>(emptyPagination)
  const [departments, setDepartments] = useState<Lookup[]>([])
  const [jobs, setJobs] = useState<Lookup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)

  useEffect(() => {
    document.title = "Employees | HOPE, Inc."
    return () => { document.title = "Sign in | HOPE, Inc." }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    employeeApi.options(controller.signal).then((options) => {
      if (!controller.signal.aborted) { setDepartments(options.departments); setJobs(options.jobs) }
    }).catch(() => { /* Directory data error is handled below; filters remain optional. */ })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    if (searchPending) { setLoading(true); setError(""); return }
    const controller = new AbortController()
    setLoading(true)
    setError("")
    employeeApi.list({ page, limit: PAGE_SIZE, search: debouncedQuery, department, job, status }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) { setPage(result.pagination.totalPages); return }
        setEmployees(result.employees)
        setPagination(result.pagination)
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Unable to load employees.")
          setEmployees([])
          setPagination(emptyPagination)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, debouncedQuery, searchPending, department, job, status, refresh])

  const save = async (input: EmployeeInput) => {
    if (selected) await employeeApi.update(selected.id, input)
    else await employeeApi.create(input)
    setNotice((current) => ({ id: (current?.id ?? 0) + 1, message: selected ? "Employee updated successfully." : "Employee added successfully." }))
    if (!selected) { setPage(1); setStatus("all") }
    setRefresh((current) => current + 1)
  }

  return (
    <DashboardLayout activeNavigation="Human Resources" searchPlaceholder="Search workspace">
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">Human Resources / Personnel register</p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">Employee Directory</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Find personnel records, current roles, and employment status.</p>
            </div>
            <div className="flex items-center gap-3 self-start border-l-2 border-blue-800 pl-4 sm:self-auto">
              <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-950">{loading || error ? "—" : pagination.total}</span>
              <span className="max-w-20 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-slate-500">Matching records</span>
            </div>
          </header>

          <section aria-label="Employee filters" className="mb-5 grid gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-[0_8px_28px_rgba(15,39,67,0.04)] md:grid-cols-2 lg:grid-cols-[minmax(200px,1fr)_160px_160px_145px_auto] lg:items-end">
            <label><span className="mb-2 block text-xs font-bold text-slate-700">Search employees</span><span className="relative block"><DashboardIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Name, ID, or email" className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-700 focus:bg-white focus:ring-3 focus:ring-blue-100" /></span></label>
            <FilterSelect label="Department" value={department} onChange={(value) => { setDepartment(value); setPage(1) }} options={departments} allLabel="All departments" />
            <FilterSelect label="Job title" value={job} onChange={(value) => { setJob(value); setPage(1) }} options={jobs} allLabel="All job titles" />
            <label><span className="mb-2 block text-xs font-bold text-slate-700">Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-700"><option value="all">All statuses</option><option value="active">Active</option><option value="separated">Separated</option><option value="archived">Archived</option></select></label>
            {canEdit && <button type="button" onClick={() => { setSelected(null); setPanelOpen(true) }} className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:ring-4 focus-visible:ring-blue-200">+ Add employee</button>}
          </section>

          {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{error}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4">Try again</button></div>}
          <EmployeeTable employees={employees} pagination={pagination} loading={loading} error={Boolean(error)} onPageChange={setPage} onEdit={(employee) => { setSelected(employee); setPanelOpen(true) }} canEdit={Boolean(canEdit)} />
        </div>
      </main>
      {canEdit && <EmployeePanel employee={selected} open={panelOpen} departments={departments} jobs={jobs} onClose={() => setPanelOpen(false)} onSave={save} />}
      {notice && <SuccessToast key={notice.id} message={notice.message} onClose={() => setNotice((current) => current?.id === notice.id ? null : current)} />}
    </DashboardLayout>
  )
}

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: Lookup[]; allLabel: string }) {
  return <label><span className="mb-2 block text-xs font-bold text-slate-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 focus:border-blue-700"><option value="">{allLabel}</option>{options.map((option) => <option key={option.code} value={option.code}>{option.name || option.code}</option>)}</select></label>
}
