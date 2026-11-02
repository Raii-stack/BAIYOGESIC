import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import RecordPaymentModal from "./RecordPaymentModal"

afterEach(cleanup)

test("keeps the form open with its values when payment recording fails", async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockRejectedValue(new Error("Payment cannot exceed the remaining balance."))
  const onClose = vi.fn()
  render(<RecordPaymentModal open payment={null} balance={34.5} onClose={onClose} onSave={onSave} />)

  const dialog = within(screen.getByRole("dialog", { name: "Record Payment" }))
  await user.clear(dialog.getByRole("spinbutton"))
  await user.type(dialog.getByRole("spinbutton"), "10")
  await user.selectOptions(dialog.getByRole("combobox", { name: "Payment method" }), "Card")
  await user.click(dialog.getByRole("button", { name: "Save Payment" }))

  expect(await dialog.findByRole("alert")).toHaveTextContent("Payment cannot exceed the remaining balance.")
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amount: 10, paymentMethod: "Card" }))
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole("dialog", { name: "Record Payment" })).toBeInTheDocument()
})
