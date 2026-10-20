import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import SuccessToast from "./SuccessToast"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test("automatically dismisses a success notification", () => {
  vi.useFakeTimers()
  const onClose = vi.fn()
  render(<SuccessToast message="Customer updated successfully." onClose={onClose} />)

  expect(screen.getByRole("status")).toHaveTextContent("Customer updated successfully.")
  act(() => vi.advanceTimersByTime(4499))
  expect(onClose).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(onClose).toHaveBeenCalledOnce()
})
