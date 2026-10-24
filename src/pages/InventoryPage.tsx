import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"

import SuccessToast from "../components/common/SuccessToast"
import { useAuth } from "../components/auth/AuthProvider"
import { DashboardIcon } from "../components/dashboard/DashboardComponents"
import ArchiveProductModal from "../components/inventory/ArchiveProductModal"
import ProductPanel from "../components/inventory/ProductPanel"
import ProductTable from "../components/inventory/ProductTable"
import DashboardLayout from "../layouts/DashboardLayout"
import useDebouncedValue from "../hooks/useDebouncedValue"
import usePageQuery from "../hooks/usePageQuery"
import { productApi, type ProductInput, type ProductPagination } from "../lib/product-api"
import { getProductPermissions } from "../lib/rbac"
import type { Product, UnitType } from "../types/product"

const PAGE_SIZE = 10
const emptyPagination: ProductPagination = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 }

function AddIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const { canAdd, canEdit, canDelete, canViewAudit } = getProductPermissions(user)
  const [query, setQuery] = useState(() => searchParams.get("search") || "")
  const debouncedQuery = useDebouncedValue(query.trim())
  const searchPending = query.trim() !== debouncedQuery
  const [unit, setUnit] = useState<UnitType | "">("")
  const [status, setStatus] = useState<"all" | "active" | "archived">("all")
  const [page, setPage] = usePageQuery()
  const [products, setProducts] = useState<Product[]>([])
  const [pagination, setPagination] = useState<ProductPagination>(emptyPagination)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productToArchive, setProductToArchive] = useState<Product | null>(null)
  const [archiveError, setArchiveError] = useState("")
  const [archiving, setArchiving] = useState(false)
  const [restoringCode, setRestoringCode] = useState<string | null>(null)

  useEffect(() => {
    document.title = "Products | HOPE, Inc."
    return () => { document.title = "Sign in | HOPE, Inc." }
  }, [])

  useEffect(() => {
    if (searchPending) {
      setLoading(true)
      setLoadError("")
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setLoadError("")
    const load = async () => {
      try {
        const result = await productApi.list({ page, limit: PAGE_SIZE, search: debouncedQuery, unit, status }, controller.signal)
        if (controller.signal.aborted) return
        if (page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages))
          return
        }
        setProducts(result.products)
        setPagination(result.pagination)
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Unable to load products.")
          setProducts([])
          setPagination(emptyPagination)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [page, unit, status, debouncedQuery, searchPending, refresh])

  const showNotice = (message: string) => setNotice((current) => ({ id: (current?.id ?? 0) + 1, message }))

  const saveProduct = async (input: ProductInput) => {
    if (selectedProduct) {
      await productApi.update(selectedProduct.code, input)
      showNotice("Product updated successfully.")
      setRefresh((current) => current + 1)
    } else {
      await productApi.create(input)
      showNotice("Product created successfully.")
      if (status === "archived") setStatus("all")
      setPage(1)
      setRefresh((current) => current + 1)
    }
  }

  const archiveProduct = async () => {
    if (!productToArchive) return
    setArchiving(true)
    setArchiveError("")
    try {
      await productApi.archive(productToArchive.code)
      setProductToArchive(null)
      showNotice("Product archived successfully.")
      if (status === "active" && products.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "Unable to archive product.")
    } finally {
      setArchiving(false)
    }
  }

  const restoreProduct = async (product: Product) => {
    setRestoringCode(product.code)
    try {
      await productApi.restore(product.code)
      showNotice("Product restored successfully.")
      if (status === "archived" && products.length === 1 && page > 1) setPage(page - 1)
      else setRefresh((current) => current + 1)
    } catch {
      // Shared error toast is emitted by apiFailure
    } finally {
      setRestoringCode(null)
    }
  }

  return (
    <DashboardLayout activeNavigation="Products" searchPlaceholder="Search workspace">
      <main className="workspace-page">
        <div className="mx-auto max-w-7xl">
          <header className="workspace-page-header">
            <div>
              <h1 className="workspace-page-title">Products</h1>
              <p className="workspace-page-description">Manage your product catalog, pricing, and price history.</p>
            </div>
          </header>

          <section aria-label="Product filters" className="workspace-panel workspace-filters">
            <label className="workspace-filter-search">
              <span className="workspace-label">Search products</span>
              <span className="relative block">
                <DashboardIcon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Code or description" className="workspace-control workspace-control--search" />
              </span>
            </label>
            {canViewAudit && (
              <label>
                <span className="workspace-label">Status</span>
                <span className="relative block">
                  <select value={status} onChange={(event) => { setStatus(event.target.value as "all" | "active" | "archived"); setPage(1) }} className="workspace-control">
                    <option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option>
                  </select>
                </span>
              </label>
            )}
            <label>
              <span className="workspace-label">Unit type</span>
              <span className="relative block">
                <select value={unit} onChange={(event) => { setUnit(event.target.value as UnitType | ""); setPage(1) }} className="workspace-control">
                  <option value="">All units</option><option value="pc">Pieces (pc)</option><option value="ea">Each (ea)</option><option value="mtr">Meters (mtr)</option><option value="pkg">Packages (pkg)</option><option value="ltr">Liters (ltr)</option>
                </select>
              </span>
            </label>
            {canAdd && <button type="button" onClick={() => { setSelectedProduct(null); setPanelOpen(true) }} className="workspace-primary-action"><AddIcon />Add product</button>}
          </section>

          {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{loadError}</span><button type="button" onClick={() => setRefresh((current) => current + 1)} className="underline underline-offset-4 hover:text-red-950">Try again</button></div>}
          <ProductTable key={`${page}-${unit}-${status}-${refresh}`} products={products} pagination={pagination} loading={loading} error={Boolean(loadError)} onPageChange={setPage} onEdit={(product) => { setSelectedProduct(product); setPanelOpen(true) }} onArchive={(product) => { setArchiveError(""); setProductToArchive(product) }} onRestore={restoreProduct} restoringCode={restoringCode} canEdit={canEdit} canDelete={canDelete} canViewAudit={canViewAudit} />
        </div>
      </main>

      {(canAdd || canEdit) && <ProductPanel product={selectedProduct} open={panelOpen} onClose={() => setPanelOpen(false)} onSave={saveProduct} />}
      {canDelete && <ArchiveProductModal productName={productToArchive?.description ?? ""} open={Boolean(productToArchive)} onCancel={() => setProductToArchive(null)} onConfirm={archiveProduct} loading={archiving} error={archiveError} />}
      {notice && <SuccessToast key={notice.id} message={notice.message} onClose={() => setNotice((current) => current?.id === notice.id ? null : current)} />}
    </DashboardLayout>
  )
}
