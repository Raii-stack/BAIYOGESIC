import { useMemo, useState } from "react"

import CustomerPanel from "../components/customers/CustomerPanel"
import CustomerTable from "../components/customers/CustomerTable"
import DeleteConfirmationModal from "../components/customers/DeleteConfirmationModal"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import DashboardLayout from "../layouts/DashboardLayout"
import { customers } from "../lib/customers"
import type { Customer, PaymentTerm } from "../types/customer"

function AddIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M10 4v12M4 10h12" />
    </svg>
  )
}

export default function CustomerManagementPage() {
  const [query, setQuery] = useState("")
  const [paymentTerm, setPaymentTerm] = useState<PaymentTerm | "">("")
  const [customerRecords, setCustomerRecords] = useState<Customer[]>(customers)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  )
  const [customerToArchive, setCustomerToArchive] = useState<Customer | null>(
    null,
  )

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return customerRecords.filter((customer) => {
      const matchesQuery =
        !normalizedQuery ||
        customer.id.toLowerCase().includes(normalizedQuery) ||
        customer.company.toLowerCase().includes(normalizedQuery) ||
        customer.name.toLowerCase().includes(normalizedQuery) ||
        customer.address.toLowerCase().includes(normalizedQuery)
      const matchesTerm = !paymentTerm || customer.paymentTerm === paymentTerm

      return matchesQuery && matchesTerm
    })
  }, [customerRecords, paymentTerm, query])

  const openNewCustomerPanel = () => {
    setSelectedCustomer(null)
    setPanelOpen(true)
  }

  const openEditCustomerPanel = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPanelOpen(true)
  }

  const archiveCustomer = () => {
    if (!customerToArchive) return

    setCustomerRecords((current) =>
      current.filter((customer) => customer.id !== customerToArchive.id),
    )
    setCustomerToArchive(null)
  }

  return (
    <DashboardLayout activeNavigation="" searchPlaceholder="Search workspace">
      <>
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-7xl">
            <div className="mb-7 border-b border-slate-300 pb-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                CRM / Customer directory
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Customer Management
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Search customer records, review payment terms, and maintain
                account information.
              </p>
            </div>

            <section
              aria-label="Customer actions"
              className="mb-5 grid gap-3 border border-slate-300 bg-white p-4 md:grid-cols-[minmax(260px,1fr)_240px_auto] md:items-end"
            >
              <label>
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Search Customers
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
                    placeholder="ID, company, name, or address"
                    className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  />
                </span>
              </label>

              <label>
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  Filter by Payment Term
                </span>
                <span className="relative block">
                  <select
                    value={paymentTerm}
                    onChange={(event) =>
                      setPaymentTerm(event.target.value as PaymentTerm | "")
                    }
                    className="h-11 w-full appearance-none rounded-md border border-slate-300 bg-slate-50 px-3 pr-9 text-sm text-slate-700 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:bg-white focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  >
                    <option value="">All payment terms</option>
                    <option value="COD">COD</option>
                    <option value="30D">30D</option>
                    <option value="45D">45D</option>
                  </select>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="m6 8 4 4 4-4" />
                  </svg>
                </span>
              </label>

              <button
                type="button"
                onClick={openNewCustomerPanel}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                <AddIcon />
                Add New Customer
              </button>
            </section>

            <CustomerTable
              customers={filteredCustomers}
              onEdit={openEditCustomerPanel}
              onDelete={setCustomerToArchive}
            />
          </div>
        </main>

        <CustomerPanel
          customer={selectedCustomer}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
        />
        <DeleteConfirmationModal
          customerName={customerToArchive?.company ?? ""}
          open={Boolean(customerToArchive)}
          onCancel={() => setCustomerToArchive(null)}
          onConfirm={archiveCustomer}
        />
      </>
    </DashboardLayout>
  )
}
