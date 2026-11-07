import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { WorkspaceProvider, useWorkspace } from "./WorkspaceProvider"
import { defaultPreferences, emptyInbox, workspaceApi, type Inbox } from "../../lib/workspace-api"
import SettingsPage from "../pages/SettingsPage"
import { notifyToast } from "../../lib/toast"

vi.mock("../../layouts/DashboardLayout", () => ({ default: ({ children }: { children: import("react").ReactNode }) => <>{children}</> }))
vi.mock("../../lib/toast", () => ({ notifyToast: vi.fn() }))
vi.mock("../../lib/workspace-api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/workspace-api")>("../../lib/workspace-api")
  return { ...actual, workspaceApi: { preferences: vi.fn(), inbox: vi.fn(), savePreferences: vi.fn(), read: vi.fn(), readAll: vi.fn() } }
})
const user = { userId: "1", empno: "00001", email: "one@example.com", role: "employee", status: "active", mustChangePassword: false }
const notification = (id: string) => ({ id, category: "account", title: `Notice ${id}`, message: "Account updated.", createdAt: "2026-11-07T00:00:00Z", readAt: null })
const data = (id: string): Inbox => ({ items: [notification(id)], unreadCount: 1, total: 1, page: 1, totalPages: 1 })
function Harness() {
  const { inbox, preferences } = useWorkspace()
  return <><output aria-label="Inbox">{inbox.items.map((item) => item.title).join(",")}</output><output aria-label="Density">{preferences.density}</output></>
}
beforeEach(() => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  vi.mocked(workspaceApi.preferences).mockResolvedValue({ ...defaultPreferences })
  vi.mocked(workspaceApi.inbox).mockResolvedValue({ ...emptyInbox })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks() })

test("keeps session data across children changing without fetching again", async () => {
  vi.mocked(workspaceApi.inbox).mockResolvedValue(data("1"))
  const { rerender } = render(<WorkspaceProvider user={user}><Harness /></WorkspaceProvider>)
  await screen.findByText("Notice 1")
  rerender(<WorkspaceProvider user={user}><Harness /><p>A different page</p></WorkspaceProvider>)
  expect(screen.getByLabelText("Inbox")).toHaveTextContent("Notice 1")
  expect(workspaceApi.inbox).toHaveBeenCalledTimes(1)
  fireEvent(window, new Event("focus"))
  expect(workspaceApi.preferences).toHaveBeenCalledTimes(1)
})

test("polls quietly, skips hidden tabs, and only announces new unread items", async () => {
  vi.useFakeTimers()
  vi.mocked(workspaceApi.inbox).mockResolvedValueOnce(data("1")).mockResolvedValueOnce(data("1")).mockResolvedValue(data("2"))
  render(<WorkspaceProvider user={user}><Harness /></WorkspaceProvider>)
  await act(async () => {})
  expect(notifyToast).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(notifyToast).not.toHaveBeenCalled()
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(workspaceApi.inbox).toHaveBeenCalledTimes(2)
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
  await act(async () => { fireEvent(document, new Event("visibilitychange")) })
  expect(screen.getByLabelText("Inbox")).toHaveTextContent("Notice 2")
  expect(notifyToast).toHaveBeenCalledExactlyOnceWith("You have new notifications.", "info")
})

test("does not duplicate a preference request when the tab gains focus while loading", async () => {
  let resolve!: (value: typeof defaultPreferences) => void
  vi.mocked(workspaceApi.preferences).mockReturnValueOnce(new Promise((done) => { resolve = done }))
  render(<WorkspaceProvider user={user}><Harness /></WorkspaceProvider>)
  fireEvent(window, new Event("focus"))
  fireEvent(document, new Event("visibilitychange"))
  expect(workspaceApi.preferences).toHaveBeenCalledTimes(1)
  await act(async () => { resolve({ ...defaultPreferences }) })
  fireEvent(window, new Event("focus"))
  expect(workspaceApi.preferences).toHaveBeenCalledTimes(1)
})

