import { useEffect, useRef } from "react"

export default function CountUpValue({ value, animate: shouldAnimate = true }: { value: string; animate?: boolean }) {
  const numberRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = numberRef.current
    const parts = value.match(/^(.*?)(\d[\d,]*(?:\.\d+)?)([^\d]*)$/)
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!shouldAnimate || !element || !parts || motion?.matches || document.documentElement.dataset.workspaceMotion === "off") return

    const [, prefix, number, suffix] = parts
    const target = Number(number.replaceAll(",", ""))
    if (!Number.isFinite(target) || target === 0) return

    const decimals = number.split(".")[1]?.length ?? 0
    const formatter = new Intl.NumberFormat("en-US", {
      useGrouping: number.includes(","),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    let frame = 0
    let started = false
    let startTime: number | undefined
    let observer: IntersectionObserver | undefined

    const finish = () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      element.textContent = value
    }
    const animate = (time: number) => {
      startTime ??= time
      const progress = Math.min((time - startTime) / 1500, 1)
      if (progress === 1) {
        finish()
        return
      }
      const amount = target * (1 - (1 - progress) ** 3)
      element.textContent = `${prefix}${formatter.format(amount)}${suffix}`
      frame = requestAnimationFrame(animate)
    }
    const start = () => {
      if (started) return
      started = true
      observer?.disconnect()
      frame = requestAnimationFrame(animate)
    }

    element.textContent = `${prefix}${formatter.format(0)}${suffix}`
    if (typeof IntersectionObserver === "undefined") {
      start()
    } else {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) start()
      })
      observer.observe(element)
    }
    motion?.addEventListener("change", finish)
    window.addEventListener("hope:motion-change", finish)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      motion?.removeEventListener("change", finish)
      window.removeEventListener("hope:motion-change", finish)
    }
  }, [value, shouldAnimate])

  return (
    <>
      <span className="sr-only">{value}</span>
      <span ref={numberRef} aria-hidden="true">{value}</span>
    </>
  )
}
