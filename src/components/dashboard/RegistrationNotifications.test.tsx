import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, expect, test, vi } from "vitest"
import { authApi } from "../../lib/auth"
import { notifyToast } from "../../lib/toast"
import RegistrationNotifications from "./RegistrationNotifications"
import { clearDashboardLiveCache } from "../../lib/dashboard-live-cache"

vi.mock("../../lib/auth", () => ({ authApi: { registrationNotifications: vi.fn() } }))
vi.mock("../../lib/toast", () => ({ notifyToast: vi.fn() }))
const notice = (userId: string, createdAt = "2026-11-02T10:00:00.000Z") => ({ userId, createdAt, name: `Applicant ${userId}`, email: `applicant${userId}@hope.inc` })
afterEach(() => { cleanup(); clearDashboardLiveCache(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.useRealTimers() })

test("keeps the notification count on remount without fetching again", async () => {
  vi.mocked(authApi.registrationNotifications).mockResolvedValue({ total: 1, registrations: [notice("1")] })
  const { unmount } = render(<MemoryRouter><RegistrationNotifications /></MemoryRouter>)
  await screen.findByLabelText("Registration notifications: 1 pending")
  unmount()
  render(<MemoryRouter><RegistrationNotifications /></MemoryRouter>)
  expect(screen.getByLabelText("Registration notifications: 1 pending")).toBeInTheDocument()
  expect(authApi.registrationNotifications).toHaveBeenCalledTimes(1)
  expect(notifyToast).not.toHaveBeenCalled()
})
function Location() { const location = useLocation(); return <output aria-label="Destination">{location.search}|{location.state?.registrationEmail}</output> }

test("shows existing pending accounts and links directly to the selected applicant", async () => {
  vi.mocked(authApi.registrationNotifications).mockResolvedValue({ total: 7, registrations: [notice("1")] })
  const user = userEvent.setup()
  render(<MemoryRouter><RegistrationNotifications /><Location /></MemoryRouter>)
  const summary = await screen.findByLabelText("Registration notifications: 7 pending")
  await user.click(summary)
  expect(screen.getByText("Applicant 1")).toBeInTheDocument()
  expect(notifyToast).not.toHaveBeenCalled()
  await user.click(screen.getByRole("link", { name: /Applicant 1/ }))
  expect(screen.getByLabelText("Destination")).toHaveTextContent("status=pending&page=1&search=applicant1%40hope.inc|applicant1@hope.inc")
  expect(summary.closest("details")).not.toHaveAttribute("open")
})

test("polls for new arrivals once, ignores older queue backfill, and aborts on unmount", async () => {
  vi.useFakeTimers()
  const load = vi.mocked(authApi.registrationNotifications)
  load.mockResolvedValueOnce({ total: 1, registrations: [notice("1")] })
    .mockResolvedValueOnce({ total: 2, registrations: [notice("2", "2026-11-02T11:00:00.000Z"), notice("1")] })
    .mockResolvedValue({ total: 1, registrations: [notice("0", "2026-11-01T10:00:00.000Z")] })
  const { unmount } = render(<MemoryRouter><RegistrationNotifications /></MemoryRouter>)
  await act(async () => {})
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(screen.getByLabelText("Registration notifications: 2 pending")).toBeInTheDocument()
  expect(notifyToast).toHaveBeenCalledExactlyOnceWith("A new employee registration is awaiting approval.", "info")
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(notifyToast).toHaveBeenCalledTimes(1)
  const signal = load.mock.calls[0][0]
  unmount()
  expect(signal?.aborted).toBe(true)
})

test("refreshes after approval, pauses hidden tabs, and retries errors", async () => {
  const visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  vi.mocked(authApi.registrationNotifications).mockRejectedValueOnce(new Error("Unable to load notifications."))
    .mockResolvedValue({ total: 0, registrations: [] })
  const user = userEvent.setup()
  render(<MemoryRouter><RegistrationNotifications /></MemoryRouter>)
  await user.click(screen.getByLabelText("Registration notifications"))
  await screen.findByText("Unable to load notifications.")
  await user.click(screen.getByRole("button", { name: "Try again" }))
  await screen.findByText("No registrations are waiting for approval.")
  const count = vi.mocked(authApi.registrationNotifications).mock.calls.length
  visible.mockReturnValue("hidden")
  fireEvent(window, new Event("hope:registrations-changed"))
  expect(authApi.registrationNotifications).toHaveBeenCalledTimes(count)
  visible.mockReturnValue("visible")
  await act(async () => { fireEvent(document, new Event("visibilitychange")) })
  expect(authApi.registrationNotifications).toHaveBeenCalledTimes(count + 1)
  await user.keyboard("{Escape}")
  expect(screen.getByLabelText("Registration notifications: 0 pending")).toHaveFocus()
})
