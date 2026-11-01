import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import DeleteConfirmationModal from "../customers/DeleteConfirmationModal"
import ArchiveProductModal from "../inventory/ArchiveProductModal"

afterEach(cleanup)

test("customer archive confirmation supports cancel, Escape, and confirm", async () => {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(<DeleteConfirmationModal customerName="Northstar" open onCancel={onCancel} onConfirm={onConfirm} loading={false} error="" />)

  expect(screen.getByRole("alertdialog", { name: "Archive this record?" })).toBeInTheDocument()
  fireEvent.keyDown(window, { key: "Escape" })
  expect(onCancel).toHaveBeenCalledOnce()
  await user.click(screen.getByRole("button", { name: "Yes, Archive Record" }))
  expect(onConfirm).toHaveBeenCalledOnce()

  rerender(<DeleteConfirmationModal customerName="Northstar" open onCancel={onCancel} onConfirm={onConfirm} loading error="Active sales exist." />)
  expect(screen.getByRole("alert")).toHaveTextContent("Active sales exist.")
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Archiving…" })).toBeDisabled()
  fireEvent.keyDown(window, { key: "Escape" })
  expect(onCancel).toHaveBeenCalledOnce()
})

test("product archive modal stays hidden when closed and exposes loading/error states", async () => {
  const user = userEvent.setup()
  const onCancel = vi.fn()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(<ArchiveProductModal productName="Widget" open={false} onCancel={onCancel} onConfirm={onConfirm} loading={false} error="" />)
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

  rerender(<ArchiveProductModal productName="Widget" open onCancel={onCancel} onConfirm={onConfirm} loading={false} error="" />)
  await user.click(screen.getByRole("button", { name: "Archive product" }))
  expect(onConfirm).toHaveBeenCalledOnce()

  rerender(<ArchiveProductModal productName="Widget" open onCancel={onCancel} onConfirm={onConfirm} loading error="Cannot archive product." />)
  expect(screen.getByRole("alert")).toHaveTextContent("Cannot archive product.")
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Archiving…" })).toBeDisabled()
  fireEvent.keyDown(window, { key: "Escape" })
  expect(onCancel).not.toHaveBeenCalled()
})
