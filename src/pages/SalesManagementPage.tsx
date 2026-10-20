import { useMemo, useState } from "react"
import { Link } from "react-router"

import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import SaleDetailsModal from "../components/sales/SaleDetailsModal"
import SalesTable from "../components/sales/SalesTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { salesTransactions } from "../lib/sales"
import { notifyToast } from "../lib/toast"
import type { RecordStatus, SalePayment, SaleTransaction } from "../types/sale"

type StatusView = RecordStatus | "All"

export default function SalesManagementPage() {
  const [transactions, setTransactions] =
    useState<SaleTransaction[]>(salesTransactions)
  const [statusView, setStatusView] = useState<StatusView>("Active")
  const [query, setQuery] = useState("")
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null)

  const counts = useMemo(
    () => ({
      Active: transactions.filter((sale) => sale.status === "Active").length,
      Inactive: transactions.filter((sale) => sale.status === "Inactive")
        .length,
      All: transactions.length,
    }),
    [transactions],
  )

  const visibleSales = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return transactions.filter((sale) => {
      const matchesStatus = statusView === "All" || sale.status === statusView
      const matchesQuery =
        !normalizedQuery ||
        sale.transactionNo.toLowerCase().includes(normalizedQuery) ||
        sale.customerCode.toLowerCase().includes(normalizedQuery) ||
        sale.customerName.toLowerCase().includes(normalizedQuery) ||
        sale.employeeCode.toLowerCase().includes(normalizedQuery) ||
        sale.employeeName.toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesQuery
    })
  }, [query, statusView, transactions])

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
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                  Sales / Transaction register
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Sales Management
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Review active and archived transactions with complete admin
                  audit context.
                </p>
              </div>
              <Link
                to="/sales/new"
                className="flex h-11 shrink-0 items-center justify-center rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                + New Sale
              </Link>
            </div>

            <div className="mb-5 border border-slate-300 bg-white">
              <div className="grid gap-4 p-4 md:grid-cols-[minmax(280px,1fr)_auto] md:items-end">
                <label>
                  <span className="mb-2 block text-xs font-bold text-slate-700">
                    Search sales
                  </span>
                  <span className="relative block">
                    <DashboardIcon
                      name="search"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Transaction, customer, or employee"
                      className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                    />
                  </span>
                </label>
                <div className="flex border border-slate-300" role="tablist">
                  {(["Active", "Inactive", "All"] as StatusView[]).map(
                    (status) => (
                      <button
                        key={status}
                        type="button"
                        role="tab"
                        aria-selected={statusView === status}
                        onClick={() => setStatusView(status)}
                        className={`h-11 border-r border-slate-300 px-4 text-xs font-bold last:border-r-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                          statusView === status
                            ? "bg-blue-800 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {status}{" "}
                        <span
                          className={
                            statusView === status
                              ? "text-blue-200"
                              : "text-slate-400"
                          }
                        >
                          {counts[status]}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="border-t border-slate-200 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Admin view · Inactive records remain available for audit and
                restore
              </div>
            </div>

            <SalesTable
              sales={visibleSales}
              onDetails={setSelectedSale}
              onDelete={(transactionNo) =>
                changeStatus(transactionNo, "Inactive")
              }
              onRestore={(transactionNo) =>
                changeStatus(transactionNo, "Active")
              }
              showAdminAudit
            />
          </div>
        </main>

        <SaleDetailsModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onPaymentsChange={updatePayments}
          showAdminAudit
        />
      </>
    </DashboardLayout>
  )
}
