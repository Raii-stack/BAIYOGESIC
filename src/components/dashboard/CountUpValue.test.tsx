import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import CountUpValue from "./CountUpValue"

let enter: (entries: { isIntersecting: boolean }[]) => void
let tick: FrameRequestCallback
const disconnect = vi.fn()
const requestFrame = vi.fn((callback: FrameRequestCallback) => { tick = callback; return 1 })
const cancelFrame = vi.fn()

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", requestFrame)
  vi.stubGlobal("cancelAnimationFrame", cancelFrame)
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: typeof enter) { enter = callback }
    observe = vi.fn()
    disconnect = disconnect
  })
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

test.each([
  ["1,248", "0", "1,092"],
  ["$84.2k", "$0.0k", "$73.7k"],
  ["98.4%", "0.0%", "86.1%"],
  ["1,200+", "0+", "1,050+"],
  ["-$1,200.00", "-$0.00", "-$1,050.00"],
])("counts %s with its formatting and ease-out timing", (value, zero, halfway) => {
  const { container } = render(<CountUpValue value={value} />)
  const visual = container.querySelector('[aria-hidden="true"]')!
  expect(container.querySelector(".sr-only")).toHaveTextContent(value)
  expect(visual).toHaveTextContent(zero)
  act(() => enter([{ isIntersecting: false }]))
  expect(requestFrame).not.toHaveBeenCalled()
  act(() => enter([{ isIntersecting: true }]))
  act(() => tick(100))
  act(() => tick(850))
  expect(visual.textContent).toBe(halfway)
  act(() => tick(1600))
  expect(visual.textContent).toBe(value)
  const calls = requestFrame.mock.calls.length
  act(() => enter([{ isIntersecting: true }]))
  expect(requestFrame).toHaveBeenCalledTimes(calls)
  expect(disconnect).toHaveBeenCalled()
})

test.each(["0", "$0", "—"])("leaves %s unchanged without animation", (value) => {
  const { container } = render(<CountUpValue value={value} />)
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(value)
  expect(requestFrame).not.toHaveBeenCalled()
})

test("shows final values immediately with reduced motion", () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList)
  const { container } = render(<CountUpValue value="$84.2k" />)
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("$84.2k")
  expect(requestFrame).not.toHaveBeenCalled()
})

test("shows cached metrics without restarting the animation", () => {
  const { container } = render(<CountUpValue value="$84.2k" animate={false} />)
  expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("$84.2k")
  expect(requestFrame).not.toHaveBeenCalled()
})

test("animates on mount without IntersectionObserver and cleans up on unmount", () => {
  vi.stubGlobal("IntersectionObserver", undefined)
  const { unmount } = render(<CountUpValue value="1,248" />)
  expect(requestFrame).toHaveBeenCalledOnce()
  unmount()
  expect(cancelFrame).toHaveBeenCalledWith(1)
})

test("cancels the old animation when a new value arrives", () => {
  const { container, rerender, unmount } = render(<CountUpValue value="1,248" />)
  act(() => enter([{ isIntersecting: true }]))
  act(() => tick(0))
  rerender(<CountUpValue value="2,000+" />)
  expect(cancelFrame).toHaveBeenCalledWith(1)
  const visual = container.querySelector('[aria-hidden="true"]')!
  expect(visual.textContent).toBe("0+")
  act(() => enter([{ isIntersecting: true }]))
  act(() => tick(0))
  act(() => tick(1500))
  expect(visual.textContent).toBe("2,000+")
  unmount()
  expect(disconnect).toHaveBeenCalled()
})
