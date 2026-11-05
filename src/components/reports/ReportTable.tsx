import type { ReportName, ReportRow } from "../../lib/reports-api"
import TableSkeleton from "../common/TableSkeleton"

export type { ReportName } from "../../lib/reports-api"

type Column = { key: string; label: string; align?: "left" | "right"; format?: "currency" | "date" }

const columns: Record<ReportName, Column[]> = {
  "Top Customers": [
    { key: "rank", label: "Rank" },
    { key: "custno", label: "Cust No" },
    { key: "custname", label: "Customer Name" },
    { key: "totalsales", label: "Total Sales", align: "right", format: "currency" },
  ],
  "Product Master List": [
    { key: "prodcode", label: "Product Code" },
    { key: "description", label: "Description" },
    { key: "unit", label: "Unit" },
    { key: "currentprice", label: "Current Price", align: "right", format: "currency" },
  ],
  "Top Products": [
    { key: "rank", label: "Rank" },
    { key: "prodcode", label: "Product Code" },
    { key: "description", label: "Description" },
    { key: "qtysold", label: "Quantity Sold", align: "right" },
    { key: "salesamount", label: "Sales Amount", align: "right", format: "currency" },
  ],
  "Active Employees": [
    { key: "empno", label: "Employee No" },
    { key: "lastname", label: "Last Name" },
    { key: "firstname", label: "First Name" },
    { key: "gender", label: "Gender" },
    { key: "birthdate", label: "Birth Date", format: "date" },
    { key: "hiredate", label: "Hire Date", format: "date" },
  ],
  "All Employees": [
    { key: "empno", label: "Employee No" },
    { key: "lastname", label: "Last Name" },
    { key: "firstname", label: "First Name" },
    { key: "gender", label: "Gender" },
    { key: "birthdate", label: "Birth Date", format: "date" },
    { key: "hiredate", label: "Hire Date", format: "date" },
    { key: "sepdate", label: "Separation Date", format: "date" },
    { key: "status", label: "Status" },
  ],
  "Employee Job History": [
    { key: "effdate", label: "Effective Date", format: "date" },
    { key: "jobdesc", label: "Job" },
    { key: "deptname", label: "Department" },
    { key: "salary", label: "Salary", align: "right", format: "currency" },
  ],
  "Top Sales": [
    { key: "rank", label: "Rank" },
    { key: "transno", label: "Transaction No" },
    { key: "salesdate", label: "Sales Date", format: "date" },
    { key: "custname", label: "Customer" },
    { key: "employeename", label: "Employee" },
    { key: "total", label: "Total", align: "right", format: "currency" },
  ],
}

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })
const date = new Intl.DateTimeFormat("en-PH")

function displayValue(value: ReportRow[string] | undefined, format?: Column["format"]) {
  if (value == null || value === "") return "—"
  if (format === "currency") return Number.isFinite(Number(value)) ? currency.format(Number(value)) : "—"
  if (format === "date") {
    const rawDate = String(value)
    const parsedDate = new Date(rawDate.includes("T") ? rawDate : `${rawDate}T00:00:00`)
    return Number.isNaN(parsedDate.getTime()) ? rawDate : date.format(parsedDate)
  }
  return String(value)
}

export default function ReportTable({ report, rows, loading, error, onRetry }: {
  report: ReportName
  rows: ReportRow[]
  loading: boolean
  error: string
  onRetry: () => void
}) {
  const reportColumns = columns[report]

  return (
    <section className="workspace-panel" aria-labelledby="report-table-heading">
      <div className="workspace-table-header">
        <h2 id="report-table-heading">{report}</h2>
        <span className="workspace-badge workspace-badge--neutral">{loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "record" : "records"}`}</span>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <TableSkeleton headings={reportColumns.map((column) => column.label)} label={`${report} loading`} />
        ) : error ? (
          <div className="workspace-empty-state" role="alert">
            <p>Unable to load this report</p>
            <p>{error}</p>
            <button type="button" className="workspace-secondary-action mt-4" onClick={onRetry}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="workspace-empty-state" role="status">
            <p>No report records found</p>
            <p>Adjust the report filters or select another report.</p>
          </div>
        ) : (
          <table className="workspace-table">
            <thead><tr>{reportColumns.map((column) => <th key={column.key} scope="col" className={column.align === "right" ? "text-right" : undefined}>{column.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={String(row.transno || row.prodcode || row.empno || row.effdate || row.custno || rowIndex)}>
                  {reportColumns.map((column) => (
                    <td key={column.key} data-label={column.label} className={column.align === "right" ? "text-right tabular-nums" : undefined}>
                      {displayValue(row[column.key], column.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
