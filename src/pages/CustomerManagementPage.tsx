import { useEffect, useState } from "react"

import CustomerPanel from "../components/customers/CustomerPanel"
import CustomerTable from "../components/customers/CustomerTable"
import SuccessToast from "../components/common/SuccessToast"
import DeleteConfirmationModal from "../components/customers/DeleteConfirmationModal"
import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import DashboardLayout from "../layouts/DashboardLayout"
import useDebouncedValue from "../hooks/useDebouncedValue"
import useDirectoryTableQuery from "../hooks/useDirectoryTableQuery"
import { customerApi, toCustomer, type CustomerInput, type CustomerPagination, type CustomerSortBy } from "../lib/customer-api"
import { getCustomerPermissions } from "../lib/rbac"
import type { Customer, PaymentTerm } from "../types/customer"

const CUSTOMER_SORTS: CustomerSortBy[] = ["customerId", "customer"]
const emptyPagination = (limit: number): CustomerPagination => ({ page: 1, limit, total: 0, totalPages: 0 })

export default function CustomerManagementPage() {
  const { user } = useAuth()
  const { searchParams, page, limit, sortBy, sortOrder, setPage, setLimit, toggleSort } = useDirectoryTableQuery(CUSTOMER_SORTS, "customer")
  const { canAdd, canEdit, canDelete, canViewAudit } = getCustomerPermissions(user)
  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | "">("")
  const [status, setStatus] = useState<"all" | "active" | "archived">("all")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pagination, setPagination] = useState<CustomerPagination>(() => emptyPagination(limit))
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
          limit,
          search: debouncedQuery,
          payterm: paymentTerm,
          status,
          sortBy,
          sortOrder,
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
          setPagination(emptyPagination(limit))
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => {
      controller.abort()
    }
  }, [page, limit, sortBy, sortOrder, paymentTerm, status, debouncedQuery, searchPending, refresh, setPage])

  const openNewCustomerPanel = () => {
    setSelectedCustomer(null)
    setPanelOpen(true)
  }

  const openEditCustomerPanel = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPanelOpen(true)
  }

  const clearFilters = () => {
    setQuery("")
    setPaymentTerm("")
    setStatus("all")
    setPage(1)
  }

  const showNotice = (message: string) => {
    setNotice((current) => ({ id: (current?.id ?? 0) + 1, message }))
  }

  const saveCustomer = async (input: CustomerInput) => {
    if (selectedCustomer) {
      const result = await customerApi.update(selectedCustomer.id, input)
      const updated = toCustomer(result.customer)
      setCustomers((prev) =>
        prev.map((item) => (item.id === selectedCustomer.id ? updated : item))
      )
      showNotice("Customer updated successfully.")
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
      const result = await customerApi.archive(customerToArchive.id)
      setCustomers((prev) =>
        status === "active"
          ? prev.filter((c) => c.id !== customerToArchive.id)
          : prev.map((c) =>
              c.id === customerToArchive.id
                ? { ...c, status: "Inactive" as const, stamp: result?.customer?.stamp || c.stamp }
                : c
            )
      )
      setCustomerToArchive(null)
      showNotice("Customer archived successfully.")
      if (status === "active" && customers.length === 1 && page > 1) setPage(page - 1)
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Unable to archive customer.")
    } finally {
      setArchiving(false)
    }
  }

  const restoreCustomer = async (customer: Customer) => {
    setRestoringId(customer.id)
    try {
      const result = await customerApi.restore(customer.id)
      setCustomers((prev) =>
        status === "archived"
          ? prev.filter((c) => c.id !== customer.id)
          : prev.map((c) =>
              c.id === customer.id
                ? { ...c, status: "Active" as const, stamp: result?.customer?.stamp || c.stamp }
                : c
            )
      )
      showNotice("Customer restored successfully.")
      if (status === "archived" && customers.length === 1 && page > 1) setPage(page - 1)
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
                  <option value="COD">COD</option>
                </select>
              </span>
            </label>
            {canAdd && <button type="button" onClick={openNewCustomerPanel} className="workspace-primary-action"><DashboardIcon name="plus" className="h-4 w-4" />Add customer</button>}
          </section>

          {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{loadError}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4 hover:text-red-950">Try again</button></div>}

          <CustomerTable customers={customers} pagination={pagination} loading={loading} error={Boolean(loadError)} onPageChange={setPage} pageSize={limit} onLimitChange={setLimit} sortBy={sortBy} sortOrder={sortOrder} onSortChange={toggleSort} onEdit={openEditCustomerPanel} onArchive={(customer) => { setArchiveError(""); setCustomerToArchive(customer) }} onRestore={restoreCustomer} restoringId={restoringId} canEdit={canEdit} canDelete={canDelete} canAdd={canAdd} canViewAudit={canViewAudit} hasFilters={Boolean(query.trim() || paymentTerm || status !== "all")} onClearFilters={clearFilters} onAdd={openNewCustomerPanel} />
        </div>
      </main>

      {(canAdd || canEdit) && <CustomerPanel customer={selectedCustomer} open={panelOpen} onClose={() => setPanelOpen(false)} onSave={saveCustomer} />}
      {canDelete && <DeleteConfirmationModal customerName={customerToArchive?.company ?? ""} open={Boolean(customerToArchive)} onCancel={() => setCustomerToArchive(null)} onConfirm={archiveCustomer} loading={archiving} error={archiveError} />}
      {notice && <SuccessToast key={notice.id} message={notice.message} onClose={() => setNotice((current) => current?.id === notice.id ? null : current)} />}
    </DashboardLayout>
  )
}
