import type { Customer } from "../../types/customer"

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m14 5 5 5M4 20l3.5-.7L20 6.8a2.1 2.1 0 0 0-3-3L4.7 16.3 4 20Z" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
    </svg>
  )
}

export default function CustomerTable({
  customers,
  onEdit,
  onDelete,
}: {
  customers: Customer[]
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
}) {
  return (
    <div className="overflow-hidden border border-slate-300 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {[
                "Customer ID",
                "Company / Name",
                "Address",
                "Payment Terms",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-5 py-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 first:pl-6 last:pr-6"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, index) => (
              <tr
                key={customer.id}
                className={`border-b border-slate-200 last:border-b-0 ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50"
                }`}
              >
                <td className="whitespace-nowrap px-5 py-4 pl-6 font-mono text-xs font-semibold text-blue-800">
                  {customer.id}
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-bold text-slate-900">
                    {customer.company}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{customer.name}</p>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {customer.address}
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex min-w-12 justify-center border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-slate-700">
                    {customer.paymentTerm}
                  </span>
                </td>
                <td className="px-5 py-4 pr-6">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(customer)}
                      aria-label={`Edit ${customer.company}`}
                      title="Edit customer"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(customer)}
                      aria-label={`Delete ${customer.company}`}
                      title="Delete customer"
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <div className="border-t border-slate-200 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            No customers match these filters.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Adjust the search or payment term to see more records.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t border-slate-300 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs font-medium text-slate-600">
          Showing 1 to {customers.length || 0} of{" "}
          {customers.length === 10 ? 82 : customers.length} entries
        </p>
        <nav aria-label="Customer table pagination">
          <ul className="flex items-center">
            <li>
              <button
                type="button"
                disabled
                className="h-9 border border-slate-300 px-3 text-xs font-semibold text-slate-400 disabled:cursor-not-allowed"
              >
                Previous
              </button>
            </li>
            {[1, 2, 3].map((page) => (
              <li key={page}>
                <button
                  type="button"
                  aria-current={page === 1 ? "page" : undefined}
                  className={`h-9 min-w-9 border-y border-r border-slate-300 text-xs font-bold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                    page === 1
                      ? "bg-blue-800 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              </li>
            ))}
            <li className="grid h-9 min-w-9 place-items-center border-y border-r border-slate-300 text-xs text-slate-400">
              …
            </li>
            <li>
              <button
                type="button"
                className="h-9 border-y border-r border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                Next
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
