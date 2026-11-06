import type { ActiveEmployee, RegistrationNotifications } from "./auth"

type SeenRegistrations = { cutoff: number; ids: Set<string> }

export let activityCache: { data: ActiveEmployee[] | null; checkedAt: number } = { data: null, checkedAt: 0 }
export let registrationCache: { data: RegistrationNotifications | null; checkedAt: number; seen: SeenRegistrations | null } = { data: null, checkedAt: 0, seen: null }

export function clearDashboardLiveCache() {
  activityCache = { data: null, checkedAt: 0 }
  registrationCache = { data: null, checkedAt: 0, seen: null }
}
