import { useEffect, useRef, useState, type KeyboardEvent } from "react"
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
const hrTabs = [
  { id: "employees", label: "Employees" },
  { id: "jobs", label: "Jobs" },
  { id: "departments", label: "Departments" },
] as const
type HrTab = typeof hrTabs[number]["id"]

export default function EmployeeDirectoryPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    canAddEmployee,
    canEditEmployee,
    canDeleteEmployee,
    canViewHistory,
    canViewSalary,
    canAddJob,
    canEditJob,
    canDeleteJob,
    canAddDepartment,
    canEditDepartment,
    canDeleteDepartment,
    canViewAudit,
  } = getHrPermissions(user)
  const canOpenEmployeePanel = canAddEmployee || canEditEmployee
  const activeTab: HrTab = searchParams.get("view") === "jobs" ? "jobs" : searchParams.get("view") === "departments" ? "departments" : "employees"
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
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

  const selectTab = (tab: HrTab) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("view", tab)
      next.set("page", "1")
      return next
    })
  }

  const navigateTabs = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === "ArrowRight") nextIndex = (index + 1) % hrTabs.length
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + hrTabs.length) % hrTabs.length
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = hrTabs.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    selectTab(hrTabs[nextIndex].id)
    tabRefs.current[nextIndex]?.focus()
  }

  const save = async (input: EmployeeInput) => {
    if (selected) {
      await employeeApi.update(selected.id, input)
      const deptName = departments.find((d) => d.code === input.deptcode)?.name || selected.department
      const jobDesc = jobs.find((j) => j.code === input.jobcode)?.name || selected.jobTitle
      setEmployees((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                firstName: input.firstname,
                lastName: input.lastname,
                fullName: [input.firstname, input.lastname].filter(Boolean).join(" ") || item.id,
                email: input.email,
                gender: input.gender || null,
                birthDate: input.birthdate,
                hireDate: input.hiredate,
                separationDate: input.sepdate || null,
                departmentCode: input.deptcode,
                department: deptName,
                jobCode: input.jobcode,
                jobTitle: jobDesc,
                salary: input.salary,
                effectiveDate: input.effdate,
              }
            : item
        )
      )
      showNotice("Employee updated successfully.")
    } else {
      await employeeApi.create(input)
      showNotice("Employee added successfully.")
      setPage(1)
      setStatus("all")
      setRefresh((current) => current + 1)
    }
  }

  const archiveEmployee = async (separationDate?: string) => {
    if (!employeeToArchive) return
    setArchiving(true)
    setArchiveError("")
    try {
      await employeeApi.archive(employeeToArchive.id, separationDate)
      setEmployees((prev) =>
        status === "active" || status === "separated"
          ? prev.filter((item) => item.id !== employeeToArchive.id)
          : prev.map((item) =>
              item.id === employeeToArchive.id
                ? { ...item, archived: true, separationDate: separationDate || item.separationDate }
                : item
            )
      )
      setEmployeeToArchive(null)
      showNotice("Employee archived successfully.")
      if ((status === "active" || status === "separated") && employees.length === 1 && page > 1) {
        setPage(page - 1)
      }
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
      setEmployees((prev) =>
        status === "archived"
          ? prev.filter((item) => item.id !== employee.id)
          : prev.map((item) =>
              item.id === employee.id
                ? { ...item, archived: false, separationDate: null }
                : item
            )
      )
      showNotice("Employee restored successfully.")
      if (status === "archived" && employees.length === 1 && page > 1) {
        setPage(page - 1)
      }
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
            {hrTabs.map((tab, index) => {
              const selectedTab = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  ref={(element) => { tabRefs.current[index] = element }}
                  id={`hr-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selectedTab}
                  aria-controls={`hr-panel-${tab.id}`}
                  tabIndex={selectedTab ? 0 : -1}
                  onClick={() => selectTab(tab.id)}
                  onKeyDown={(event) => navigateTabs(event, index)}
                  className="workspace-tab"
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {activeTab === "employees" ? (
            <div role="tabpanel" id="hr-panel-employees" aria-labelledby="hr-tab-employees">
              <section aria-label="Employee filters" className="workspace-panel workspace-filters">
                <label className="workspace-filter-search"><span className="workspace-label">Search employees</span><span className="relative block"><DashboardIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Name, ID, or email" className="workspace-control workspace-control--search" /></span></label>
                <FilterSelect label="Department" value={department} onChange={(value) => { setDepartment(value); setPage(1) }} options={departments} allLabel="All departments" />
                <FilterSelect label="Job title" value={job} onChange={(value) => { setJob(value); setPage(1) }} options={jobs} allLabel="All job titles" />
                {canViewAudit && <label><span className="workspace-label">Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="workspace-control"><option value="all">All statuses</option><option value="active">Active</option><option value="separated">Separated</option><option value="archived">Archived</option></select></label>}
                {canAddEmployee && <button type="button" onClick={() => { setSelected(null); setPanelOpen(true) }} className="workspace-primary-action"><DashboardIcon name="plus" className="h-4 w-4" />Add employee</button>}
              </section>

              {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{error}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4">Try again</button></div>}
              {optionsError && !error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><span>Department and job options are unavailable. Please retry before saving an employee.</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4">Try again</button></div>}
              <EmployeeTable key={`${page}-${department}-${job}-${status}-${refresh}`} employees={employees} pagination={pagination} loading={loading} error={Boolean(error)} onPageChange={setPage} onEdit={(employee) => { setSelected(employee); setPanelOpen(true) }} onArchive={(employee) => { setArchiveError(""); setEmployeeToArchive(employee) }} onRestore={restoreEmployee} restoringId={restoringId} canEdit={canEditEmployee} canDelete={canDeleteEmployee} canViewHistory={canViewHistory} canViewAudit={canViewAudit} canViewSalary={canViewSalary} />
            </div>
          ) : (
            <div role="tabpanel" id={`hr-panel-${activeTab}`} aria-labelledby={`hr-tab-${activeTab}`}>
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
            </div>
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
