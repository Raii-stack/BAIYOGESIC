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
        <main className="workspace-page">
          <div className="mx-auto max-w-7xl">
            <header className="workspace-page-header"><div><h1 className="workspace-page-title">Create sale</h1><p className="workspace-page-description">Choose a customer and the employee responsible for the sale. This form is a preview; changes aren’t saved.</p></div></header>

            <form
              onSubmit={submit}
              className="workspace-panel workspace-form-panel"
            >
              <div className="workspace-table-header">
                <h2 className="text-sm font-semibold text-neutral-900">
                  Sale details
                </h2>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <label>
                  <span className="workspace-label">
                    Transaction number
                  </span>
                  <input
                    type="text"
                    readOnly
                    value="Auto-numbered on save"
                    className="workspace-control"
                  />
                </label>
                <label>
                  <span className="workspace-label">
                    Sales date
                  </span>
                  <input
                    type="date"
                    defaultValue={salesDate}
                    className="workspace-control"
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

              <div className="workspace-drawer-footer rounded-b-xl">
                <Link
                  to="/sales?view=transactions&page=1"
                  className="workspace-secondary-action"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={!customerId || !employeeId}
                  className="workspace-primary-action"
                >
                  Preview sale
                </button>
              </div>
            </form>
          </div>
        </main>

      </>
    </DashboardLayout>
  )
}
