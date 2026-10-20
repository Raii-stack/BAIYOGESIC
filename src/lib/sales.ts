import type { SaleTransaction } from "../types/sale"

export const salesTransactions: SaleTransaction[] = [
  {
    transactionNo: "T-001",
    salesDate: "2026-10-01",
    customerCode: "C-001",
    customerName: "Acme Corporation",
    employeeCode: "E-002",
    employeeName: "Juan Reyes",
    status: "Active",
    stamp: "CREATED system 2026-10-01 10:00 AM",
    lines: [
      {
        id: "SD-001",
        productCode: "P-001",
        productName: "Industrial Widget A",
        quantity: 10,
        unitPrice: 13.75,
        status: "Active",
        stamp: "CREATED system 2026-10-01 10:02 AM",
      },
      {
        id: "SD-002",
        productCode: "P-002",
        productName: "Service Component B",
        quantity: 5,
        unitPrice: 19.4,
        status: "Active",
        stamp: "CREATED system 2026-10-01 10:04 AM",
      },
    ],
    payments: [
      {
        id: "PAY-001",
        orNo: "OR-10001",
        date: "2026-10-01",
        amount: 150,
        stamp: "CREATED system 2026-10-01 9:00 AM",
      },
      {
        id: "PAY-002",
        orNo: "OR-10008",
        date: "2026-10-03",
        amount: 50,
        stamp: "EDITED user1 2026-10-13 1:01 PM",
      },
    ],
  },
  {
    transactionNo: "T-002",
    salesDate: "2026-10-02",
    customerCode: "C-002",
    customerName: "Northstar Office Group",
    employeeCode: "E-004",
    employeeName: "Employee Record 04",
    status: "Active",
    stamp: "EDITED user1 2026-10-02 3:18 PM",
    lines: [
      {
        id: "SD-003",
        productCode: "P-003",
        productName: "Warehouse Supply Pack",
        quantity: 4,
        unitPrice: 48.6,
        status: "Active",
        stamp: "CREATED system 2026-10-02 3:14 PM",
      },
    ],
    payments: [
      {
        id: "PAY-003",
        orNo: "OR-10012",
        date: "2026-10-02",
        amount: 100,
        stamp: "CREATED system 2026-10-02 10:15 AM",
      },
    ],
  },
  {
    transactionNo: "T-003",
    salesDate: "2026-10-03",
    customerCode: "C-003",
    customerName: "Cedar Ridge Manufacturing",
    employeeCode: "E-002",
    employeeName: "Juan Reyes",
    status: "Inactive",
    stamp: "DELETED user2 2026-10-04 9:22 AM",
    lines: [
      {
        id: "SD-004",
        productCode: "P-004",
        productName: "Packaging Liner Material",
        quantity: 12,
        unitPrice: 6.15,
        status: "Inactive",
        stamp: "DELETED user2 2026-10-04 9:22 AM",
      },
    ],
    payments: [],
  },
  {
    transactionNo: "T-004",
    salesDate: "2026-10-05",
    customerCode: "C-004",
    customerName: "Harborview Retail",
    employeeCode: "E-009",
    employeeName: "Employee Record 09",
    status: "Active",
    stamp: "CREATED system 2026-10-05 11:40 AM",
    lines: [
      {
        id: "SD-005",
        productCode: "P-005",
        productName: "Shipping Carton Bundle",
        quantity: 8,
        unitPrice: 27.4,
        status: "Active",
        stamp: "CREATED system 2026-10-05 11:40 AM",
      },
    ],
    payments: [
      {
        id: "PAY-004",
        orNo: "OR-10021",
        date: "2026-10-06",
        amount: 120,
        stamp: "CREATED system 2026-10-06 11:45 AM",
      },
    ],
  },
  {
    transactionNo: "T-005",
    salesDate: "2026-10-06",
    customerCode: "C-005",
    customerName: "Summit Field Services",
    employeeCode: "E-004",
    employeeName: "Employee Record 04",
    status: "Inactive",
    stamp: "DELETED user2 2026-10-08 4:05 PM",
    lines: [
      {
        id: "SD-006",
        productCode: "P-006",
        productName: "Protective Equipment Unit",
        quantity: 3,
        unitPrice: 34,
        status: "Inactive",
        stamp: "DELETED user2 2026-10-08 4:05 PM",
      },
    ],
    payments: [],
  },
]

export const getSaleTotal = (sale: SaleTransaction) =>
  sale.lines
    .filter((line) => line.status === "Active")
    .reduce((total, line) => total + line.quantity * line.unitPrice, 0)

export const getPaymentsTotal = (sale: SaleTransaction) =>
  sale.payments.reduce((total, payment) => total + payment.amount, 0)

export const getSaleBalance = (sale: SaleTransaction) =>
  Math.max(0, getSaleTotal(sale) - getPaymentsTotal(sale))
