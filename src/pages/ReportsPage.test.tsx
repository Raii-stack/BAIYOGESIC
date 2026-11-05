import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { AuthProvider } from "../components/auth/AuthProvider"
import ReportsPage from "./ReportsPage"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function Location() { return <output aria-label="URL">{useLocation().search}</output> }

function renderReports(query: string, rights?: string[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("/api/auth/session")) {
      return new Response(JSON.stringify({ success: true, data: { user: {
        userId: "1", email: "preview@hope.inc", role: rights ? "employee" : "superadmin",
        status: "active", mustChangePassword: false, rights,
      } } }), { headers: { "Content-Type": "application/json" } })
    }

    let data: Record<string, unknown> = { report: "report", rows: [] }
    if (url.includes("/product-master")) data = { report: "product-master", rows: [{ prodcode: "P001", description: "Desk", unit: "pc", currentprice: "1250.00" }] }
    if (url.includes("/top-sales")) data = { report: "top-sales", rows: [{ rank: 1, transno: "TR001", salesdate: "2026-10-01", custname: "Acme", employeename: "Ana Cruz", total: "2500" }] }
    if (url.includes("/top-customers")) data = { report: "top-customers", rows: [{ rank: 1, custno: "C001", custname: "Acme", totalsales: "2500" }] }
    if (url.includes("/job-history")) data = url.includes("empno=00001")
      ? { report: "job-history", rows: [{ effdate: "2026-01-01", jobdesc: "Manager", deptname: "Sales", salary: "50000" }], employees: [{ empno: "00001", fullname: "Ana Cruz" }] }
      : { report: "job-history", rows: [], employees: [{ empno: "00001", fullname: "Ana Cruz" }] }
    return new Response(JSON.stringify({ success: true, data }), { headers: { "Content-Type": "application/json" } })
  })
  vi.stubGlobal("fetch", fetchMock)
  render(<MemoryRouter initialEntries={["/reports?view=reports&" + query]}><AuthProvider><ReportsPage /><Location /></AuthProvider></MemoryRouter>)
  return fetchMock
}

test("report tabs load live data, update the URL, and expose one print action", async () => {
  const user = userEvent.setup()
  const print = vi.spyOn(window, "print").mockImplementation(() => {})
  renderReports("report=Top+Sales&custom=keep")
  expect(await screen.findByText("TR001", {}, { timeout: 5000 })).toBeInTheDocument()
  await user.click(screen.getByRole("tab", { name: "Product Master List" }))
  expect(screen.getByLabelText("URL")).toHaveTextContent("report=Product+Master+List&custom=keep")
  expect(await screen.findByText("Desk", {}, { timeout: 5000 })).toBeInTheDocument()
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Print / save PDF" }))
  expect(print).toHaveBeenCalledOnce()
  print.mockRestore()
})

test("unauthorized report queries fall back safely and result limits stay valid", async () => {
  renderReports("report=All+Employees", ["reports.access", "reports.top-sales"])
  expect(await screen.findByRole("tab", { name: "Top Sales" })).toHaveAttribute("aria-selected", "true")
  expect(screen.queryByRole("tab", { name: "All Employees" })).not.toBeInTheDocument()
  const limit = screen.getByRole("spinbutton", { name: "Number of results" })
  fireEvent.change(limit, { target: { value: "-5" } })
  expect(limit).toHaveValue(1)
  fireEvent.change(limit, { target: { value: "500" } })
  expect(limit).toHaveValue(100)
})

test("report tabs support arrow keys, Home, and End without a dropdown", async () => {
  const user = userEvent.setup()
  renderReports("report=Top+Sales")
  const sales = await screen.findByRole("tab", { name: "Top Sales" })
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  await user.click(sales)
  await user.keyboard("{ArrowRight}")
  const customers = screen.getByRole("tab", { name: "Top Customers" })
  expect(customers).toHaveFocus()
  expect(customers).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Top Customers")
  await user.keyboard("{End}")
  expect(sales).toHaveFocus()
  await user.keyboard("{ArrowLeft}")
  expect(screen.getByRole("tab", { name: "Employee Job History" })).toHaveFocus()
  await user.keyboard("{Home}")
  expect(customers).toHaveFocus()
  expect(screen.getByLabelText("URL")).toHaveTextContent("report=Top+Customers")
})

test("date range and Top N filters are sent to top report endpoints", async () => {
  const fetchMock = renderReports("report=Top+Customers")
  expect(await screen.findByText("C001", {}, { timeout: 5000 })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } })
  fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-31" } })
  fireEvent.change(screen.getByLabelText("Number of results"), { target: { value: "25" } })
  await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
    const url = String(input)
    return url.includes("/api/reports/top-customers")
      && url.includes("startDate=2026-01-01")
      && url.includes("endDate=2026-10-31")
      && url.includes("limit=25")
  })).toBe(true), { timeout: 5000 })
})

test("employee job history loads employee options and the selected history", async () => {
  const fetchMock = renderReports("report=Employee+Job+History")
  const employee = await screen.findByRole("combobox", { name: "Employee" }, { timeout: 5000 })
  await waitFor(() => expect(employee).toHaveValue("00001"), { timeout: 5000 })
  expect(await screen.findByText("Manager", {}, { timeout: 5000 })).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/job-history?empno=00001"))).toBe(true)
})

test("a late report response cannot replace the newly selected report", async () => {
  let finishOldReport!: () => void
  const oldReport = new Promise<void>((resolve) => { finishOldReport = resolve })
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    let data: Record<string, unknown>
    if (url.includes("/auth/session")) data = { user: { userId: "1", email: "admin@hope.inc", role: "superadmin", status: "active", mustChangePassword: false } }
    else if (url.includes("/top-customers")) {
      await oldReport
      data = { rows: [{ custno: "OLD", custname: "Outdated report", totalsales: "500" }] }
    } else data = { rows: [{ prodcode: "P001", description: "Current report", unit: "pc", currentprice: "25" }] }
    return new Response(JSON.stringify({ success: true, data }), { headers: { "Content-Type": "application/json" } })
  }))
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={["/reports?report=Top+Customers"]}><AuthProvider><ReportsPage /></AuthProvider></MemoryRouter>)
  await user.click(await screen.findByRole("tab", { name: "Product Master List" }))
  await screen.findByText("Current report")
  await act(async () => { finishOldReport(); await oldReport })
  expect(screen.queryByText("Outdated report")).not.toBeInTheDocument()
  expect(screen.getByText("Current report")).toBeInTheDocument()
})
