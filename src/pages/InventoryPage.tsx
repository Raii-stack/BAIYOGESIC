import { useState } from "react"

import ProductPanel from "../components/inventory/ProductPanel"
import ProductTable from "../components/inventory/ProductTable"
import DashboardLayout from "../layouts/DashboardLayout"
import { products } from "../lib/products"
import type { Product } from "../types/product"

export default function InventoryPage() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const openNewProduct = () => {
    setSelectedProduct(null)
    setPanelOpen(true)
  }

  const openEditProduct = (product: Product) => {
    setSelectedProduct(product)
    setPanelOpen(true)
  }

  return (
    <DashboardLayout
      activeNavigation="Products"
      searchPlaceholder="Search workspace"
    >
      <>
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
              <button
                type="button"
                onClick={openNewProduct}
                className="h-11 shrink-0 rounded-md bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                + Add Product
              </button>
            </div>

            <ProductTable
              products={products}
              onEdit={openEditProduct}
              showAdminAudit
            />
          </div>
        </main>

        <ProductPanel
          product={selectedProduct}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
        />
      </>
    </DashboardLayout>
  )
}
