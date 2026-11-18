import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import useDebouncedValue from "./useDebouncedValue"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

function DebouncedProbe({ value, delayMs }: { value: string; delayMs?: number }) {
  const debounced = useDebouncedValue(value, delayMs)
  return <output aria-label="Debounced">{debounced}</output>
}

describe("hooks/useDebouncedValue ([S2-UIX-01])", () => {
  test("delays propagation until the debounce interval elapses and cancels intermediate updates", () => {
    vi.useFakeTimers()
    const { rerender } = render(<DebouncedProbe value="a" delayMs={300} />)

    expect(screen.getByLabelText("Debounced")).toHaveTextContent("a")

    rerender(<DebouncedProbe value="ac" delayMs={300} />)
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByLabelText("Debounced")).toHaveTextContent("a")

    rerender(<DebouncedProbe value="acme" delayMs={300} />)
    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(screen.getByLabelText("Debounced")).toHaveTextContent("a")

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByLabelText("Debounced")).toHaveTextContent("acme")
  })

  test("defaults debounce interval to 450ms", () => {
    vi.useFakeTimers()
    const { rerender } = render(<DebouncedProbe value="init" />)

    rerender(<DebouncedProbe value="next" />)
    act(() => {
      vi.advanceTimersByTime(449)
    })
    expect(screen.getByLabelText("Debounced")).toHaveTextContent("init")

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByLabelText("Debounced")).toHaveTextContent("next")
  })
})
