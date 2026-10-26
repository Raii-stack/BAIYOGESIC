import type { Customer, PaymentTerm } from "../types/customer"
import type { Employee } from "../types/employee"
import type {
  PaymentStatus,
  SaleCatalogProduct,
  SaleLine,
  SalePayment,
  SaleTransaction,
} from "../types/sale"
import { apiFailure } from "./api-errors"
import { toCustomer } from "./customer-api"
import { toEmployee } from "./employee-api"
import { roundCurrency } from "./sales"

type ApiSaleLineRow = {
  id?: string
  transno?: string
  prodcode?: string
  productCode?: string
  description?: string
  productName?: string
  unit?: string
  quantity?: number | string
  qty?: number | string
  unitprice?: number | string
  unitPrice?: number | string
  is_deleted?: boolean
  status?: "Active" | "Inactive"
  stamp?: string
}

type ApiSalePaymentRow = {
  id?: string
  orno?: string
  orNo?: string
  paydate?: string
  date?: string
  payment_date?: string
  amount?: number | string
  is_deleted?: boolean
  status?: "Active" | "Inactive"
  stamp?: string
}

export type ApiSaleRow = {
  transno?: string
  transactionNo?: string
  salesdate?: string
  salesDate?: string
  custno?: string
  customerCode?: string
  custname?: string
  customerName?: string
  empno?: string
  employeeCode?: string
  empname?: string
  employeeName?: string
  is_deleted?: boolean
  status?: "Active" | "Inactive"
  stamp?: string
  lines?: ApiSaleLineRow[]
  lineItems?: ApiSaleLineRow[]
  payments?: ApiSalePaymentRow[]
  subtotal?: number | string
  tax?: number | string
  total?: number | string
  totalAmount?: number | string
  total_amount?: number | string
  amountPaid?: number | string
  amount_paid?: number | string
  balance?: number | string
  paymentStatus?: PaymentStatus
  payment_status?: PaymentStatus
}

export type SalePagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type CreateSaleInput = {
  custno: string
  empno: string
  salesdate: string
  lines: {
    prodcode: string
    quantity: number
    unitprice?: number | null
  }[]
}

export type RecordPaymentInput = {
  amount: number
  paydate: string
  orno?: string
}

type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { message?: string; details?: Record<string, string> }
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "")

