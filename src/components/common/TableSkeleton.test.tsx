import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import TableSkeleton from "./TableSkeleton"

afterEach(cleanup)

test("loading cards use the permitted columns and stay hidden from assistive technology", () => {
  const { rerender } = render(<TableSkeleton label="Loading prices" headings={["Effective date", "Unit price", "Last change"]} />)
  const table = screen.getByRole("table", { name: "Loading prices" })
  expect(table).toHaveAttribute("aria-busy", "true")
  expect(within(table).getAllByRole("row")).toHaveLength(1)
  expect(table.querySelectorAll('tbody tr[aria-hidden="true"]')).toHaveLength(3)
  expect(table.querySelector('td[data-label="Last change"]')).not.toBeNull()

  rerender(<TableSkeleton label="Loading prices" headings={["Effective date", "Unit price"]} />)
  expect(within(table).queryByRole("columnheader", { name: "Last change" })).not.toBeInTheDocument()
  expect(table.querySelector('td[data-label="Last change"]')).toBeNull()
  expect(table.querySelector('td[data-label="Unit price"] .animate-pulse')).not.toBeNull()
})
