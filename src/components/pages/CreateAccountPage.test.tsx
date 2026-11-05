import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, expect, test } from "vitest"

import CreateAccountPage from "./CreateAccountPage"

afterEach(cleanup)

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/create-account"]}>
      <Routes>
        <Route path="/create-account" element={<CreateAccountPage />} />
        <Route path="/dashboard" element={<h1>Dashboard reached</h1>} />
        <Route path="/login" element={<h1>Sign in reached</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

test("reports every missing field and rejects invalid email, short password, and mismatch", async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getByRole("button", { name: "Create account" }))
  expect(screen.getByText("First name is required.")).toBeInTheDocument()
  expect(screen.getByText("Last name is required.")).toBeInTheDocument()
  expect(screen.getByText("Enter a valid work email address.")).toBeInTheDocument()
  expect(screen.getByText("Select an ERP access level.")).toBeInTheDocument()
  expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument()
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument()

  await user.type(screen.getByLabelText("First name"), "A")
  await user.type(screen.getByLabelText("Last name"), "User")
  await user.type(screen.getByLabelText("Employee work email"), "not-an-email")
  await user.selectOptions(screen.getByLabelText("ERP role"), "employee")
  await user.type(screen.getByLabelText("Temporary password"), "short")
  await user.type(screen.getByLabelText("Confirm password"), "different")
  await user.click(screen.getByRole("button", { name: "Create account" }))
  expect(screen.getByText("Enter a valid work email address.")).toBeInTheDocument()
  expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument()
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument()
  expect(screen.queryByText("Account created.")).not.toBeInTheDocument()
})

test("trims valid names, supports password visibility, and navigates after creation", async () => {
  const user = userEvent.setup()
  renderPage()

  await user.type(screen.getByLabelText("First name"), " Ana ")
  await user.type(screen.getByLabelText("Last name"), " User ")
  await user.type(screen.getByLabelText("Employee work email"), "ana@example.com")
  await user.selectOptions(screen.getByLabelText("ERP role"), "manager")
  await user.type(screen.getByLabelText("Temporary password"), "Temporary1!")
  await user.type(screen.getByLabelText("Confirm password"), "Temporary1!")

  await user.click(screen.getAllByRole("button", { name: "Show password" })[0])
  expect(screen.getByLabelText("Temporary password")).toHaveAttribute("type", "text")
  await user.click(screen.getByRole("button", { name: "Create account" }))
  expect(screen.getByRole("button", { name: "Creating account…" })).toBeDisabled()

  await waitFor(() => expect(screen.getByRole("heading", { name: "Dashboard reached" })).toBeInTheDocument(), { timeout: 2000 })
})

test("keeps the sign-in link available", async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole("link", { name: "Back to sign in" }))
  expect(screen.getByRole("heading", { name: "Sign in reached" })).toBeInTheDocument()
})
