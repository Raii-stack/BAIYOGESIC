import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import AddJobHistoryModal from "./AddJobHistoryModal"
import ArchiveEmployeeModal from "./ArchiveEmployeeModal"

afterEach(cleanup)

test("AddJobHistoryModal rejects whitespace-only fields and saves trimmed values", async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<AddJobHistoryModal open onClose={onClose} onSave={onSave} />)

  const date = document.querySelector('input[type="date"]') as HTMLInputElement
  const salary = screen.getByRole("spinbutton")
  const textboxes = screen.getAllByRole("textbox")
  await user.type(date, "2026-10-01")
  await user.type(salary, "0")
  await user.type(textboxes[0], "   ")
  await user.type(textboxes[1], "IT")
  await user.click(screen.getByRole("button", { name: "Save Job History" }))
  expect(onSave).not.toHaveBeenCalled()

  await user.clear(textboxes[0])
  await user.type(textboxes[0], "  Developer  ")
  await user.clear(textboxes[1])
  await user.type(textboxes[1], "  Information Technology  ")
  await user.click(screen.getByRole("button", { name: "Save Job History" }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    effectiveDate: "2026-10-01",
    salary: 0,
    jobTitle: "Developer",
    department: "Information Technology",
  }))
  expect(onClose).toHaveBeenCalledOnce()
})

test("AddJobHistoryModal closes through Escape and the explicit close controls", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<AddJobHistoryModal open onClose={onClose} onSave={vi.fn()} />)
  fireEvent.keyDown(window, { key: "Escape" })
  expect(onClose).toHaveBeenCalledOnce()
  await user.click(screen.getAllByRole("button", { name: "Close job history form" })[0])
  expect(onClose).toHaveBeenCalledTimes(2)
})

test("ArchiveEmployeeModal sends the selected separation date and blocks dismissal while loading", async () => {
  const user = userEvent.setup()
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const onConfirm = vi.fn().mockReturnValue(pending)
  const onCancel = vi.fn()
  render(<ArchiveEmployeeModal employeeName="Ana User" open onCancel={onCancel} onConfirm={onConfirm} loading={false} error="" />)

  await user.clear(screen.getByLabelText("Separation date"))
  await user.type(screen.getByLabelText("Separation date"), "2026-10-31")
  await user.click(screen.getByRole("button", { name: "Archive employee" }))
  expect(onConfirm).toHaveBeenCalledWith("2026-10-31")

  fireEvent.keyDown(window, { key: "Escape" })
  expect(onCancel).toHaveBeenCalled()
  release()
})

test("ArchiveEmployeeModal exposes errors and disables destructive actions while loading", () => {
  render(<ArchiveEmployeeModal employeeName="Ana User" open onCancel={vi.fn()} onConfirm={vi.fn()} loading error="Active sales exist." />)
  expect(screen.getByRole("alert")).toHaveTextContent("Active sales exist.")
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Archiving…" })).toBeDisabled()
})
