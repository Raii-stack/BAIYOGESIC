import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"
import { customers } from "../../lib/customers"
import { employees } from "../../lib/employees"
import CustomerCombobox from "./CustomerCombobox"
import EmployeeCombobox from "./EmployeeCombobox"
import ProductCombobox from "./ProductCombobox"

afterEach(cleanup)

test.each(["customer", "employee"])("%s picker supports keyboard selection and Escape", async (kind) => {
  const user = userEvent.setup()
  const select = vi.fn()
  render(kind === "customer"
    ? <CustomerCombobox customers={customers.slice(0, 1)} selectedCustomerId="" onSelect={select} />
    : <EmployeeCombobox employees={employees.slice(0, 1)} selectedEmployeeId="" onSelect={select} />)
  const input = screen.getByRole("combobox")
  await user.click(input)
  await user.keyboard("{ArrowDown}")
  expect(screen.getByRole("option")).toHaveFocus()
  await user.keyboard("{Enter}")
  expect(select).toHaveBeenLastCalledWith(kind === "customer" ? customers[0].id : employees[0].id)
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  await user.click(input)
  await user.keyboard("{Tab}")
  expect(screen.getByRole("option")).toHaveFocus()
  // Cancel the search input's native Escape action so it cannot clear the selection and reopen the menu.
  expect(fireEvent.keyDown(screen.getByRole("option"), { key: "Escape" })).toBe(false)
  expect(input).toHaveFocus()
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  const selectedLabel = kind === "customer" ? customers[0].company : employees[0].fullName
  expect(input).toHaveValue(selectedLabel)
  await user.click(input)
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false)
  expect(input).toHaveValue(selectedLabel)
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  await user.clear(input)
  await user.type(input, "no matching record")
  expect(screen.queryByRole("option")).not.toBeInTheDocument()
  expect(screen.getByText(kind === "customer" ? "No customers found." : "No employees found.")).toBeInTheDocument()
})

test("product picker supports search, keyboard selection, disabled added codes, and quick-add mode", async () => {
  const user = userEvent.setup()
  const onSelect = vi.fn()
  const products = [
    {
      code: "P-001",
      description: "Industrial Widget A",
      unit: "pc",
      currentPrice: 13.75,
      priceHistory: [{ effectiveDate: "2026-10-01", price: 13.75 }],
    },
    {
      code: "P-002",
      description: "Service Component B",
      unit: "ea",
      currentPrice: 19.4,
      priceHistory: [{ effectiveDate: "2026-10-01", price: 19.4 }],
    },
  ]

  const { unmount } = render(
    <ProductCombobox
      ariaLabel="Product 1"
      products={products}
      selectedProductCode=""
      salesDate="2026-11-01"
      disabledCodes={new Set(["P-001"])}
      onSelect={onSelect}
    />,
  )

  const rowInput = screen.getByRole("combobox", { name: "Product 1" })
  await user.click(rowInput)
  const disabledOption = screen.getByRole("option", { name: /P-001 — Industrial Widget A/i })
  expect(disabledOption).toBeDisabled()
  expect(disabledOption).toHaveTextContent("Added")

  await user.type(rowInput, "Service")
  expect(screen.queryByRole("option", { name: /P-001/i })).not.toBeInTheDocument()
  await user.keyboard("{ArrowDown}")
  const matchedOption = screen.getByRole("option", { name: /P-002 — Service Component B/i })
  expect(matchedOption).toHaveFocus()
  await user.keyboard("{Enter}")
  expect(onSelect).toHaveBeenLastCalledWith("P-002")
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

  await user.click(rowInput)
  expect(fireEvent.keyDown(rowInput, { key: "Escape" })).toBe(false)
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

  unmount()
  render(
    <ProductCombobox
      label="Search and add product"
      products={products}
      selectedProductCode=""
      salesDate="2026-11-01"
      inListCodes={new Set(["P-001"])}
      clearOnSelect
      onSelect={onSelect}
    />,
  )

  const quickInput = screen.getByRole("combobox", { name: /Search and add product/i })
  await user.type(quickInput, "Widget")
  expect(screen.getByRole("option", { name: /P-001 — Industrial Widget A/i })).toHaveTextContent("In list · +1")
  await user.keyboard("{Enter}")
  expect(onSelect).toHaveBeenLastCalledWith("P-001")
  expect(quickInput).toHaveValue("")
})
