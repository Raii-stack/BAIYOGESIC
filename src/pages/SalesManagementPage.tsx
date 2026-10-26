import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import SaleDetailsModal from "../components/sales/SaleDetailsModal"
import SalesTable from "../components/sales/SalesTable"
import usePageQuery from "../hooks/usePageQuery"
import DashboardLayout from "../layouts/DashboardLayout"
import { getSalesPermissions } from "../lib/rbac"
import { salesTransactions } from "../lib/sales"
import { notifyToast } from "../lib/toast"
import type { RecordStatus, SalePayment, SaleTransaction } from "../types/sale"

type StatusView = RecordStatus | "All"

export default function SalesManagementPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const {
    canAddSale,
    canDeleteSale,
    canViewDetails,
    canAddDetail,
    canEditDetail,
    canDeleteDetail,
    canViewAudit,
  } = getSalesPermissions(user)
  const [transactions, setTransactions] =
    useState<SaleTransaction[]>(salesTransactions)
  const [statusView, setStatusView] = useState<StatusView>("Active")
  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const [page, setPage] = usePageQuery()
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null)

  const effectiveStatusView: StatusView = canViewAudit ? statusView : "Active"

  const visibleSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return transactions.filter((sale) => {
      const matchesStatus = effectiveStatusView === "All" || sale.status === effectiveStatusView
      const matchesQuery =
        !normalizedQuery ||
        sale.transactionNo.toLowerCase().includes(normalizedQuery) ||
        sale.customerCode.toLowerCase().includes(normalizedQuery) ||
        sale.customerName.toLowerCase().includes(normalizedQuery) ||
        sale.employeeCode.toLowerCase().includes(normalizedQuery) ||
        sale.employeeName.toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesQuery
    })
  }, [effectiveStatusView, query, transactions])

  const totalPages = Math.max(1, Math.ceil(visibleSales.length / 10))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const paginatedSales = visibleSales.slice((page - 1) * 10, page * 10)

  const changeStatus = (
    transactionNo: string,
    status: SaleTransaction["status"],
  ) => {
    notifyToast(`Preview only: ${status === "Inactive" ? "archiving" : "restoring"} a sale is not saved to the database yet.`, "info")
    setTransactions((current) =>
      current.map((sale) =>
        sale.transactionNo === transactionNo
          ? {
              ...sale,
              status,
              stamp:
                status === "Active"
                  ? "EDITED user1 2026-10-13 1:01 PM"
                  : "DELETED user2 2026-10-13 1:01 PM",
            }
          : sale,
      ),
    )
  }

  const updatePayments = (transactionNo: string, payments: SalePayment[]) => {
    notifyToast("Preview only: payment changes are not saved to the database yet.", "info")
    setTransactions((current) =>
      current.map((sale) =>
        sale.transactionNo === transactionNo ? { ...sale, payments } : sale,
      ),
    )
    setSelectedSale((current) =>
      current?.transactionNo === transactionNo
        ? { ...current, payments }
        : current,
    )
  }

  return (
    <DashboardLayout
      activeNavigation="Sales"
      searchPlaceholder="Search workspace"
    >
      <>
        <main className="workspace-page">
          <div className="mx-auto max-w-7xl">
            <div className="workspace-page-header">
              <div>
                <h1 className="workspace-page-title">Sales</h1>
                <p className="workspace-page-description">Track sales, review orders, and record payments.</p>
              </div>
            </div>

            <section aria-label="Sales filters" className="workspace-panel workspace-filters">
              <label className="workspace-filter-search">
                <span className="workspace-label">Search sales</span>
                <span className="relative block">
                  <DashboardIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }}
                    placeholder="Transaction, customer, or employee" className="workspace-control workspace-control--search" />
                </span>
              </label>
              {canViewAudit && (
                <label>
                  <span className="workspace-label">Status</span>
                  <select value={statusView} onChange={(event) => { setStatusView(event.target.value as StatusView); setPage(1) }} className="workspace-control">
                    <option value="Active">Active</option>
                    <option value="Inactive">Archived</option>
                    <option value="All">All statuses</option>
                  </select>
                </label>
              )}
              {canAddSale && <Link to="/sales/new?view=create" className="workspace-primary-action">Create sale</Link>}
            </section>
            <div className="workspace-notice mb-4"><p>Sample sales data. Sales and payment changes are preview-only and are not saved.</p></div>

            <SalesTable
              sales={paginatedSales}
              total={visibleSales.length}
              page={page}
              onPageChange={setPage}
              onDetails={setSelectedSale}
              onDelete={(transactionNo) =>
                changeStatus(transactionNo, "Inactive")
              }
              onRestore={(transactionNo) =>
                changeStatus(transactionNo, "Active")
              }
              canViewDetails={canViewDetails}
              canDelete={canDeleteSale}
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
      </>
    </DashboardLayout>
  )
}
