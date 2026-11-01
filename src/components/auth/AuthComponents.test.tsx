import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test } from "vitest"

import {
  AuthShell,
  Field,
  RoleField,
  Submit,
  SuccessMessage,
} from "./AuthComponents"
import PasswordStrengthMeter from "./PasswordStrengthMeter"

test("Field toggles password visibility and exposes validation state", async () => {
  const user = userEvent.setup()
  let value = "secret"

  render(
    <Field
      id="password"
      label="Password"
      type="password"
      value={value}
      onChange={(next) => { value = next }}
      error="Password is required."
      icon="lock"
      placeholder="Enter password"
      passwordToggle
    />,
  )

  const input = screen.getByLabelText("Password")
  expect(input).toHaveAttribute("type", "password")
  expect(input).toHaveAttribute("aria-invalid", "true")
  expect(input).toHaveAttribute("aria-describedby", "password-error")
  expect(screen.getByText("Password is required.")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Show password" }))
  expect(input).toHaveAttribute("type", "text")
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true")
})

test("RoleField reports selection changes and Submit reflects loading state", async () => {
  const user = userEvent.setup()
  let role = ""
  const { rerender } = render(
    <>
      <RoleField value={role} onChange={(next) => { role = next }} />
      <Submit loading={false} loadingLabel="Saving…">Create account</Submit>
    </>,
  )

  await user.selectOptions(screen.getByLabelText("ERP role"), "manager")
  expect(role).toBe("manager")
  expect(screen.getByRole("button", { name: "Create account" })).not.toBeDisabled()

  rerender(
    <>
      <RoleField value="manager" onChange={() => {}} error="Select an ERP access level." />
      <Submit loading={true} loadingLabel="Saving…">Create account</Submit>
    </>,
  )
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
  expect(screen.getByText("Select an ERP access level.")).toBeInTheDocument()
})

test("password strength meter handles empty and strong passwords", () => {
  const { rerender } = render(<PasswordStrengthMeter password="" />)
  const meter = screen.getByRole("meter", { name: "Password strength" })
  expect(meter).toHaveAttribute("aria-valuenow", "0")
  expect(meter).toHaveAttribute("aria-valuetext", "Not set")

  rerender(<PasswordStrengthMeter password="LongEnough123!" />)
  expect(meter).toHaveAttribute("aria-valuenow", "4")
  expect(meter).toHaveAttribute("aria-valuetext", "Very strong")
})

test("AuthShell keeps login-only help text scoped to login", () => {
  const { rerender } = render(
    <AuthShell page="login" title="Sign in" subtitle="Continue">
      <SuccessMessage>Done</SuccessMessage>
    </AuthShell>,
  )
  expect(screen.getByText("Need access? Contact your administrator.")).toBeInTheDocument()
  expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Done")

  rerender(
    <AuthShell page="create" title="Create" subtitle="Provision">
      <span>Form</span>
    </AuthShell>,
  )
  expect(screen.queryByText("Need access? Contact your administrator.")).not.toBeInTheDocument()
})
