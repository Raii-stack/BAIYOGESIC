import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, test } from "vitest"
import CareerTimeline from "./CareerTimeline"
import type { JobHistoryEntry } from "../../types/employee"

const sampleEntries: JobHistoryEntry[] = [
  {
    id: "00001-DEV-2026-01-01",
    effectiveDate: "2026-01-01",
    jobTitle: "Senior Developer",
    department: "Engineering",
    salary: 85000,
    canViewSalary: true,
    stamp: "UPDATE admin",
  },
  {
    id: "00001-DEV-2024-06-01",
    effectiveDate: "2024-06-01",
    jobTitle: "Developer",
    department: "Information Technology",
    salary: 65000,
    canViewSalary: true,
    stamp: "UPDATE admin",
  },
  {
    id: "00001-DEV-2022-01-01",
    effectiveDate: "2022-01-01",
    jobTitle: "Junior Developer",
    department: "Information Technology",
    salary: 50000,
    canViewSalary: false,
    stamp: "ADD admin",
  },
]

afterEach(() => {
  cleanup()
})

describe("CareerTimeline", () => {
  test("renders skeleton loader when loading is true", () => {
    render(<CareerTimeline entries={[]} loading={true} />)

    expect(screen.getByRole("status", { name: "Loading career timeline" })).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Job history timeline" })).not.toBeInTheDocument()
  })

  test("renders friendly empty state when entries are empty", () => {
    render(<CareerTimeline entries={[]} loading={false} />)

    expect(screen.getByTestId("career-timeline-empty")).toBeInTheDocument()
    expect(screen.getByText("No job history recorded.")).toBeInTheDocument()
    expect(
      screen.getByText(
        "This employee is on their initial job assignment with no previous promotions or department transfers."
      )
    ).toBeInTheDocument()
  })

  test("renders chronological career timeline nodes sequentially", () => {
    render(<CareerTimeline entries={sampleEntries} />)

    const list = screen.getByRole("list", { name: "Job history timeline" })
    expect(list).toBeInTheDocument()

    const items = screen.getAllByRole("listitem")
    expect(items).toHaveLength(3)

    // First item is current role
    expect(items[0]).toHaveTextContent("Senior Developer")
    expect(items[0]).toHaveTextContent("2026-01-01")
    expect(items[0]).toHaveTextContent("Current")

    // Second item
    expect(items[1]).toHaveTextContent("Developer")
    expect(items[1]).toHaveTextContent("2024-06-01")

    // Third item
    expect(items[2]).toHaveTextContent("Junior Developer")
    expect(items[2]).toHaveTextContent("2022-01-01")
  })

  test("renders milestone badges for promotion and department transfer", () => {
    render(<CareerTimeline entries={sampleEntries} />)

    const items = screen.getAllByRole("listitem")

    // Entry 0 (Senior Developer in Engineering) vs Entry 1 (Developer in IT):
    // Both title changed ("Promotion") and department changed ("Transfer")
    expect(items[0]).toHaveTextContent("Promotion")
    expect(items[0]).toHaveTextContent("Transfer")

    // Entry 1 (Developer in IT) vs Entry 2 (Junior Developer in IT):
    // Only title changed ("Promotion"), same department ("Information Technology")
    expect(items[1]).toHaveTextContent("Promotion")
    expect(items[1]).not.toHaveTextContent("Transfer")

    // Entry 2 (Junior Developer) has no preceding entry (initial role):
    // Neither badge should appear
    expect(items[2]).not.toHaveTextContent("Promotion")
    expect(items[2]).not.toHaveTextContent("Transfer")
    expect(items[2]).not.toHaveTextContent("Current")
  })

  test("formats salary when authorized and masks salary with accessible label when unauthorized", () => {
    render(<CareerTimeline entries={sampleEntries} />)

    // Authorized entries show currency
    expect(screen.getByText("$85,000")).toBeInTheDocument()
    expect(screen.getByText("$65,000")).toBeInTheDocument()

    // Unauthorized entry (Junior Dev) shows masked bullets with lock icon
    expect(
      screen.getByLabelText("Salary hidden due to permissions")
    ).toBeInTheDocument()
    expect(screen.getByText("••••••••")).toBeInTheDocument()
  })

  test("allows authorized user to toggle reveal / mask of compensation", async () => {
    const user = userEvent.setup()
    render(<CareerTimeline entries={sampleEntries} canViewSalary={true} />)

    expect(screen.getByText("$85,000")).toBeInTheDocument()
    const toggleButtons = screen.getAllByRole("button", { name: "Hide salary" })
    expect(toggleButtons.length).toBeGreaterThan(0)

    // Click toggle to mask
    await user.click(toggleButtons[0])
    expect(screen.queryByText("$85,000")).not.toBeInTheDocument()
    expect(screen.getAllByText("••••••••").length).toBeGreaterThan(0)

    // Click toggle to reveal
    const showButtons = screen.getAllByRole("button", { name: "Show salary" })
    await user.click(showButtons[0])
    expect(screen.getByText("$85,000")).toBeInTheDocument()
  })

  test("hides reveal toggle button completely for unauthorized users", () => {
    render(<CareerTimeline entries={sampleEntries} canViewSalary={false} />)

    expect(screen.queryByRole("button", { name: /salary/i })).not.toBeInTheDocument()
    expect(screen.queryByText("$85,000")).not.toBeInTheDocument()
    expect(screen.getAllByText("••••••••")).toHaveLength(3)
  })

  test("respects showAudit prop", () => {
    const { rerender } = render(
      <CareerTimeline entries={sampleEntries} showAudit={true} />
    )

    expect(screen.getAllByText("UPDATE admin")).toHaveLength(2)
    expect(screen.getByText("ADD admin")).toBeInTheDocument()

    rerender(<CareerTimeline entries={sampleEntries} showAudit={false} />)

    expect(screen.queryByText("UPDATE admin")).not.toBeInTheDocument()
    expect(screen.queryByText("ADD admin")).not.toBeInTheDocument()
  })
})
