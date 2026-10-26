import { useEffect } from "react"
import { useSearchParams } from "react-router"

export default function usePageQuery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = Number(searchParams.get("page") || 1)
  const page = Number.isSafeInteger(value) && value > 0 ? value : 1

  useEffect(() => {
    if (searchParams.get("page") === String(page)) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("page", String(page))
      return next
    }, { replace: true })
  }, [page, searchParams, setSearchParams])

  const setPage = (nextPage: number) => {
    if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage === page) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("page", String(nextPage))
      return next
    })
  }

  return [page, setPage] as const
}
