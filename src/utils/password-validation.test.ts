import { describe, expect, it } from "vitest"
import { getPasswordStrength, strengthLevels } from "./password"
import { emailOk } from "./validation"

describe("password strength scoring", () => {
  it("returns level 0 for empty input and scores progressive complexity criteria", () => {
    expect(getPasswordStrength("")).toBe(0)
    expect(strengthLevels[getPasswordStrength("")].label).toBe("Not set")

    expect(getPasswordStrength("abc")).toBe(1)
    expect(strengthLevels[getPasswordStrength("abc")].label).toBe("Weak")

    expect(getPasswordStrength("abcdefgh")).toBe(1)
    expect(getPasswordStrength("Abcdefgh")).toBe(2)
    expect(getPasswordStrength("Abcdefgh1!")).toBe(3)
    expect(getPasswordStrength("Abcdefghijkl1!")).toBe(4)
    expect(strengthLevels[4].label).toBe("Very strong")
  })
})

describe("emailOk validation", () => {
  it("accepts standard work email addresses and rejects malformed strings", () => {
    expect(emailOk("alex.montes@hope.inc")).toBe(true)
    expect(emailOk("user+tag@sub.domain.co")).toBe(true)

    expect(emailOk("")).toBe(false)
    expect(emailOk("missing-at-sign.com")).toBe(false)
    expect(emailOk("user@nodot")).toBe(false)
    expect(emailOk("user name@hope.inc")).toBe(false)
  })
})
