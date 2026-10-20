import { expect, test, vi } from "vitest"
import { apiFailure, safeApiMessage } from "./api-errors"

test("replaces internal server details with safe errors while preserving actionable conflicts", () => {
  expect(safeApiMessage(500, { error: { message: "SQL error: password_hash at db.js:42" } })).toBe("The service is temporarily unavailable. Please try again.")
  expect(safeApiMessage(400, { error: { message: "syntax error in column email" } })).toBe("That request could not be completed. Please try again.")
  expect(safeApiMessage(409, { error: { message: "Cannot archive customer while active sales records exist." } })).toContain("active sales records")
})

test("notifies the app when a data API session expires", () => {
  const expired = vi.fn()
  window.addEventListener("hope:session-expired", expired)
  expect(apiFailure(401).message).toContain("session has expired")
  expect(expired).toHaveBeenCalledOnce()
  window.removeEventListener("hope:session-expired", expired)
})
