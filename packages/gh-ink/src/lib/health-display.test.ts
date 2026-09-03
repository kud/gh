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

  /*
   * Every glyph is exactly one column wide.
   *
   * This cell sits in the aligned zone left of the title, and every key and title
   * on screen lines up off it — so a glyph that renders two columns wide shifts
   * only the rows carrying it, which is the one failure a fixed cell exists to
   * prevent. It is not hypothetical: `merged` and `closed` are Nerd Font icons
   * chosen for meaning rather than for width, and the next one added will be too.
   *
   * Codepoint width, not rendered width — a font that draws a PUA glyph wide is
   * beyond reach from here, and the string length is what the layout maths reads.
   */
  it("keeps every glyph to a single column", () => {
    for (const h of ALL) expect([...healthGlyph(h)]).toHaveLength(1)
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
