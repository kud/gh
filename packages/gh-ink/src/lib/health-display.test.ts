import { describe, expect, it } from "vitest"
import {
  healthColor,
  healthDisplay,
  healthGlyph,
  healthLegend,
} from "./health-display.js"
import type { Health } from "@kud/gh"

const ALL: Health[] = [
  "ci-fail",
  "conflict",
  "changes-req",
  "threads",
  "pending",
  "approved",
  "waiting",
  "draft",
  "merged",
  "closed",
  "none",
]

describe("healthDisplay", () => {
  it("covers every health token", () => {
    for (const h of ALL) expect(healthDisplay[h]).toBeDefined()
  })

  it("gives every non-blank state a distinct glyph (colourblind invariant)", () => {
    const glyphs = ALL.filter((h) => h !== "none").map(healthGlyph)
    expect(new Set(glyphs).size).toBe(glyphs.length)
  })

  it("exposes glyph and colour accessors", () => {
    expect(healthGlyph("approved")).toBe("✓")
    expect(healthColor("ci-fail")).toBe(healthDisplay["ci-fail"].color)
  })

  it("legend omits none and lists actionable states first", () => {
    const keys = healthLegend.map(([h]) => h)
    expect(keys).not.toContain("none")
    expect(keys[0]).toBe("approved")
  })
})
