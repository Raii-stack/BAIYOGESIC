import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"

import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import ArchiveSaleModal from "../components/sales/ArchiveSaleModal"
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
    canRestoreSale,
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
  const [saleToArchive, setSaleToArchive] = useState<SaleTransaction | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)

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

  const confirmArchiveSale = async () => {
    if (!saleToArchive) return
    const transactionNo = saleToArchive.transactionNo
    setArchiving(true)
    setArchiveError("")
    try {
      const updated = await salesApi.archive(transactionNo)
      if (updated) {
        setTransactions((current) =>
          current.map((sale) =>
            sale.transactionNo === transactionNo ? updated : sale,
          ),
        )
      } else {
        setTransactions((current) =>
          current.map((sale) =>
            sale.transactionNo === transactionNo
              ? {
                  ...sale,
                  status: "Inactive" as const,
                  stamp: "DELETED user2 2026-10-13 1:01 PM",
                }
              : sale,
          ),
        )
      }
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
      if (updated) {
        setTransactions((current) =>
          current.map((sale) =>
            sale.transactionNo === transactionNo ? updated : sale,
          ),
        )
      } else {
        setTransactions((current) =>
          current.map((sale) =>
            sale.transactionNo === transactionNo
              ? {
                  ...sale,
                  status: "Active" as const,
                  stamp: "EDITED user1 2026-10-13 1:01 PM",
                }
              : sale,
          ),
        )
      }
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

    if (!updated) return previousSale

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

            <section className="workspace-filter-bar">
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
