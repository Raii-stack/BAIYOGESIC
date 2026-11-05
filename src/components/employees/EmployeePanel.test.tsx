import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import EmployeePanel from "./EmployeePanel"

const lookups = {
  departments: [{ code: "IT", name: "Information Technology" }],
  jobs: [{ code: "DEV", name: "Developer" }],
}

afterEach(cleanup)

test("disables creation until department and job lookups exist", () => {
  render(<EmployeePanel employee={null} open departments={[]} jobs={[]} onClose={vi.fn()} onSave={vi.fn()} />)
  expect(screen.getByRole("button", { name: "Create employee" })).toBeDisabled()
})

test("submits normalized employee data and uses hire date when effective date is blank", async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<EmployeePanel employee={null} open {...lookups} onClose={onClose} onSave={onSave} />)

  await user.type(screen.getByLabelText("First name"), "  Ana ")
  await user.type(screen.getByLabelText("Last name"), " User ")
  await user.type(screen.getByLabelText("Work email"), " ana@example.com ")
  await user.type(screen.getByLabelText("Hire date"), "2026-10-01")
  await user.selectOptions(screen.getByLabelText("Department"), "IT")
  await user.selectOptions(screen.getByLabelText("Job title"), "DEV")
  await user.type(screen.getByLabelText("Salary"), "55000")
  await user.click(screen.getByRole("button", { name: "Create employee" }))

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    firstname: "Ana",
    lastname: "User",
    email: "ana@example.com",
    hiredate: "2026-10-01",
    effdate: "2026-10-01",
    jobcode: "DEV",
    deptcode: "IT",
    salary: 55000,
  }))
  expect(onClose).toHaveBeenCalledOnce()
})

test("shows API failures and prevents closing while saving", async () => {
  const user = userEvent.setup()
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  const onClose = vi.fn()
  const onSave = vi.fn().mockReturnValue(pending)
  const { rerender } = render(<EmployeePanel employee={null} open {...lookups} onClose={onClose} onSave={onSave} />)

  await user.type(screen.getByLabelText("First name"), "Ana")
  await user.type(screen.getByLabelText("Last name"), "User")
  await user.type(screen.getByLabelText("Work email"), "ana@example.com")
  await user.type(screen.getByLabelText("Hire date"), "2026-10-01")
  await user.selectOptions(screen.getByLabelText("Department"), "IT")
  await user.selectOptions(screen.getByLabelText("Job title"), "DEV")
  await user.type(screen.getByLabelText("Salary"), "55000")
  await user.click(screen.getByRole("button", { name: "Create employee" }))
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  release()
  await screen.findByRole("button", { name: "Create employee" })

  const failingSave = vi.fn().mockRejectedValue(new Error("Employee email already exists."))
  rerender(<EmployeePanel employee={null} open {...lookups} onClose={onClose} onSave={failingSave} />)
  await user.click(screen.getByRole("button", { name: "Create employee" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Employee email already exists.")
})
