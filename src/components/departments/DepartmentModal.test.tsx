import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"
import DepartmentModal from "./DepartmentModal"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("validates required fields, code length, and prevents duplicate codes", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  const user = userEvent.setup()

  render(
    <DepartmentModal
      open={true}
      existingCodes={["ENG", "SAL"]}
      onClose={onClose}
      onSave={onSave}
    />,
  )

  expect(screen.getByRole("dialog", { name: "Add Department" })).toBeInTheDocument()

  // Attempt empty submit
  await user.click(screen.getByRole("button", { name: "Create department" }))
  expect(await screen.findByText("Department code is required.")).toBeInTheDocument()
  expect(screen.getByText("Department name is required.")).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()

  // Duplicate code
  await user.type(screen.getByLabelText(/Department Code/), "ENG")
  await user.type(screen.getByLabelText(/Department Name/), "Engineering Duplicate")
  await user.click(screen.getByRole("button", { name: "Create department" }))
  expect(await screen.findByText("A department with this code already exists.")).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()

  // Valid submit
  await user.clear(screen.getByLabelText(/Department Code/))
  await user.type(screen.getByLabelText(/Department Code/), "ops")
  await user.click(screen.getByRole("button", { name: "Create department" }))

  expect(onSave).toHaveBeenCalledWith({
    deptcode: "OPS",
    deptname: "Engineering Duplicate",
  })
  expect(onClose).toHaveBeenCalled()
})

test("displays edit mode, disables code input, and displays server errors", async () => {
  const onSave = vi.fn().mockRejectedValue(new Error("Server error occurred"))
  const onClose = vi.fn()
  const user = userEvent.setup()

  render(
    <DepartmentModal
      open={true}
      department={{
        code: "FIN",
        name: "Finance",
        employeeCount: 4,
        archived: false,
        stamp: "ADD admin",
      }}
      onClose={onClose}
      onSave={onSave}
    />,
  )

  expect(screen.getByRole("dialog", { name: "Edit Department" })).toBeInTheDocument()
  expect(screen.getByLabelText(/Department Code/)).toBeDisabled()

  await user.clear(screen.getByLabelText(/Department Name/))
  await user.type(screen.getByLabelText(/Department Name/), "Finance & Payroll")
  await user.click(screen.getByRole("button", { name: "Save changes" }))

  expect(onSave).toHaveBeenCalledWith({
    deptcode: "FIN",
    deptname: "Finance & Payroll",
  })
  expect(await screen.findByRole("alert")).toHaveTextContent("Server error occurred")
  expect(onClose).not.toHaveBeenCalled()
})
