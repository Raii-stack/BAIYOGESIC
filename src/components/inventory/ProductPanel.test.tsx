import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import ProductPanel from "./ProductPanel"

afterEach(cleanup)

test("rejects blank, zero, over-precise, and over-range prices", async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(<ProductPanel product={null} open onClose={vi.fn()} onSave={onSave} />)

  const descInput = screen.getByPlaceholderText("Enter product description")
  const unitSelect = screen.getByRole("combobox")
  const priceInput = screen.getByPlaceholderText("0.00")

  await user.click(screen.getByRole("button", { name: "Create product" }))

  expect(descInput).toHaveAttribute("aria-invalid", "true")
  expect(descInput).toHaveAttribute("aria-describedby", "product-description-error")
  const descAlert = screen.getByText("Product Description is required.")
  expect(descAlert).toHaveAttribute("role", "alert")
  expect(descAlert).toHaveAttribute("id", "product-description-error")

  expect(unitSelect).toHaveAttribute("aria-invalid", "true")
  expect(unitSelect).toHaveAttribute("aria-describedby", "product-unit-error")
  const unitAlert = screen.getByText("Unit Type is required.")
  expect(unitAlert).toHaveAttribute("role", "alert")
  expect(unitAlert).toHaveAttribute("id", "product-unit-error")

  expect(priceInput).toHaveAttribute("aria-invalid", "true")
  expect(priceInput).toHaveAttribute("aria-describedby", "product-price-error")
  const priceAlert = screen.getByText("Enter a price above zero with up to two decimal places.")
  expect(priceAlert).toHaveAttribute("role", "alert")
  expect(priceAlert).toHaveAttribute("id", "product-price-error")

  await user.type(descInput, "Widget")
  await user.selectOptions(unitSelect, "pc")
  await user.type(priceInput, "0")
  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(screen.getByText("Enter a price above zero with up to two decimal places.")).toHaveAttribute("role", "alert")

  await user.clear(priceInput)
  await user.type(priceInput, "12.345")
  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(screen.getByText("Enter a price above zero with up to two decimal places.")).toHaveAttribute("role", "alert")

  await user.clear(priceInput)
  await user.type(priceInput, "100000000")
  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(screen.getByText("Enter a price above zero with up to two decimal places.")).toHaveAttribute("role", "alert")
  expect(onSave).not.toHaveBeenCalled()
})

test("normalizes a valid product, initializes edit values, and keeps save failures visible", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  const onSave = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(<ProductPanel product={null} open onClose={onClose} onSave={onSave} />)

  await user.type(screen.getByPlaceholderText("Enter product description"), "  Widget  ")
  await user.selectOptions(screen.getByRole("combobox"), "ea")
  await user.type(screen.getByPlaceholderText("0.00"), "12.50")
  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(onSave).toHaveBeenCalledWith({ description: "Widget", unit: "ea", unitprice: 12.5 })
  expect(onClose).toHaveBeenCalledOnce()

  const product = { code: "PX0001", description: "Existing", unitType: "pc" as const, currentPrice: 19.5, priceEffectiveDate: "2026-10-01", status: "Active" as const, stamp: "ADD system" }
  rerender(<ProductPanel product={product} open onClose={onClose} onSave={vi.fn().mockRejectedValue(new Error("Price conflict."))} />)
  expect(screen.getByDisplayValue("Existing")).toBeInTheDocument()
  expect(screen.getByDisplayValue("19.5")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Save changes" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Price conflict.")
})

test("disables inputs and displays spinner during pending submission", async () => {
  const user = userEvent.setup()
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const onClose = vi.fn()
  const onSave = vi.fn().mockReturnValue(pending)
  render(<ProductPanel product={null} open onClose={onClose} onSave={onSave} />)

  const descInput = screen.getByPlaceholderText("Enter product description")
  const unitSelect = screen.getByRole("combobox")
  const priceInput = screen.getByPlaceholderText("0.00")

  await user.type(descInput, "Widget")
  await user.selectOptions(unitSelect, "pc")
  await user.type(priceInput, "25.00")
  await user.click(screen.getByRole("button", { name: "Create product" }))

  expect(screen.getByTestId("product-saving-spinner")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /Saving/ })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(descInput).toBeDisabled()
  expect(unitSelect).toBeDisabled()
  expect(priceInput).toBeDisabled()

  release()
  await screen.findByRole("button", { name: "Create product" })
  expect(onClose).toHaveBeenCalled()
})
