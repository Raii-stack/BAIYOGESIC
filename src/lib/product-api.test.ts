import { expect, test } from "vitest"
import { toProduct } from "./product-api"

const row = { prodcode: "PX0001", description: "Widget", unit: "ea" as const, is_deleted: false, stamp: "EDIT admin" }

test.each([undefined, null, "", "invalid", "Infinity"])("missing or invalid price %s stays unavailable instead of NaN", (unitprice) => {
  expect(toProduct({ ...row, unitprice })).toMatchObject({ currentPrice: null, priceEffectiveDate: null })
})

test.each(["25.50", 25.5, 0])("maps numeric price %s and its effective date", (unitprice) => {
  expect(toProduct({ ...row, unitprice, effdate: "2026-11-02" })).toMatchObject({ currentPrice: Number(unitprice), priceEffectiveDate: "2026-11-02" })
})
