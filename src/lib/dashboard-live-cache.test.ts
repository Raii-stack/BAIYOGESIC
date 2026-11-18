import { afterEach, describe, expect, test } from "vitest"
import {
  activityCache,
  registrationCache,
  clearDashboardLiveCache,
} from "./dashboard-live-cache"

afterEach(() => {
  clearDashboardLiveCache()
})

describe("dashboard-live-cache ([S4-DEV-09])", () => {
  test("clears both activityCache and registrationCache cleanly", () => {
    activityCache.data = [{ empno: "00001", firstname: "John", lastname: "Smith", status: "online" } as never]
    activityCache.checkedAt = 123456
    registrationCache.data = { pendingCount: 2, pendingUsers: [] } as never
    registrationCache.checkedAt = 654321
    registrationCache.seen = { cutoff: 100, ids: new Set(["u-1"]) }

    clearDashboardLiveCache()

    expect(activityCache).toEqual({ data: null, checkedAt: 0 })
    expect(registrationCache).toEqual({ data: null, checkedAt: 0, seen: null })
  })
})
