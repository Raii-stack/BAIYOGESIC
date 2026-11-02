import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"
import JobModal from "./JobModal"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("validates required fields, code length, and duplicate codes for job positions", async () => {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  const user = userEvent.setup()

  render(
    <JobModal
      open={true}
      existingCodes={["DEV", "MGR"]}
      onClose={onClose}
      onSave={onSave}
    />,
  )

  expect(screen.getByRole("dialog", { name: "Add Job Position" })).toBeInTheDocument()

  // Attempt empty submit
  await user.click(screen.getByRole("button", { name: "Create job" }))
  expect(await screen.findByText("Job code is required.")).toBeInTheDocument()
  expect(screen.getByText("Job description is required.")).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()

  // Duplicate code
  await user.type(screen.getByLabelText(/Job Code/), "DEV")
  await user.type(screen.getByLabelText(/Job Title/), "Developer 2")
  await user.click(screen.getByRole("button", { name: "Create job" }))
  expect(await screen.findByText("A job position with this code already exists.")).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()

  // Valid submit
  await user.clear(screen.getByLabelText(/Job Code/))
  await user.type(screen.getByLabelText(/Job Code/), "qa")
  await user.click(screen.getByRole("button", { name: "Create job" }))

  expect(onSave).toHaveBeenCalledWith({
    jobcode: "QA",
    jobdesc: "Developer 2",
  })
  expect(onClose).toHaveBeenCalled()
})

test("edits existing job position, disables code field, and shows error on failure", async () => {
  const onSave = vi.fn().mockRejectedValue(new Error("Database update failed"))
  const onClose = vi.fn()
  const user = userEvent.setup()

  render(
    <JobModal
      open={true}
      job={{
        code: "DEV",
        description: "Software Developer",
      }}
      onClose={onClose}
      onSave={onSave}
    />,
  )

  expect(screen.getByRole("dialog", { name: "Edit Job Position" })).toBeInTheDocument()
  expect(screen.getByLabelText(/Job Code/)).toBeDisabled()

  await user.clear(screen.getByLabelText(/Job Title/))
  await user.type(screen.getByLabelText(/Job Title/), "Senior Developer")
  await user.click(screen.getByRole("button", { name: "Save changes" }))

  expect(onSave).toHaveBeenCalledWith({
    jobcode: "DEV",
    jobdesc: "Senior Developer",
  })
  expect(await screen.findByRole("alert")).toHaveTextContent("Database update failed")
  expect(onClose).not.toHaveBeenCalled()
})
