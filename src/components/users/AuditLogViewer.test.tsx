import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import AuditLogViewer from "./AuditLogViewer"
import { auditLogApi, type AuditLogResult } from "../../lib/audit-log-api"

vi.mock("../../lib/audit-log-api", () => ({
  auditLogApi: {
    list: vi.fn(),
  },
}))

const sampleLogs: AuditLogResult = {
  logs: [
    {
      auditId: "101",
      tableName: "sales",
      action: "UPDATE",
      recordKey: "SO-2026-0001",
      oldValues: { status: "Active", total: 1000, discount: 0 },
      newValues: { status: "Active", total: 900, discount: 100 },
      actionBy: "superadmin@hope.inc",
      actionAt: "2026-11-02T14:30:00Z",
    },
    {
      auditId: "102",
      tableName: "customer",
      action: "INSERT",
      recordKey: "CUST-0099",
      oldValues: null,
      newValues: { custname: "Globex Corp", status: "Active" },
      actionBy: "esperanza.nehemiah@hope.inc",
      actionAt: "2026-11-02T13:00:00Z",
    },
  ],
  pagination: {
    page: 1,
    limit: 15,
    total: 2,
    totalPages: 1,
  },
}

describe("AuditLogViewer component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auditLogApi.list).mockResolvedValue(sampleLogs)
  })

  afterEach(() => {
    cleanup()
  })

  it("renders audit trail table and displays logs", async () => {
    render(<AuditLogViewer />)

    expect(screen.getByText(/Append-Only Audit Log/i)).toBeInTheDocument()
    expect(await screen.findByText("Audit Trail")).toBeInTheDocument()
    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument()
    expect(screen.getByText("CUST-0099")).toBeInTheDocument()
    expect(screen.getByText("superadmin@hope.inc")).toBeInTheDocument()
  })

  it("filters logs by table and action", async () => {
    render(<AuditLogViewer />)

    await screen.findByText("SO-2026-0001")

    const tableSelect = screen.getByLabelText(/Filter by table/i)
    fireEvent.change(tableSelect, { target: { value: "sales" } })

    await waitFor(() => {
      expect(auditLogApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: "sales" }),
        expect.any(AbortSignal),
      )
    })

    const actionSelect = screen.getByLabelText(/Filter by action/i)
    fireEvent.change(actionSelect, { target: { value: "UPDATE" } })

    await waitFor(() => {
      expect(auditLogApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: "sales", action: "UPDATE" }),
        expect.any(AbortSignal),
      )
    })
  })

  it("opens DiffInspectorModal, displays field differences, and closes on Escape", async () => {
    render(<AuditLogViewer />)

    const inspectBtn = await screen.findByRole("button", {
      name: "View diff for audit entry 101",
    })
    fireEvent.click(inspectBtn)

    expect(
      await screen.findByRole("dialog", { name: /Audit Entry #101: Diff Inspector/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("Field Delta Comparison (Old vs New)")).toBeInTheDocument()

    // Modified fields should show MODIFIED badge
    expect(screen.getAllByText("MODIFIED")).toHaveLength(2) // discount and total

    // Press Escape to close modal
    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Audit Entry #101: Diff Inspector/i }),
      ).not.toBeInTheDocument()
    })
  })

  it("shows empty state when no logs match filters", async () => {
    vi.mocked(auditLogApi.list).mockResolvedValueOnce({
      logs: [],
      pagination: { page: 1, limit: 15, total: 0, totalPages: 1 },
    })

    render(<AuditLogViewer />)

    expect(
      await screen.findByText(/No audit records found matching the selected criteria/i),
    ).toBeInTheDocument()
  })

  it("displays error alert with retry button when query fails", async () => {
    vi.mocked(auditLogApi.list).mockRejectedValueOnce(new Error("Database connection timed out"))

    render(<AuditLogViewer />)

    expect(await screen.findByText("Database connection timed out")).toBeInTheDocument()
    const retryBtn = screen.getByRole("button", { name: /Try again/i })
    expect(retryBtn).toBeInTheDocument()

    vi.mocked(auditLogApi.list).mockResolvedValueOnce(sampleLogs)
    fireEvent.click(retryBtn)

    expect(await screen.findByText("SO-2026-0001")).toBeInTheDocument()
  })
})
