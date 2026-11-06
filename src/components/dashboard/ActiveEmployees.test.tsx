import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { authApi } from "../../lib/auth"
import ActiveEmployees from "./ActiveEmployees"
import { clearDashboardLiveCache } from "../../lib/dashboard-live-cache"

vi.mock("../../lib/auth", () => ({ authApi: { activeEmployees: vi.fn() } }))
afterEach(() => { cleanup(); clearDashboardLiveCache(); vi.restoreAllMocks(); vi.clearAllMocks() })

test("keeps employee activity on remount without fetching or showing loading", async () => {
  vi.mocked(authApi.activeEmployees).mockResolvedValue({ employees: [{ userId: "1", empno: "00001", name: "Alex Montes", lastSeenAt: "2026-11-02T12:00:00Z" }] })
  const { unmount } = render(<ActiveEmployees />)
  await screen.findByText("Alex Montes")
  unmount()
  render(<ActiveEmployees />)
  expect(screen.getByText("Alex Montes")).toBeInTheDocument()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  expect(authApi.activeEmployees).toHaveBeenCalledTimes(1)
})

test("renders recent employees and allows refreshing the manager view", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  vi.mocked(authApi.activeEmployees).mockResolvedValueOnce({ employees: [{ userId: "1", empno: "00001", name: "Alex Montes", lastSeenAt: "2026-11-02T12:00:00Z" }] }).mockResolvedValueOnce({ employees: [] })
  render(<ActiveEmployees />)
  expect(await screen.findByText("Alex Montes")).toBeInTheDocument()
  expect(screen.getByText(/Activity in the last 2 minutes/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }))
  expect(await screen.findByText("No employees are currently online.")).toBeInTheDocument()
})

test("shows failures and lets a manager retry", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  vi.mocked(authApi.activeEmployees).mockRejectedValueOnce(new Error("Unable to load activity.")).mockResolvedValueOnce({ employees: [] })
  render(<ActiveEmployees />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load activity.")
  fireEvent.click(screen.getByRole("button", { name: "Refresh activity" }))
  expect(await screen.findByText("No employees are currently online.")).toBeInTheDocument()
})
