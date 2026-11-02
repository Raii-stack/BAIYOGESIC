import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import ArchiveSaleModal from "../components/sales/ArchiveSaleModal"
import SaleDetailsModal from "../components/sales/SaleDetailsModal"
import SalesTable from "../components/sales/SalesTable"
import usePageQuery from "../hooks/usePageQuery"
import DashboardLayout from "../layouts/DashboardLayout"
import { getSalesPermissions } from "../lib/rbac"
import { salesApi, type SalePagination } from "../lib/sales-api"
import useDebouncedValue from "../hooks/useDebouncedValue"
import { notifyToast } from "../lib/toast"
import type { RecordStatus, SalePayment, SaleTransaction } from "../types/sale"

type StatusView = RecordStatus | "All"
const emptyPagination: SalePagination = { page: 1, limit: 10, total: 0, totalPages: 0 }

export default function SalesManagementPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const {
    canAddSale,
    canDeleteSale,
    canRestoreSale,
    canViewDetails,
    canAddDetail,
    canEditDetail,
    canDeleteDetail,
    canViewAudit,
  } = getSalesPermissions(user)
  const [transactions, setTransactions] = useState<SaleTransaction[]>([])
  const [pagination, setPagination] = useState<SalePagination>(emptyPagination)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [refresh, setRefresh] = useState(0)
  const [statusView, setStatusView] = useState<StatusView>("Active")
  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [page, setPage] = usePageQuery()
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null)
  const [saleToArchive, setSaleToArchive] = useState<SaleTransaction | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)

  const effectiveStatusView: StatusView = canViewAudit ? statusView : "Active"

  useEffect(() => {
    if (searchPending) { setLoading(true); return }
    const controller = new AbortController()
    setLoading(true)
    setLoadError("")
    salesApi
      .list({ page, limit: 10, search: debouncedQuery, status: effectiveStatusView === "All" ? "all" : effectiveStatusView === "Inactive" ? "archived" : "active" }, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages))
          return
        }
        setTransactions(result.sales)
        setPagination(result.pagination)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load sales.")
          setTransactions([])
          setPagination(emptyPagination)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [page, debouncedQuery, searchPending, effectiveStatusView, refresh])

  const confirmArchiveSale = async () => {
    if (!saleToArchive) return
    const transactionNo = saleToArchive.transactionNo
    setArchiving(true)
    setArchiveError("")
    try {
      const updated = await salesApi.archive(transactionNo)
      setTransactions((current) => current.map((sale) => sale.transactionNo === transactionNo ? updated : sale))
      setRefresh((current) => current + 1)
      setSaleToArchive(null)
      notifyToast(`Sale ${transactionNo} archived.`, "success")
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Cannot archive a sales order that already has recorded payments."
      setArchiveError(message)
    } finally {
      setArchiving(false)
    }
  }

  const handleRestoreSale = async (transactionNo: string) => {
    try {
      const updated = await salesApi.restore(transactionNo)
      setTransactions((current) => current.map((sale) => sale.transactionNo === transactionNo ? updated : sale))
      setRefresh((current) => current + 1)
      notifyToast(`Sale ${transactionNo} restored.`, "success")
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to update sale status."
      notifyToast(message, "error")
    }
  }

  const updatePayments = async (transactionNo: string, payments: SalePayment[]) => {
    const previousSale = transactions.find(
      (sale) => sale.transactionNo === transactionNo,
    )
    if (!previousSale) throw new Error("Sales transaction not found.")
    const previousPayments = previousSale?.payments ?? []
    let updated: SaleTransaction | null = null
    let notice = "Payment updated."

    if (payments.length > previousPayments.length) {
      const added = payments.find(
        (payment) => !previousPayments.some((existing) => existing.id === payment.id),
      ) ?? payments.at(-1)
      if (!added) throw new Error("Payment details are required.")
      updated = await salesApi.recordPayment(transactionNo, {
        amount: added.amount,
        paydate: added.date,
        payment_method: added.paymentMethod ?? "Cash",
      })
      notice = "Payment recorded."
    } else if (payments.length < previousPayments.length) {
      const removed = previousPayments.find(
        (payment) => !payments.some((current) => current.id === payment.id),
      )
      if (!removed) throw new Error("Payment record not found.")
      updated = await salesApi.deletePayment(transactionNo, removed.orNo)
      notice = "Payment deleted."
    } else {
      const changed = payments.find((payment) => {
        const previous = previousPayments.find((entry) => entry.id === payment.id)
        return previous && (
          previous.amount !== payment.amount ||
          previous.date !== payment.date ||
          (previous.paymentMethod ?? "Cash") !== (payment.paymentMethod ?? "Cash")
        )
      })
      if (!changed) return previousSale

      updated = await salesApi.updatePayment(transactionNo, changed.orNo, {
        amount: changed.amount,
        paydate: changed.date,
        payment_method: changed.paymentMethod ?? "Cash",
      })
      notice = "Payment updated."
    }

    if (!updated) throw new Error("The server did not return the updated sale.")

    setTransactions((current) =>
      current.map((sale) =>
        sale.transactionNo === transactionNo ? updated : sale,
      ),
    )
    setSelectedSale(updated)
    notifyToast(notice, "success")
    return updated
  }

  return (
    <DashboardLayout activeNavigation="Sales" searchPlaceholder="Search workspace">
      <>
        <main className="workspace-page">
          <div className="mx-auto max-w-7xl">
            <div className="workspace-page-header">
              <div>
                <h1 className="workspace-page-title">Sales</h1>
                <p className="workspace-page-description">
                  Track sales, review orders, and record payments.
                </p>
              </div>
            </div>

            <section aria-label="Sales filters" className="workspace-panel workspace-filters">
              <label className="workspace-filter-search">
                <span className="workspace-label">Search sales</span>
                <span className="relative block">
                  <DashboardIcon
                    name="search"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Transaction, customer, or employee"
                    className="workspace-control workspace-control--search"
                  />
                </span>
              </label>
              {canViewAudit && (
                <label>
                  <span className="workspace-label">Status</span>
                  <select
                    value={statusView}
                    onChange={(event) => {
                      setStatusView(event.target.value as StatusView)
                      setPage(1)
                    }}
                    className="workspace-control"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Archived</option>
                    <option value="All">All statuses</option>
                  </select>
                </label>
              )}
              {canAddSale && (
                <Link
                  to="/sales/new?view=create"
                  className="workspace-primary-action"
                >
                  <DashboardIcon name="plus" className="h-4 w-4" />
                  Create sale
                </Link>
              )}
            </section>

            {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{loadError}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4">Try again</button></div>}
            <SalesTable
              sales={transactions}
              total={pagination.total}
              page={page}
              loading={loading}
              error={Boolean(loadError)}
              onPageChange={setPage}
              onDetails={setSelectedSale}
              onDelete={(transactionNo) => {
                const sale = transactions.find((s) => s.transactionNo === transactionNo)
                setArchiveError("")
                setSaleToArchive(
                  sale ?? {
                    transactionNo,
                    status: "Active",
                    customerCode: "",
                    customerName: "",
                    employeeCode: "",
                    employeeName: "",
                    salesDate: "",
                    lines: [],
                    payments: [],
                    stamp: "",
                  },
                )
              }}
              onRestore={handleRestoreSale}
              canViewDetails={canViewDetails}
              canDelete={canDeleteSale}
              canRestore={canRestoreSale}
              showAdminAudit={canViewAudit}
            />
          </div>
        </main>

        <SaleDetailsModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onPaymentsChange={updatePayments}
          canAdd={canAddDetail}
          canEdit={canEditDetail}
          canDelete={canDeleteDetail}
          showAdminAudit={canViewAudit}
        />

        <ArchiveSaleModal
          transno={saleToArchive?.transactionNo ?? ""}
          open={Boolean(saleToArchive)}
          onCancel={() => {
            if (!archiving) setSaleToArchive(null)
          }}
          onConfirm={confirmArchiveSale}
          loading={archiving}
          error={archiveError}
        />
      </>
    </DashboardLayout>
  )
}
