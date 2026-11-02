import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import CustomerPanel from "./CustomerPanel"

afterEach(cleanup)

test("validates required fields and the database length boundaries", async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(<CustomerPanel customer={null} open onClose={vi.fn()} onSave={onSave} />)

  const nameInput = screen.getByPlaceholderText("Enter customer or company name")
  const addressInput = screen.getByPlaceholderText("Enter the complete business address")
  const termSelect = screen.getByRole("combobox")

  await user.click(screen.getByRole("button", { name: "Create customer" }))
  expect(nameInput).toHaveAttribute("aria-invalid", "true")
  expect(nameInput).toHaveAttribute("aria-describedby", "customer-name-error")
  const nameAlert = screen.getByText("Customer Name is required.")
  expect(nameAlert).toHaveAttribute("role", "alert")
  expect(nameAlert).toHaveAttribute("id", "customer-name-error")

  expect(addressInput).toHaveAttribute("aria-invalid", "true")
  expect(addressInput).toHaveAttribute("aria-describedby", "customer-address-error")
  const addressAlert = screen.getByText("Address is required.")
  expect(addressAlert).toHaveAttribute("role", "alert")
  expect(addressAlert).toHaveAttribute("id", "customer-address-error")

  expect(termSelect).toHaveAttribute("aria-invalid", "true")
  expect(termSelect).toHaveAttribute("aria-describedby", "customer-payment-term-error")
  const termAlert = screen.getByText("Payment Term is required.")
  expect(termAlert).toHaveAttribute("role", "alert")
  expect(termAlert).toHaveAttribute("id", "customer-payment-term-error")

  fireEvent.change(nameInput, { target: { value: "a".repeat(21) } })
  fireEvent.change(addressInput, { target: { value: "a".repeat(51) } })
  await user.click(screen.getByRole("button", { name: "Create customer" }))
  expect(screen.getByText("Customer Name must be 20 characters or fewer.")).toHaveAttribute("role", "alert")
  expect(screen.getByText("Address must be 50 characters or fewer.")).toHaveAttribute("role", "alert")
  expect(onSave).not.toHaveBeenCalled()
})

test("trims valid input, closes after saving, and surfaces save failures", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSave = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(<CustomerPanel customer={null} open onClose={onClose} onSave={onSave} />)

  await user.type(screen.getByPlaceholderText("Enter customer or company name"), "  Northstar  ")
  await user.type(screen.getByPlaceholderText("Enter the complete business address"), "  1 Market Road  ")
  await user.selectOptions(screen.getByRole("combobox"), "45D")
  await user.click(screen.getByRole("button", { name: "Create customer" }))
  expect(onSave).toHaveBeenCalledWith({ custname: "Northstar", address: "1 Market Road", payterm: "45D" })
  expect(onClose).toHaveBeenCalledOnce()

  const failingSave = vi.fn().mockRejectedValue(new Error("Customer already exists."))
  rerender(<CustomerPanel customer={null} open onClose={onClose} onSave={failingSave} />)
  await user.type(screen.getByPlaceholderText("Enter customer or company name"), "Northstar")
  await user.type(screen.getByPlaceholderText("Enter the complete business address"), "1 Market Road")
  await user.selectOptions(screen.getByRole("combobox"), "30D")
  await user.click(screen.getByRole("button", { name: "Create customer" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Customer already exists.")
})

test("does not close while saving and closes on Escape when idle", async () => {
  const user = userEvent.setup()
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const onClose = vi.fn()
  const onSave = vi.fn().mockReturnValue(pending)
  render(<CustomerPanel customer={null} open onClose={onClose} onSave={onSave} />)

  const nameInput = screen.getByPlaceholderText("Enter customer or company name")
  const addressInput = screen.getByPlaceholderText("Enter the complete business address")
  const termSelect = screen.getByRole("combobox")

  await user.type(nameInput, "Customer")
  await user.type(addressInput, "Address")
  await user.selectOptions(termSelect, "COD")
  await user.click(screen.getByRole("button", { name: "Create customer" }))

  // Pending submission state
  expect(screen.getByTestId("customer-saving-spinner")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(nameInput).toBeDisabled()
  expect(addressInput).toBeDisabled()
  expect(termSelect).toBeDisabled()

  fireEvent.keyDown(window, { key: "Escape" })
  expect(onClose).not.toHaveBeenCalled()
  release()
  await screen.findByRole("button", { name: "Create customer" })
  fireEvent.keyDown(window, { key: "Escape" })
  expect(onClose).toHaveBeenCalled()
})
