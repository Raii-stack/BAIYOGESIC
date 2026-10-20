import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { ProtectedPage } from "./App"
import { AuthProvider } from "./components/auth/AuthProvider"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const response = (status: number, data?: object) => new Response(JSON.stringify(data ? { success: true, data } : { success: false, error: { message: "Authentication required" } }), { status, headers: { "Content-Type": "application/json" } })

function renderGuard(role?: string, mustChangePassword = false) {
  vi.stubGlobal("fetch", vi.fn(async () => role ? response(200, { user: { userId: "1", empno: null, email: "example@example.com", role, status: "active", mustChangePassword } }) : response(401)))
  render(<MemoryRouter initialEntries={["/users"]}><AuthProvider><Routes>
    <Route path="/users" element={<ProtectedPage roles={["administrator", "admin"]}><div>Private accounts</div></ProtectedPage>} />
    <Route path="/dashboard" element={<div>Dashboard</div>} />
    <Route path="/" element={<div>Sign in</div>} />
  </Routes></AuthProvider></MemoryRouter>)
}

test("redirects visitors and default-password users away from protected pages", async () => {
  renderGuard()
  expect(await screen.findByText("Sign in")).toBeInTheDocument()
  cleanup()
  renderGuard("administrator", true)
  expect(await screen.findByText("Sign in")).toBeInTheDocument()
})

test("reserves user management for administrators", async () => {
  renderGuard("employee")
  expect(await screen.findByText("Dashboard")).toBeInTheDocument()
  cleanup()
  renderGuard("administrator")
  expect(await screen.findByText("Private accounts")).toBeInTheDocument()
})
