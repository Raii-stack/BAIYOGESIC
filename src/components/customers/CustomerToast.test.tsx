import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"

import CustomerToast from "./CustomerToast"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

test("automatically dismisses a customer notification", () => {
  vi.useFakeTimers()
  const onClose = vi.fn()
  render(<CustomerToast message="Customer updated successfully." onClose={onClose} />)

  expect(screen.getByRole("status")).toHaveTextContent("Customer updated successfully.")
  act(() => vi.advanceTimersByTime(4499))
  expect(onClose).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1))
  expect(onClose).toHaveBeenCalledOnce()
})
