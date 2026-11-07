import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test, vi } from "vitest"

import App from "../../App"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function openPage(path: string, authenticated = false) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(authenticated
    ? { success: true, data: { user: { userId: "1", email: "staff@hope.inc", role: "employee", status: "active", mustChangePassword: false } } }
    : { success: false, error: { message: "Authentication required" } }), {
    status: authenticated ? 200 : 401,
    headers: { "Content-Type": "application/json" },
  })))
  window.history.replaceState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
  render(<App />)
}

test("visitors see the landing page and can continue to sign in", async () => {
  const user = userEvent.setup()
  openPage("/")
  expect(await screen.findByRole("heading", { name: "Your business, connected in one ERP workspace." })).toBeInTheDocument()
  expect(screen.queryByLabelText("Work email")).not.toBeInTheDocument()
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument()
  const headerSignIn = screen.getByRole("link", { name: "Sign in" })
  expect(headerSignIn).toHaveAttribute("href", "/login")
  expect(headerSignIn.querySelector("svg")).not.toBeNull()
  expect(headerSignIn.textContent).not.toMatch(/[↗→↓↑]/)
  const cta = screen.getByRole("link", { name: "Sign in to your workspace" })
  expect(cta).toHaveAttribute("href", "/login")
  expect(cta.querySelector("svg")).not.toBeNull()
  expect(screen.getByRole("link", { name: "Open your workspace" }).querySelector("svg")).not.toBeNull()
  await user.click(cta)
  expect(await screen.findByLabelText("Work email")).toBeInTheDocument()
  expect(window.location.pathname).toBe("/login")
})

test("links visitors from the landing page to registration and sign in", async () => {
  const user = userEvent.setup()
  openPage("/")
  expect(await screen.findByRole("heading", { name: "Your business, connected in one ERP workspace." })).toBeInTheDocument()
  expect(screen.getByText("Run your entire business with confidence")).toBeInTheDocument()

  const registerButtons = screen.getAllByRole("link", { name: /^Register/i })
  expect(registerButtons.length).toBeGreaterThan(0)
  await user.click(registerButtons[0])

  expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument()
  expect(window.location.pathname).toBe("/register")
  await user.click(screen.getByRole("link", { name: "Sign in" }))
  expect(await screen.findByLabelText("Work email")).toBeInTheDocument()
  expect(window.location.pathname).toBe("/login")
})

test("active sessions skip the landing page", async () => {
  openPage("/", true)
  expect(await screen.findByRole("heading", { name: "Welcome back, staff@hope.inc" })).toBeInTheDocument()
  expect(window.location.pathname).toBe("/dashboard")
})

test.each(["/dashboard", "/create-account"])("unauthenticated visitors at %s reach /login", async (path) => {
  openPage(path)
  expect(await screen.findByLabelText("Work email")).toBeInTheDocument()
  expect(window.location.pathname).toBe("/login")
})

test("unknown routes return to the landing page", async () => {
  openPage("/unknown-page")
  expect(await screen.findByRole("heading", { name: "Your business, connected in one ERP workspace." })).toBeInTheDocument()
  await waitFor(() => expect(window.location.pathname).toBe("/"))
})
