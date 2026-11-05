import { afterEach, expect, test, vi } from "vitest"
import { authApi } from "./auth"

afterEach(() => vi.unstubAllGlobals())
test.each([{ total: 1 }, { total: -1, registrations: [] }, { total: 1, registrations: [{ userId: "1", name: "Applicant", email: "staff@example.com", createdAt: "invalid" }] }])("rejects malformed notification data", async (data) => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data }))))
  await expect(authApi.registrationNotifications()).rejects.toThrow("Unable to load registration notifications.")
})
