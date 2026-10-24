export type ReportName = "Top Customers" | "Product Master List" | "Top Products" | "Active Employees" | "All Employees" | "Employee Job History" | "Top Sales"

type ReportTableConfig = {
  columns: {
    key: string
    label: string
    align?: "left" | "right"
  }[]
  rows: Record<string, string | number>[]
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const reportTables: Record<ReportName, ReportTableConfig> = {
  "Top Customers": {
    columns: [
      { key: "rank", label: "Rank" },
      { key: "customerNo", label: "Cust No" },
      { key: "customerName", label: "Customer Name" },
      { key: "totalSales", label: "Total Sales", align: "right" },
    ],
    rows: [
      {
        rank: 1,
        customerNo: "C-001",
        customerName: "Acme Corporation",
        totalSales: currency.format(48250),
      },
      {
        rank: 2,
        customerNo: "C-002",
        customerName: "Northstar Office Group",
        totalSales: currency.format(37680),
      },
      {
        rank: 3,
        customerNo: "C-003",
        customerName: "Cedar Ridge Manufacturing",
        totalSales: currency.format(29410),
      },
      {
        rank: 4,
        customerNo: "C-004",
        customerName: "Harborview Retail",
        totalSales: currency.format(24195),
      },
      {
        rank: 5,
        customerNo: "C-005",
        customerName: "Summit Field Services",
        totalSales: currency.format(18840),
      },
    ],
  },
  "Product Master List": {
    columns: [
      { key: "productCode", label: "Prod Code" },
      { key: "description", label: "Description" },
      { key: "unit", label: "Unit" },
      { key: "currentPrice", label: "Current Price", align: "right" },
    ],
    rows: [
      {
        productCode: "P-001",
        description: "Industrial Widget A",
        unit: "pc",
        currentPrice: currency.format(13.75),
      },
      {
        productCode: "P-002",
        description: "Service Component B",
        unit: "ea",
        currentPrice: currency.format(19.4),
      },
      {
        productCode: "P-003",
        description: "Warehouse Supply Pack",
        unit: "pkg",
        currentPrice: currency.format(48.6),
      },
      {
        productCode: "P-004",
        description: "Packaging Liner Material",
        unit: "mtr",
        currentPrice: currency.format(6.15),
      },
      {
        productCode: "P-005",
        description: "Industrial Cleaning Solution",
        unit: "ltr",
        currentPrice: currency.format(8.75),
      },
    ],
  },
  "Top Products": {
    columns: [
      { key: "rank", label: "Rank" },
      { key: "productCode", label: "Prod Code" },
      { key: "description", label: "Description" },
      { key: "quantity", label: "Qty Sold", align: "right" },
      { key: "sales", label: "Total Sales", align: "right" },
    ],
    rows: [
      {
        rank: 1,
        productCode: "P-001",
        description: "Industrial Widget A",
        quantity: 425,
        sales: currency.format(5843.75),
      },
      {
        rank: 2,
        productCode: "P-003",
        description: "Warehouse Supply Pack",
        quantity: 98,
        sales: currency.format(4762.8),
      },
      {
        rank: 3,
        productCode: "P-002",
        description: "Service Component B",
        quantity: 210,
        sales: currency.format(4074),
      },
    ],
  },
  "Active Employees": {
    columns: [
      { key: "employeeId", label: "Employee ID" },
      { key: "name", label: "Full Name" },
      { key: "department", label: "Department" },
      { key: "jobTitle", label: "Job Title" },
      { key: "hireDate", label: "Hire Date" },
    ],
    rows: [
      {
        employeeId: "E-001",
        name: "Maria Santos",
        department: "Sales",
        jobTitle: "Account Executive",
        hireDate: "2022-04-18",
      },
      {
        employeeId: "E-002",
        name: "Juan Reyes",
        department: "Operations",
        jobTitle: "Operations Manager",
        hireDate: "2021-03-15",
      },
      {
        employeeId: "E-003",
        name: "Employee Record 03",
        department: "Human Resources",
        jobTitle: "HR Specialist",
        hireDate: "2020-09-08",
      },
    ],
  },
  "All Employees": {
    columns: [
      { key: "employeeId", label: "Employee ID" },
      { key: "name", label: "Full Name" },
      { key: "department", label: "Department" },
      { key: "jobTitle", label: "Job Title" },
      { key: "status", label: "Status" },
    ],
    rows: [
      {
        employeeId: "E-001",
        name: "Maria Santos",
        department: "Sales",
        jobTitle: "Account Executive",
        status: "Active",
      },
      {
        employeeId: "E-002",
        name: "Juan Reyes",
        department: "Operations",
        jobTitle: "Operations Manager",
        status: "Active",
      },
      {
        employeeId: "E-005",
        name: "Employee Record 05",
        department: "Inventory",
        jobTitle: "Inventory Coordinator",
        status: "Separated",
      },
    ],
  },
  "Employee Job History": {
    columns: [
      { key: "effectiveDate", label: "Effective Date" },
      { key: "jobTitle", label: "Job Title" },
      { key: "department", label: "Department" },
      { key: "salary", label: "Salary", align: "right" },
    ],
    rows: [
      {
        effectiveDate: "2024-04-01",
        jobTitle: "Operations Manager",
        department: "Operations",
        salary: currency.format(76000),
      },
      {
        effectiveDate: "2022-06-15",
        jobTitle: "Senior Operations Coordinator",
        department: "Operations",
        salary: currency.format(65000),
      },
      {
        effectiveDate: "2021-03-15",
        jobTitle: "Operations Coordinator",
        department: "Operations",
        salary: currency.format(54000),
      },
    ],
  },
  "Top Sales": {
    columns: [
      { key: "rank", label: "Rank" },
      { key: "transactionNo", label: "Trans No" },
      { key: "salesDate", label: "Sales Date" },
      { key: "customer", label: "Customer" },
      { key: "total", label: "Total", align: "right" },
    ],
    rows: [
      {
        rank: 1,
        transactionNo: "T-001",
        salesDate: "2026-10-01",
        customer: "Acme Corporation",
        total: currency.format(234.5),
      },
      {
        rank: 2,
        transactionNo: "T-004",
        salesDate: "2026-10-05",
        customer: "Harborview Retail",
        total: currency.format(219.2),
      },
      {
        rank: 3,
        transactionNo: "T-002",
        salesDate: "2026-10-02",
        customer: "Northstar Office Group",
        total: currency.format(194.4),
      },
    ],
  },
}

export default function ReportTable({
  report,
  limit,
}: {
  report: ReportName
  limit?: number
}) {
  const table = reportTables[report]
  const rows = limit ? table.rows.slice(0, limit) : table.rows

  return (
    <section
      aria-label={`${report} report results`}
      className="workspace-panel"
    >
      <div className="workspace-table-header"><h2>{report}</h2><span className="workspace-badge workspace-badge--neutral">{rows.length} results</span></div>
      <div className="overflow-x-auto">
        <table className="workspace-table min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-300 bg-slate-100">
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={` ${
                    column.align === "right" ? "text-right" : ""
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${report}-${index}`}
              >
                {table.columns.map((column) => (
                  <td
                    key={column.key}
                    className={`text-sm text-slate-700 ${
                      column.align === "right"
                        ? "text-right font-bold tabular-nums text-neutral-900"
                        : ""
                    } ${
                      [
                        "rank",
                        "customerNo",
                        "productCode",
                        "employeeId",
                      ].includes(column.key)
                        ? "font-mono text-xs font-semibold"
                        : ""
                    }`}
                  >
                    {column.key === "unit"
                      ? <span className="workspace-badge workspace-badge--neutral" data-unit={row[column.key]}>{row[column.key]}</span>
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
