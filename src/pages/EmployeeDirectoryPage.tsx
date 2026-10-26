import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import SuccessToast from "../components/common/SuccessToast"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import ArchiveEmployeeModal from "../components/employees/ArchiveEmployeeModal"
import EmployeePanel from "../components/employees/EmployeePanel"
import EmployeeTable from "../components/employees/EmployeeTable"
import LookupSection from "../components/employees/LookupSection"
import useDebouncedValue from "../hooks/useDebouncedValue"
import usePageQuery from "../hooks/usePageQuery"
import DashboardLayout from "../layouts/DashboardLayout"
import { employeeApi, type EmployeeInput, type EmployeePagination, type Lookup } from "../lib/employee-api"
import { getHrPermissions } from "../lib/rbac"
import type { Employee } from "../types/employee"

const PAGE_SIZE = 10
const emptyPagination: EmployeePagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

export default function EmployeeDirectoryPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    canAddEmployee,
    canEditEmployee,
    canDeleteEmployee,
    canViewHistory,
    canAddJob,
    canEditJob,
    canDeleteJob,
    canAddDepartment,
    canEditDepartment,
    canDeleteDepartment,
    canViewAudit,
  } = getHrPermissions(user)
  const canOpenEmployeePanel = canAddEmployee || canEditEmployee
  const activeTab = searchParams.get("view") === "jobs" ? "jobs" : searchParams.get("view") === "departments" ? "departments" : "employees"
  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [department, setDepartment] = useState("")
  const [job, setJob] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = usePageQuery()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pagination, setPagination] = useState<EmployeePagination>(emptyPagination)
  const [departments, setDepartments] = useState<Lookup[]>([])
  const [jobs, setJobs] = useState<Lookup[]>([])
  const [optionsError, setOptionsError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selected, setSelected] = useState<Employee | null>(null)
  const [employeeToArchive, setEmployeeToArchive] = useState<Employee | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)

  useEffect(() => {
    document.title = "Employees | HOPE, Inc."
    return () => { document.title = "Sign in | HOPE, Inc." }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    employeeApi.options(controller.signal).then((options) => {
      if (!controller.signal.aborted) { setDepartments(options.departments); setJobs(options.jobs); setOptionsError(false) }
    }).catch(() => { if (!controller.signal.aborted) setOptionsError(true) })
    return () => controller.abort()
  }, [refresh])

  useEffect(() => {
    if (activeTab !== "employees") return
    if (searchPending) { setLoading(true); setError(""); return }
    const controller = new AbortController()
    setLoading(true)
    setError("")
    employeeApi.list({ page, limit: PAGE_SIZE, search: debouncedQuery, department, job, status }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (page > Math.max(1, result.pagination.totalPages)) { setPage(Math.max(1, result.pagination.totalPages)); return }
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
  }, [activeTab, page, debouncedQuery, searchPending, department, job, status, refresh])

  const showNotice = (message: string) => setNotice((current) => ({ id: (current?.id ?? 0) + 1, message }))

  const save = async (input: EmployeeInput) => {
    if (selected) await employeeApi.update(selected.id, input)
    else await employeeApi.create(input)
    showNotice(selected ? "Employee updated successfully." : "Employee added successfully.")
    if (!selected) { setPage(1); setStatus("all") }
    setRefresh((current) => current + 1)
  }

  const archiveEmployee = async (separationDate?: string) => {
    if (!employeeToArchive) return
    setArchiving(true)
    setArchiveError("")
    try {
      await employeeApi.archive(employeeToArchive.id, separationDate)
      setEmployeeToArchive(null)
      showNotice("Employee archived successfully.")
      if ((status === "active" || status === "separated") && employees.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch (cause) {
      setArchiveError(cause instanceof Error ? cause.message : "Unable to archive employee.")
    } finally {
      setArchiving(false)
    }
  }

  const restoreEmployee = async (employee: Employee) => {
    setRestoringId(employee.id)
    try {
      await employeeApi.restore(employee.id)
      showNotice("Employee restored successfully.")
      if (status === "archived" && employees.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <DashboardLayout activeNavigation="Employees" searchPlaceholder="Search workspace">
      <main className="workspace-page">
        <div className="mx-auto max-w-7xl">
          <header className="workspace-page-header">
            <div>
              <h1 className="workspace-page-title">Employees</h1>
              <p className="workspace-page-description">Manage your team, departments, and job assignments.</p>
            </div>
          </header>

          <div role="tablist" aria-label="Human Resources sections" className="workspace-tabs">
            {([
              { id: "employees", label: "Employees" },
              { id: "jobs", label: "Jobs" },
              { id: "departments", label: "Departments" },
            ] as const).map((tab) => {
              const selectedTab = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab}
                  onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("view", tab.id); next.set("page", "1"); return next })}
                  className="workspace-tab"
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {activeTab === "employees" ? (
            <>
              <section aria-label="Employee filters" className="workspace-panel workspace-filters">
                <label className="workspace-filter-search"><span className="workspace-label">Search employees</span><span className="relative block"><DashboardIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Name, ID, or email" className="workspace-control workspace-control--search" /></span></label>
                <FilterSelect label="Department" value={department} onChange={(value) => { setDepartment(value); setPage(1) }} options={departments} allLabel="All departments" />
                <FilterSelect label="Job title" value={job} onChange={(value) => { setJob(value); setPage(1) }} options={jobs} allLabel="All job titles" />
                {canViewAudit && <label><span className="workspace-label">Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="workspace-control"><option value="all">All statuses</option><option value="active">Active</option><option value="separated">Separated</option><option value="archived">Archived</option></select></label>}
                {canAddEmployee && <button type="button" onClick={() => { setSelected(null); setPanelOpen(true) }} className="workspace-primary-action">+ Add employee</button>}
              </section>

              {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{error}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4">Try again</button></div>}
              {optionsError && !error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><span>Department and job options are unavailable. Please retry before saving an employee.</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4">Try again</button></div>}
              <EmployeeTable key={`${page}-${department}-${job}-${status}-${refresh}`} employees={employees} pagination={pagination} loading={loading} error={Boolean(error)} onPageChange={setPage} onEdit={(employee) => { setSelected(employee); setPanelOpen(true) }} onArchive={(employee) => { setArchiveError(""); setEmployeeToArchive(employee) }} onRestore={restoreEmployee} restoringId={restoringId} canEdit={canEditEmployee} canDelete={canDeleteEmployee} canViewHistory={canViewHistory} canViewAudit={canViewAudit} />
            </>
          ) : (
            <LookupSection
              key={activeTab}
              kind={activeTab}
              canAdd={activeTab === "jobs" ? canAddJob : canAddDepartment}
              canEdit={activeTab === "jobs" ? canEditJob : canEditDepartment}
              canDelete={activeTab === "jobs" ? canDeleteJob : canDeleteDepartment}
              canViewAudit={canViewAudit}
              onChanged={() => setRefresh((current) => current + 1)}
              onNotice={showNotice}
            />
          )}
        </div>
      </main>
      {canOpenEmployeePanel && <EmployeePanel employee={selected} open={panelOpen} departments={departments} jobs={jobs} onClose={() => setPanelOpen(false)} onSave={save} />}
      {canDeleteEmployee && <ArchiveEmployeeModal employeeName={employeeToArchive?.fullName ?? ""} open={Boolean(employeeToArchive)} onCancel={() => setEmployeeToArchive(null)} onConfirm={archiveEmployee} loading={archiving} error={archiveError} />}
      {notice && <SuccessToast key={notice.id} message={notice.message} onClose={() => setNotice((current) => current?.id === notice.id ? null : current)} />}
    </DashboardLayout>
  )
}

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: Lookup[]; allLabel: string }) {
  return <label><span className="workspace-label">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="workspace-control"><option value="">{allLabel}</option>{options.map((option) => <option key={option.code} value={option.code}>{option.name || option.code}</option>)}</select></label>
}
