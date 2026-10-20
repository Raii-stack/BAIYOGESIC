import { useState, type FormEvent } from "react"
import { Link } from "react-router"

import CustomerCombobox from "../components/sales/CustomerCombobox"
import EmployeeCombobox from "../components/sales/EmployeeCombobox"
import DashboardLayout from "../layouts/DashboardLayout"
import { customers } from "../lib/customers"
import { employees } from "../lib/employees"
import { notifyToast } from "../lib/toast"

export default function CreateSalePage() {
  const [customerId, setCustomerId] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const salesDate = new Intl.DateTimeFormat("en-CA").format(new Date())

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!customerId || !employeeId) return

    notifyToast("Preview only: this sale was not saved to the database.", "info")
  }

  return (
    <DashboardLayout
      activeNavigation="Sales"
      searchPlaceholder="Search workspace"
    >
      <>
        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
          <div className="mx-auto max-w-4xl">
            <div className="mb-7 border-b border-slate-300 pb-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                Sales / New transaction header
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                New Sale
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Create the transaction header before adding products in Sale
                Details.
              </p>
            </div>

            <form
              onSubmit={submit}
              className="border border-slate-300 border-t-[3px] border-t-blue-800 bg-white"
            >
              <div className="border-b border-slate-300 px-6 py-5 sm:px-8">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-800">
                  Transaction header
                </p>
                <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-slate-950">
                  Sale identification and ownership
                </h2>
              </div>

              <div className="grid gap-6 px-6 py-7 sm:grid-cols-2 sm:px-8">
                <label>
                  <span className="mb-2 block text-xs font-bold text-slate-700">
                    Transaction No.
                  </span>
                  <input
                    type="text"
                    readOnly
                    value="Auto-numbered on save"
                    className="h-11 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-500 outline-none"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-bold text-slate-700">
                    Sales Date
                  </span>
                  <input
                    type="date"
                    defaultValue={salesDate}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition hover:border-slate-400 focus:border-blue-700 focus:shadow-[0_0_0_3px] focus:shadow-blue-100"
                  />
                </label>
                <div className="sm:col-span-2">
                  <CustomerCombobox
                    customers={customers}
                    selectedCustomerId={customerId}
                    onSelect={setCustomerId}
                  />
                </div>
                <div className="sm:col-span-2">
                  <EmployeeCombobox
                    employees={employees}
                    selectedEmployeeId={employeeId}
                    onSelect={setEmployeeId}
                  />
                </div>
              </div>

              <div className="border-y border-slate-300 bg-blue-50 px-6 py-3 text-xs leading-5 text-blue-900 sm:px-8">
                Status and Stamp are generated automatically by the system and
                are not entered on this form.
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-5 sm:px-8">
                <Link
                  to="/sales"
                  className="flex h-11 items-center rounded-md border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={!customerId || !employeeId}
                  className="h-11 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  Save Sale
                </button>
              </div>
            </form>
          </div>
        </main>

      </>
    </DashboardLayout>
  )
}
