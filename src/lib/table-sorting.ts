export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export type SortOrder = "asc" | "desc"

export function isPageSize(value: number): value is PageSize {
  return PAGE_SIZE_OPTIONS.includes(value as PageSize)
}
