import { describe, it, expect } from "vitest"
import { truncate } from "./truncate.js"

describe("truncate", () => {
  it("drops the emoji presentation selector so Ink and the terminal agree on width", () => {
    const title = "SHOP-1: \u{1F3D7}️build(deps): bump packages"
    const out = truncate(title, 80)
    expect(out).not.toContain("️")
    expect(out).toBe("SHOP-1: \u{1F3D7}build(deps): bump packages")
  })

  it("still elides the middle of a long string", () => {
    expect(truncate("abcdefghij", 5)).toBe("ab…ij")
  })
})
