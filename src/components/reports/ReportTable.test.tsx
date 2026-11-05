import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import ReportTable from "./ReportTable"

afterEach(cleanup)

test.each([undefined, null, "invalid", Infinity])("unavailable report values %s render as a dash", (price) => {
  render(<ReportTable report="Product Master List" rows={[{ prodcode: "P001", ...(price === undefined ? {} : { currentprice: price }) }]} loading={false} error="" onRetry={() => {}} />)
  const row = screen.getByRole("row", { name: /P001/ })
  expect(within(row).getAllByRole("cell").slice(1).map((cell) => cell.textContent)).toEqual(["—", "—", "—"])
})
