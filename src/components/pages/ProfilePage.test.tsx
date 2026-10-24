import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, expect, test, vi } from "vitest"

import { AuthProvider } from "../auth/AuthProvider"
import ProfilePage from "./ProfilePage"

const user = {
  userId: "user-1",
  empno: "00010",
  firstName: "Agent",
  lastName: "One",
  name: "Agent One",
  email: "agent@hope.inc",
  role: "employee",
  status: "active",
  mustChangePassword: false,
  jobTitle: "Account Executive",
  departmentName: "Sales",
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test("shows the current employee identity and profile link", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { user } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })))

  render(<MemoryRouter initialEntries={["/profile?view=account"]}><AuthProvider><ProfilePage /></AuthProvider></MemoryRouter>)

  expect(await screen.findByRole("heading", { name: "My account" })).toBeInTheDocument()
  expect(screen.getAllByText("Agent One").length).toBeGreaterThan(0)
  expect(screen.getByText("Account Executive")).toBeInTheDocument()
  expect(screen.getAllByText("Sales").length).toBeGreaterThan(0)
  expect(screen.getAllByRole("link", { name: /Agent One/ }).length).toBeGreaterThan(0)
  expect(screen.getAllByRole("link", { name: /Agent One/ })[0]).toHaveAttribute("href", "/profile?view=account")
})