async function request<T>(
  path: string,
  method = "GET",
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/sales${path}`, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw apiFailure(0)
  }

  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (!response.ok || !result?.success || !result.data) {
    throw apiFailure(response.status, result)
  }
  return result.data
}

export function toSaleTransaction(row: ApiSaleRow): SaleTransaction {
  const transactionNo = row.transactionNo || row.transno || ""
  const rawLines = row.lines || row.lineItems || []
  const rawPayments = row.payments || []
  const isDeleted = row.status ? row.status === "Inactive" : Boolean(row.is_deleted)

  const lines: SaleLine[] = rawLines.map((line, index) => {
    const prodCode = line.productCode || line.prodcode || ""
    const lineDeleted = line.status
      ? line.status === "Inactive"
      : Boolean(line.is_deleted)
    return {
      id: line.id || `${transactionNo}-${prodCode || index + 1}`,
      productCode: prodCode,
      productName: line.productName || line.description || prodCode,
      quantity: roundCurrency(Number(line.quantity ?? line.qty ?? 0)),
      unitPrice: roundCurrency(Number(line.unitPrice ?? line.unitprice ?? 0)),
      status: lineDeleted ? "Inactive" : "Active",
      stamp: line.stamp || "",
    }
  })

  const payments: SalePayment[] = rawPayments.map((payment, index) => {
    const orNo = payment.orNo || payment.orno || `OR-${index + 1}`
    return {
      id: payment.id || orNo,
      orNo,
      date: payment.date || payment.paydate || payment.payment_date || "",
      amount: roundCurrency(Number(payment.amount ?? 0)),
      stamp: payment.stamp || "",
    }
  })

  return {
    transactionNo,
    salesDate: row.salesDate || row.salesdate || "",
    customerCode: row.customerCode || row.custno || "",
    customerName: row.customerName || row.custname || row.custno || "",
    employeeCode: row.employeeCode || row.empno || "",
    employeeName: row.employeeName || row.empname || row.empno || "",
    status: isDeleted ? "Inactive" : "Active",
    stamp: row.stamp || "",
    lines,
    payments,
    subtotal:
      row.subtotal !== undefined ? roundCurrency(Number(row.subtotal)) : undefined,
    tax: row.tax !== undefined ? roundCurrency(Number(row.tax)) : undefined,
    totalAmount:
      (row.totalAmount ?? row.total_amount ?? row.total) !== undefined
        ? roundCurrency(Number(row.totalAmount ?? row.total_amount ?? row.total))
        : undefined,
    amountPaid:
      (row.amountPaid ?? row.amount_paid) !== undefined
        ? roundCurrency(Number(row.amountPaid ?? row.amount_paid))
        : undefined,
    balance:
      row.balance !== undefined ? roundCurrency(Number(row.balance)) : undefined,
    paymentStatus: row.paymentStatus || row.payment_status,
  }
}

export const salesApi = {
  async list(
    options: {
      page?: number
      limit?: number
      search?: string
      status?: "all" | "active" | "archived"
    } = {},
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams({
      page: String(options.page ?? 1),
      limit: String(options.limit ?? 100),
    })
    if (options.search) params.set("search", options.search)
    if (options.status && options.status !== "all") params.set("status", options.status)

    const data = await request<{
      sales?: ApiSaleRow[]
      transactions?: ApiSaleRow[]
      pagination?: SalePagination
    }>(`?${params}`, "GET", undefined, signal)

    const rawSales = data.sales || data.transactions
    if (!Array.isArray(rawSales)) {
      return null
    }

    return {
      sales: rawSales.map(toSaleTransaction),
      pagination: data.pagination || {
        page: options.page ?? 1,
        limit: options.limit ?? 100,
        total: rawSales.length,
        totalPages: 1,
      },
    }
  },

  async catalog(signal?: AbortSignal): Promise<{
    customers: Customer[]
    employees: Employee[]
    products: SaleCatalogProduct[]
  } | null> {
    const data = await request<{
      customers?: {
        custno: string
        custname: string
        address: string
        payterm: PaymentTerm
        is_deleted: boolean
        stamp: string
      }[]
      employees?: {
        empno: string
        firstname: string | null
        lastname: string | null
        email: string
        gender: "M" | "F" | null
        birthdate: string | null
        hiredate: string | null
        sepdate: string | null
        is_deleted: boolean
        stamp: string | null
        jobcode: string | null
        deptcode: string | null
        effdate: string | null
        jobdesc: string | null
        deptname: string | null
        salary: string | null
      }[]
      products?: {
        prodcode: string
        description: string
        unit: string
        unitprice: number | string | null
        priceHistory?: { effectiveDate?: string; effdate?: string; price?: number | string; unitprice?: number | string }[]
      }[]
    }>("/catalog", "GET", undefined, signal)

    if (!Array.isArray(data.customers) || !Array.isArray(data.employees) || !Array.isArray(data.products)) {
      return null
    }

    return {
      customers: data.customers.map(toCustomer),
      employees: data.employees.map(toEmployee),
      products: data.products.map((prod) => ({
        code: prod.prodcode,
        description: prod.description,
        unit: prod.unit || "pc",
        currentPrice: roundCurrency(Number(prod.unitprice ?? 0)),
        priceHistory: (prod.priceHistory || []).map((entry) => ({
          effectiveDate: String(entry.effectiveDate || entry.effdate || ""),
          price: roundCurrency(Number(entry.price ?? entry.unitprice ?? 0)),
        })),
      })),
    }
  },

  async lookupPrice(
    prodcode: string,
    salesdate: string,
    signal?: AbortSignal,
  ): Promise<{ unitPrice: number; effectiveDate: string } | null> {
    const params = new URLSearchParams({ prodcode, salesdate })
    const data = await request<{
      unitprice?: number | string
      unitPrice?: number | string
      effdate?: string
      effectiveDate?: string
    }>(`/price-lookup?${params}`, "GET", undefined, signal)

    const rawPrice = data.unitPrice ?? data.unitprice
    if (rawPrice === undefined || rawPrice === null) {
      return null
    }
    return {
      unitPrice: roundCurrency(Number(rawPrice)),
      effectiveDate: String(data.effectiveDate || data.effdate || salesdate),
    }
  },

  async get(transno: string, signal?: AbortSignal): Promise<SaleTransaction | null> {
    const data = await request<{ sale?: ApiSaleRow; transaction?: ApiSaleRow }>(
      `/${encodeURIComponent(transno)}`,
      "GET",
      undefined,
      signal,
    )
    const row = data.sale || data.transaction
    return row ? toSaleTransaction(row) : null
  },

  async create(input: CreateSaleInput): Promise<SaleTransaction | null> {
    const data = await request<{ sale?: ApiSaleRow; transaction?: ApiSaleRow }>(
      "",
      "POST",
      input,
    )
    const row = data.sale || data.transaction
    return row ? toSaleTransaction(row) : null
  },

  async recordPayment(
    transno: string,
    input: RecordPaymentInput,
  ): Promise<SaleTransaction | null> {
    const data = await request<{ sale?: ApiSaleRow; transaction?: ApiSaleRow }>(
      `/${encodeURIComponent(transno)}/payments`,
      "POST",
      input,
    )
    const row = data.sale || data.transaction
    return row ? toSaleTransaction(row) : null
  },

  async updatePayment(
    transno: string,
    orno: string,
    input: RecordPaymentInput,
  ): Promise<SaleTransaction | null> {
    const data = await request<{ sale?: ApiSaleRow; transaction?: ApiSaleRow }>(
      `/${encodeURIComponent(transno)}/payments/${encodeURIComponent(orno)}`,
      "PUT",
      input,
    )
    const row = data.sale || data.transaction
    return row ? toSaleTransaction(row) : null
  },

  async deletePayment(
    transno: string,
    orno: string,
  ): Promise<SaleTransaction | null> {
    const data = await request<{ sale?: ApiSaleRow; transaction?: ApiSaleRow }>(
      `/${encodeURIComponent(transno)}/payments/${encodeURIComponent(orno)}`,
      "DELETE",
    )
    const row = data.sale || data.transaction
    return row ? toSaleTransaction(row) : null
  },

  async archive(transno: string): Promise<SaleTransaction | null> {
    const data = await request<{ sale?: ApiSaleRow; transaction?: ApiSaleRow }>(
      `/${encodeURIComponent(transno)}`,
      "DELETE",
    )
    const row = data.sale || data.transaction
    return row ? toSaleTransaction(row) : null
  },

  async restore(transno: string): Promise<SaleTransaction | null> {
    const data = await request<{ sale?: ApiSaleRow; transaction?: ApiSaleRow }>(
      `/${encodeURIComponent(transno)}/restore`,
      "PATCH",
    )
    const row = data.sale || data.transaction
    return row ? toSaleTransaction(row) : null
  },
}
