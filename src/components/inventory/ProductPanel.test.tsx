import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import ProductPanel from "./ProductPanel"

afterEach(cleanup)

test("rejects blank, zero, over-precise, and over-range prices", async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(<ProductPanel product={null} open onClose={vi.fn()} onSave={onSave} />)

  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(screen.getByText("Product Description is required.")).toBeInTheDocument()
  expect(screen.getByText("Unit Type is required.")).toBeInTheDocument()
  expect(screen.getByText("Enter a price above zero with up to two decimal places.")).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText("Enter product description"), "Widget")
  await user.selectOptions(screen.getByRole("combobox"), "pc")
  const price = screen.getByPlaceholderText("0.00")
  await user.type(price, "0")
  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(screen.getByText("Enter a price above zero with up to two decimal places.")).toBeInTheDocument()

  await user.clear(price)
  await user.type(price, "12.345")
  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(screen.getByText("Enter a price above zero with up to two decimal places.")).toBeInTheDocument()

  await user.clear(price)
  await user.type(price, "100000000")
  await user.click(screen.getByRole("button", { name: "Create product" }))
  expect(screen.getByText("Enter a price above zero with up to two decimal places.")).toBeInTheDocument()
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
