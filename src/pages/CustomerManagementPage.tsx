import { useEffect, useState } from "react"

import CustomerPanel from "../components/customers/CustomerPanel"
import CustomerTable from "../components/customers/CustomerTable"
import SuccessToast from "../components/common/SuccessToast"
import DeleteConfirmationModal from "../components/customers/DeleteConfirmationModal"
import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import DashboardLayout from "../layouts/DashboardLayout"
import useDebouncedValue from "../hooks/useDebouncedValue"
import { customerApi, type CustomerInput, type CustomerPagination } from "../lib/customer-api"
import type { Customer, PaymentTerm } from "../types/customer"

const PAGE_SIZE = 10
const emptyPagination: CustomerPagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

function AddIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
}

export default function CustomerManagementPage() {
  const { user } = useAuth()
  const isSuperOrAdmin = user?.role === "superadmin" || user?.role === "administrator" || user?.role === "admin"
  const canEdit = isSuperOrAdmin || Boolean(user?.rights?.some((r) => r === "customers.add" || r === "customers.edit"))
  const canDelete = isSuperOrAdmin || Boolean(user?.rights?.includes("customers.delete"))
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | "">("")
  const [status, setStatus] = useState<"all" | "active" | "archived">("all")
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pagination, setPagination] = useState<CustomerPagination>(emptyPagination)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerToArchive, setCustomerToArchive] = useState<Customer | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Customers | HOPE, Inc."
    return () => { document.title = "Sign in | HOPE, Inc." }
  }, [])

  useEffect(() => {
    if (searchPending) {
      setLoading(true)
      setLoadError("")
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setLoadError("")
    const load = async () => {
      try {
        const result = await customerApi.list({
          page,
          limit: PAGE_SIZE,
          search: debouncedQuery,
          payterm: paymentTerm,
          status,
        }, controller.signal)
        if (controller.signal.aborted) return
        if (result.pagination.totalPages > 0 && page > result.pagination.totalPages) {
          setPage(result.pagination.totalPages)
          return
        }
        setCustomers(result.customers)
        setPagination(result.pagination)
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load customers.")
          setCustomers([])
          setPagination(emptyPagination)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => {
      controller.abort()
    }
  }, [page, paymentTerm, status, debouncedQuery, searchPending, refresh])

  const openNewCustomerPanel = () => {
    setSelectedCustomer(null)
    setPanelOpen(true)
  }

  const openEditCustomerPanel = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPanelOpen(true)
  }

  const showNotice = (message: string) => {
    setNotice((current) => ({ id: (current?.id ?? 0) + 1, message }))
  }

  const saveCustomer = async (input: CustomerInput) => {
    if (selectedCustomer) {
      await customerApi.update(selectedCustomer.id, input)
      showNotice("Customer updated successfully.")
      setRefresh((current) => current + 1)
    } else {
      await customerApi.create(input)
      showNotice("Customer created successfully.")
      if (status === "archived") setStatus("all")
      setPage(1)
      setRefresh((current) => current + 1)
    }
  }

  const archiveCustomer = async () => {
    if (!customerToArchive) return
    setArchiving(true)
    setArchiveError("")
    try {
      await customerApi.archive(customerToArchive.id)
      setCustomerToArchive(null)
      showNotice("Customer archived successfully.")
      if (status === "active" && customers.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Unable to archive customer.")
    } finally {
      setArchiving(false)
    }
  }

  const restoreCustomer = async (customer: Customer) => {
    setRestoringId(customer.id)
    try {
      await customerApi.restore(customer.id)
      showNotice("Customer restored successfully.")
      if (status === "archived" && customers.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <DashboardLayout activeNavigation="Customers" searchPlaceholder="Search workspace">
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">CRM / Customer directory</p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">Customer Management</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Find customer accounts, review their payment terms, and keep records current.</p>
            </div>
            <div className="flex items-center gap-3 self-start border-l-2 border-blue-800 pl-4 sm:self-auto">
              <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-950">{loading || loadError ? "—" : pagination.total}</span>
              <span className="max-w-20 text-[10px] font-bold uppercase leading-4 tracking-[0.12em] text-slate-500">Matching records</span>
            </div>
          </header>

          <section aria-label="Customer filters" className="mb-5 grid gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-[0_8px_28px_rgba(15,39,67,0.04)] md:grid-cols-2 md:items-end lg:grid-cols-[minmax(220px,1fr)_180px_160px_auto]">
            <label>
              <span className="mb-2 block text-xs font-bold text-slate-700">Search customers</span>
              <span className="relative block">
                <DashboardIcon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="ID, customer name, or address" className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100" />
              </span>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold text-slate-700">Status</span>
              <span className="relative block">
                <select value={status} onChange={(event) => { setStatus(event.target.value as "all" | "active" | "archived"); setPage(1) }} className="h-11 w-full appearance-none rounded-md border border-slate-300 bg-slate-50 px-3 pr-9 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100">
                  <option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option>
                </select>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 8 4 4 4-4" /></svg>
              </span>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold text-slate-700">Payment terms</span>
              <span className="relative block">
                <select value={paymentTerm} onChange={(event) => { setPaymentTerm(event.target.value as PaymentTerm | ""); setPage(1) }} className="h-11 w-full appearance-none rounded-md border border-slate-300 bg-slate-50 px-3 pr-9 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100">
                  <option value="">All terms</option>
                  <option value="30D">Net 30</option>
                  <option value="45D">Net 45</option>
                  <option value="COD">Cash on delivery</option>
                </select>
                <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 8 4 4 4-4" /></svg>
              </span>
            </label>
            {canEdit && <button type="button" onClick={openNewCustomerPanel} className="flex h-11 items-center justify-center gap-2 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"><AddIcon />Add customer</button>}
          </section>

          {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{loadError}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4 hover:text-red-950">Try again</button></div>}

          <CustomerTable customers={customers} pagination={pagination} loading={loading} error={Boolean(loadError)} onPageChange={setPage} onEdit={openEditCustomerPanel} onArchive={(customer) => { setArchiveError(""); setCustomerToArchive(customer) }} onRestore={restoreCustomer} restoringId={restoringId} canEdit={Boolean(canEdit)} canDelete={canDelete} />
        </div>
      </main>

      {canEdit && <CustomerPanel customer={selectedCustomer} open={panelOpen} onClose={() => setPanelOpen(false)} onSave={saveCustomer} />}
      {canDelete && <DeleteConfirmationModal customerName={customerToArchive?.company ?? ""} open={Boolean(customerToArchive)} onCancel={() => setCustomerToArchive(null)} onConfirm={archiveCustomer} loading={archiving} error={archiveError} />}
      {notice && <SuccessToast key={notice.id} message={notice.message} onClose={() => setNotice((current) => current?.id === notice.id ? null : current)} />}
    </DashboardLayout>
  )
}
