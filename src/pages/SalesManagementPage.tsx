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
import { salesApi } from "../lib/sales-api"
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

  useEffect(() => {
    const controller = new AbortController()
    salesApi
      .list({ page: 1, limit: 200, status: "all" }, controller.signal)
      .then((result) => {
        if (!result) return
        setTransactions(result.sales)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const effectiveStatusView: StatusView = canViewAudit ? statusView : "Active"

  const visibleSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return transactions.filter((sale) => {
      const matchesStatus =
        effectiveStatusView === "All" || sale.status === effectiveStatusView
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
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const paginatedSales = visibleSales.slice((page - 1) * 10, page * 10)

  const changeStatus = async (
    transactionNo: string,
    status: SaleTransaction["status"],
  ) => {
    const existing = transactions.find((s) => s.transactionNo === transactionNo)
    if (status === "Inactive" && existing && existing.payments.length > 0) {
      try {
        await salesApi.archive(transactionNo)
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Cannot archive a sales order that already has recorded payments."
        notifyToast(message, "error")
        return
      }
    }

    try {
      const updated =
        status === "Inactive"
          ? await salesApi.archive(transactionNo)
          : await salesApi.restore(transactionNo)

      if (updated) {
        setTransactions((current) =>
          current.map((sale) =>
            sale.transactionNo === transactionNo ? updated : sale,
          ),
        )
        notifyToast(
          status === "Inactive"
            ? `Sale ${transactionNo} archived.`
            : `Sale ${transactionNo} restored.`,
          "success",
        )
        return
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to update sale status."
      notifyToast(message, "error")
      return
    }

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
    notifyToast(
      status === "Inactive"
        ? `Sale ${transactionNo} archived.`
        : `Sale ${transactionNo} restored.`,
      "info",
    )
  }

  const updatePayments = (transactionNo: string, payments: SalePayment[]) => {
    const previousSale = transactions.find(
      (sale) => sale.transactionNo === transactionNo,
    )
    const previousPayments = previousSale?.payments ?? []

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

    if (payments.length > previousPayments.length) {
      const added = payments[payments.length - 1]
      salesApi
        .recordPayment(transactionNo, {
          amount: added.amount,
          paydate: added.date,
        })
        .then((updated) => {
          if (!updated) {
            notifyToast("Payment recorded.", "info")
            return
          }
          setTransactions((current) =>
            current.map((sale) =>
              sale.transactionNo === transactionNo ? updated : sale,
            ),
          )
          setSelectedSale((current) =>
            current?.transactionNo === transactionNo ? updated : current,
          )
          notifyToast("Payment recorded.", "success")
        })
        .catch(() => {
          notifyToast("Payment recorded.", "info")
        })
    } else {
      notifyToast("Payment updated.", "info")
    }
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
                <p className="workspace-page-description">
                  Track sales, review orders, and record payments.
                </p>
              </div>
            </div>

            <section
              aria-label="Sales filters"
              className="workspace-panel workspace-filters"
            >
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
                  Create sale
                </Link>
              )}
            </section>

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
