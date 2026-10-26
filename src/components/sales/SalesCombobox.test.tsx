import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"
import { customers } from "../../lib/customers"
import { employees } from "../../lib/employees"
import CustomerCombobox from "./CustomerCombobox"
import EmployeeCombobox from "./EmployeeCombobox"

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
  await user.keyboard("{Escape}")
  expect(input).toHaveFocus()
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  await user.clear(input)
  await user.type(input, "no matching record")
  expect(screen.queryByRole("option")).not.toBeInTheDocument()
  expect(screen.getByText(kind === "customer" ? "No customers found." : "No employees found.")).toBeInTheDocument()
})