test("clears account data and ignores a previous account's late response", async () => {
  let resolve!: (value: Inbox) => void
  vi.mocked(workspaceApi.inbox).mockReturnValueOnce(new Promise((done) => { resolve = done })).mockResolvedValue(data("2"))
  const { rerender } = render(<WorkspaceProvider user={user}><Harness /></WorkspaceProvider>)
  rerender(<WorkspaceProvider user={{ ...user, userId: "2" }}><Harness /></WorkspaceProvider>)
  await screen.findByText("Notice 2")
  await act(async () => { resolve(data("1")) })
  expect(screen.getByLabelText("Inbox")).toHaveTextContent("Notice 2")
  rerender(<WorkspaceProvider user={null}><Harness /></WorkspaceProvider>)
  expect(screen.getByLabelText("Inbox")).toBeEmptyDOMElement()
  expect(document.documentElement.dataset.workspaceDensity).toBeUndefined()
})

test("caches history across routes, deduplicates requests, and refreshes it after inbox changes", async () => {
  let workspace!: ReturnType<typeof useWorkspace>
  function Capture() { workspace = useWorkspace(); return null }
  const { rerender } = render(<WorkspaceProvider user={user}><Capture /></WorkspaceProvider>)
  await act(async () => {})
  const secondPage = { ...data("2"), page: 2, totalPages: 2 }
  vi.mocked(workspaceApi.inbox).mockResolvedValue(secondPage)
  await act(async () => { await Promise.all([workspace.loadInboxPage(2), workspace.loadInboxPage(2)]) })
  expect(workspaceApi.inbox).toHaveBeenCalledTimes(2)
  rerender(<WorkspaceProvider user={user}><Capture /><p>Different route</p></WorkspaceProvider>)
  await act(async () => { expect(await workspace.loadInboxPage(2)).toEqual(secondPage) })
  expect(workspaceApi.inbox).toHaveBeenCalledTimes(2)
  vi.mocked(workspaceApi.inbox).mockResolvedValueOnce(data("3")).mockResolvedValueOnce({ ...secondPage, items: [] })
  await act(async () => { await workspace.refreshInbox(); await workspace.loadInboxPage(2) })
  expect(workspaceApi.inbox).toHaveBeenCalledTimes(4)
  expect(workspace.cachedInboxPage(2)?.items).toEqual([])
  rerender(<WorkspaceProvider user={null}><Capture /></WorkspaceProvider>)
  expect(workspace.cachedInboxPage(2)).toBeUndefined()
})

test("applies preferences immediately and keeps unsaved choices through failure and navigation", async () => {
  vi.mocked(workspaceApi.savePreferences).mockRejectedValueOnce(new Error("Unable to save settings."))
    .mockImplementationOnce(async (preferences) => preferences)
  const action = userEvent.setup()
  const { rerender } = render(<WorkspaceProvider user={user}><SettingsPage /></WorkspaceProvider>)
  await waitFor(() => expect(screen.getByRole("checkbox", { name: /Smooth animations/ })).toBeEnabled())
  await action.click(screen.getByRole("checkbox", { name: /Smooth animations/ }))
  expect(document.documentElement.dataset.workspaceMotion).toBe("off")
  await action.selectOptions(screen.getByRole("combobox", { name: /Table spacing/ }), "compact")
  expect(document.documentElement.dataset.workspaceDensity).toBe("compact")
  await action.click(screen.getByRole("button", { name: "Save settings" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Your choices are kept")
  rerender(<WorkspaceProvider user={user}><Harness /></WorkspaceProvider>)
  rerender(<WorkspaceProvider user={user}><SettingsPage /></WorkspaceProvider>)
  expect(screen.getByRole("checkbox", { name: /Smooth animations/ })).not.toBeChecked()
  expect(screen.getByRole("button", { name: "Save settings" })).toBeEnabled()
  await action.click(screen.getByRole("button", { name: "Save settings" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled())
  expect(workspaceApi.savePreferences).toHaveBeenLastCalledWith({ ...defaultPreferences, motion: false, density: "compact" })
})
