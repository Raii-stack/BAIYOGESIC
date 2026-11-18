import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router"
import { afterEach, describe, expect, test } from "vitest"
import useDirectoryTableQuery from "./useDirectoryTableQuery"

afterEach(cleanup)

type SortKey = "customer" | "customerId"

function Harness() {
  const { page, limit, sortBy, sortOrder, setPage, setLimit, toggleSort } =
    useDirectoryTableQuery<SortKey>(["customer", "customerId"], "customer")
  const location = useLocation()

  return (
    <div>
      <output aria-label="State">{`${page}|${limit}|${sortBy}|${sortOrder}`}</output>
      <output aria-label="Query">{location.search}</output>
      <button onClick={() => setPage(3)}>Page 3</button>
      <button onClick={() => setLimit(25)}>Limit 25</button>
      <button onClick={() => toggleSort("customer")}>Sort Customer</button>
      <button onClick={() => toggleSort("customerId")}>Sort ID</button>
    </div>
  )
}

describe("hooks/useDirectoryTableQuery ([S2-UIX-01])", () => {
  test("normalizes invalid page, limit, sortBy, and sortOrder parameters", async () => {
    render(
      <MemoryRouter initialEntries={["/customers?page=-4&limit=99&sortBy=password&sortOrder=sideways&search=acme"]}>
        <Harness />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText("State")).toHaveTextContent("1|10|customer|asc")
    await waitFor(() =>
      expect(screen.getByLabelText("Query")).toHaveTextContent("page=1&limit=10&sortBy=customer&sortOrder=asc&search=acme"),
    )
  })

  test("toggles sort order, resets page to 1 on sort or limit changes, and preserves filters", async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={["/customers?page=2&limit=10&sortBy=customer&sortOrder=asc"]}>
        <Harness />
      </MemoryRouter>,
    )

    await user.click(screen.getByText("Page 3"))
    expect(screen.getByLabelText("State")).toHaveTextContent("3|10|customer|asc")

    await user.click(screen.getByText("Sort Customer"))
    expect(screen.getByLabelText("State")).toHaveTextContent("1|10|customer|desc")

    await user.click(screen.getByText("Sort ID"))
    expect(screen.getByLabelText("State")).toHaveTextContent("1|10|customerId|asc")

    await user.click(screen.getByText("Page 3"))
    await user.click(screen.getByText("Limit 25"))
    expect(screen.getByLabelText("State")).toHaveTextContent("1|25|customerId|asc")
  })
})
