import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"

import CustomerPanel from "../components/customers/CustomerPanel"
import CustomerTable from "../components/customers/CustomerTable"
import SuccessToast from "../components/common/SuccessToast"
import DeleteConfirmationModal from "../components/customers/DeleteConfirmationModal"
import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import DashboardLayout from "../layouts/DashboardLayout"
import useDebouncedValue from "../hooks/useDebouncedValue"
import usePageQuery from "../hooks/usePageQuery"
import { customerApi, type CustomerInput, type CustomerPagination } from "../lib/customer-api"
import { getCustomerPermissions } from "../lib/rbac"
import type { Customer, PaymentTerm } from "../types/customer"

const PAGE_SIZE = 10
const emptyPagination: CustomerPagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

function AddIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
}

export default function CustomerManagementPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const { canAdd, canEdit, canDelete, canViewAudit } = getCustomerPermissions(user)
  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | "">("")
  const [status, setStatus] = useState<"all" | "active" | "archived">("all")
  const [page, setPage] = usePageQuery()
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
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages))
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
      <main className="workspace-page">
        <div className="mx-auto max-w-7xl">
          <header className="workspace-page-header">
            <div>
              <h1 className="workspace-page-title">Customers</h1>
              <p className="workspace-page-description">Manage customer details and payment terms.</p>
            </div>
          </header>

          <section aria-label="Customer filters" className="workspace-panel workspace-filters">
            <label className="workspace-filter-search">
              <span className="workspace-label">Search customers</span>
              <span className="relative block">
                <DashboardIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="ID, customer name, or address" className="workspace-control workspace-control--search" />
              </span>
            </label>
            {canViewAudit && (
              <label>
                <span className="workspace-label">Status</span>
                <span className="relative block">
                  <select value={status} onChange={(event) => { setStatus(event.target.value as "all" | "active" | "archived"); setPage(1) }} className="workspace-control">
                    <option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option>
                  </select>
                </span>
              </label>
            )}
            <label>
              <span className="workspace-label">Payment terms</span>
              <span className="relative block">
                <select value={paymentTerm} onChange={(event) => { setPaymentTerm(event.target.value as PaymentTerm | ""); setPage(1) }} className="workspace-control">
                  <option value="">All terms</option>
                  <option value="30D">Net 30</option>
                  <option value="45D">Net 45</option>
                  <option value="60D">Net 60</option>
                  <option value="COD">Cash on delivery</option>
                </select>
              </span>
            </label>
            {canAdd && <button type="button" onClick={openNewCustomerPanel} className="workspace-primary-action"><AddIcon />Add customer</button>}
          </section>

          {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{loadError}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4 hover:text-red-950">Try again</button></div>}

          <CustomerTable customers={customers} pagination={pagination} loading={loading} error={Boolean(loadError)} onPageChange={setPage} onEdit={openEditCustomerPanel} onArchive={(customer) => { setArchiveError(""); setCustomerToArchive(customer) }} onRestore={restoreCustomer} restoringId={restoringId} canEdit={canEdit} canDelete={canDelete} canViewAudit={canViewAudit} />
        </div>
      </main>

      {(canAdd || canEdit) && <CustomerPanel customer={selectedCustomer} open={panelOpen} onClose={() => setPanelOpen(false)} onSave={saveCustomer} />}
      {canDelete && <DeleteConfirmationModal customerName={customerToArchive?.company ?? ""} open={Boolean(customerToArchive)} onCancel={() => setCustomerToArchive(null)} onConfirm={archiveCustomer} loading={archiving} error={archiveError} />}
      {notice && <SuccessToast key={notice.id} message={notice.message} onClose={() => setNotice((current) => current?.id === notice.id ? null : current)} />}
    </DashboardLayout>
  )
}
