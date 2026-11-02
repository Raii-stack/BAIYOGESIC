import { useCallback, useEffect, useRef } from "react"
import { useSearchParams } from "react-router"

import { isPageSize, type PageSize, type SortOrder } from "../lib/table-sorting"

export default function useDirectoryTableQuery<SortBy extends string>(
  allowedSorts: readonly SortBy[],
  defaultSort: SortBy,
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const setSearchParamsRef = useRef(setSearchParams)
  setSearchParamsRef.current = setSearchParams
  const rawPage = Number(searchParams.get("page") || 1)
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const rawLimit = Number(searchParams.get("limit") || 10)
  const limit: PageSize = isPageSize(rawLimit) ? rawLimit : 10
  const rawSort = searchParams.get("sortBy") as SortBy | null
  const sortBy = rawSort && allowedSorts.includes(rawSort) ? rawSort : defaultSort
  const sortOrder: SortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc"

  useEffect(() => {
    if (
      searchParams.get("page") === String(page)
      && searchParams.get("limit") === String(limit)
      && searchParams.get("sortBy") === sortBy
      && searchParams.get("sortOrder") === sortOrder
    ) return

    setSearchParamsRef.current((current) => {
      const next = new URLSearchParams(current)
      next.set("page", String(page))
      next.set("limit", String(limit))
      next.set("sortBy", sortBy)
      next.set("sortOrder", sortOrder)
      return next
    }, { replace: true })
  }, [limit, page, searchParams, sortBy, sortOrder])

  const update = useCallback((values: { page?: number; limit?: PageSize; sortBy?: SortBy; sortOrder?: SortOrder }) => {
    setSearchParamsRef.current((current) => {
      const next = new URLSearchParams(current)
      if (values.page !== undefined) next.set("page", String(values.page))
      if (values.limit !== undefined) next.set("limit", String(values.limit))
      if (values.sortBy !== undefined) next.set("sortBy", values.sortBy)
      if (values.sortOrder !== undefined) next.set("sortOrder", values.sortOrder)
      return next
    })
  }, [])

  const setPage = useCallback((nextPage: number) => {
    if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage === page) return
    update({ page: nextPage })
  }, [page, update])

  const setLimit = useCallback((nextLimit: PageSize) => {
    if (nextLimit === limit) return
    update({ page: 1, limit: nextLimit })
  }, [limit, update])

  const toggleSort = useCallback((nextSort: SortBy) => {
    const nextOrder: SortOrder = nextSort === sortBy && sortOrder === "asc" ? "desc" : "asc"
    update({ page: 1, sortBy: nextSort, sortOrder: nextOrder })
  }, [sortBy, sortOrder, update])

  return { searchParams, page, limit, sortBy, sortOrder, setPage, setLimit, toggleSort }
}
