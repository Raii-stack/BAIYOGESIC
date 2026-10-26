import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation, useNavigate } from "react-router"
import { afterEach, expect, test } from "vitest"
import usePageQuery from "./usePageQuery"

afterEach(cleanup)

function Pager() {
  const [page, setPage] = usePageQuery()
  const location = useLocation()
  const navigate = useNavigate()
  return <>
    <output aria-label="Page">{page}</output>
    <output aria-label="URL">{location.search}</output>
    <button onClick={() => setPage(page + 1)}>Next</button>
    <button onClick={() => setPage(1)}>Reset</button>
    <button onClick={() => navigate(-1)}>Back</button>
  </>
}

test("restores the page, preserves other queries, and supports browser history", async () => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={["/customers?view=directory&page=3&search=acme&custom=keep"]}><Pager /></MemoryRouter>)
  expect(screen.getByLabelText("Page")).toHaveTextContent("3")
  await user.click(screen.getByText("Next"))
  expect(screen.getByLabelText("Page")).toHaveTextContent("4")
  expect(screen.getByLabelText("URL")).toHaveTextContent("view=directory&page=4&search=acme&custom=keep")
  await user.click(screen.getByText("Back"))
  expect(screen.getByLabelText("Page")).toHaveTextContent("3")
  await user.click(screen.getByText("Reset"))
  expect(screen.getByLabelText("URL")).toHaveTextContent("page=1&search=acme&custom=keep")
})

test.each(["", "abc", "0", "-2", "1.5", "Infinity", "9007199254740992"])("normalizes invalid or missing page %s", async (value) => {
  render(<MemoryRouter initialEntries={[`/customers?view=directory&page=${value}`]}><Pager /></MemoryRouter>)
  expect(screen.getByLabelText("Page")).toHaveTextContent("1")
  await waitFor(() => expect(screen.getByLabelText("URL")).toHaveTextContent("view=directory&page=1"))
})
