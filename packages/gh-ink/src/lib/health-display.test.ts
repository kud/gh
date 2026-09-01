import { describe, expect, it } from "vitest"
import {
  healthColor,
  healthDisplay,
  healthGlyph,
  healthLegend,
} from "./health-display.js"
import { PIN_MARK } from "../inbox/inbox.js"
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

  // The invariant the map above states for itself, extended one cell right. The
  // turn column sits immediately beside the health column, so a mark that is
  // unique within the health map and equal to one of its glyphs is exactly as
  // unreadable as a duplicate inside it — and the first pin mark was `!`, which
  // is `conflict`, in the same orange.
  it("keeps the pin mark distinct from every health glyph", () => {
    expect(ALL.map(healthGlyph)).not.toContain(PIN_MARK)
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
