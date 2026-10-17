import ProductTable from "../components/inventory/ProductTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { products } from "../lib/products"

export default function InventoryPage() {
  return (
    <DashboardLayout activeNavigation="" searchPlaceholder="Search workspace">
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 xl:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col gap-5 border-b border-slate-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-800">
                Inventory / Product registry
              </p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Inventory &amp; Product Management
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Review product units, current pricing, and effective price
                history from one controlled register.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
              <span className="h-2 w-2 bg-emerald-600" />
              Product catalog active
            </div>
          </div>

          <ProductTable products={products} />
        </div>
      </main>
    </DashboardLayout>
  )
}
