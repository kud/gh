import { describe, it, expect } from "vitest"
import { colors } from "@kud/ink-ui"
import { meterCellsOf, weightTierOf } from "./weight.js"

const tierOf = (additions: number, deletions: number, changedFiles: number) =>
  weightTierOf({ additions, deletions, changedFiles })

const glyphsOf = (tier: 0 | 1 | 2 | 3 | 4) =>
  meterCellsOf(tier)
    .map((c) => c.glyph)
    .join("")

describe("weightTierOf", () => {
  it("steps the lines tier at 10, 50, 250 and 1000, on lines alone", () => {
    // Three files, so the files tier is 1 and never the heavier reading past
    // the first step — and never under the 1–2 file cap either.
    expect(tierOf(0, 0, 3)).toBe(1)
    expect(tierOf(9, 0, 3)).toBe(1)
    expect(tierOf(10, 0, 3)).toBe(1)
    expect(tierOf(49, 0, 3)).toBe(1)
    expect(tierOf(50, 0, 3)).toBe(2)
    expect(tierOf(249, 0, 3)).toBe(2)
    expect(tierOf(250, 0, 3)).toBe(3)
    expect(tierOf(999, 0, 3)).toBe(3)
    expect(tierOf(1000, 0, 3)).toBe(4)
  })

  it("puts the lines boundaries exactly where a one-file diff shows them", () => {
    expect(tierOf(9, 0, 1)).toBe(0)
    expect(tierOf(10, 0, 1)).toBe(1)
    expect(tierOf(49, 0, 1)).toBe(1)
    expect(tierOf(50, 0, 1)).toBe(2)
    expect(tierOf(249, 0, 1)).toBe(2)
    expect(tierOf(250, 0, 1)).toBe(3)
    expect(tierOf(999, 0, 1)).toBe(3)
  })

  it("counts deletions as lines too", () => {
    expect(tierOf(5, 4, 1)).toBe(0)
    expect(tierOf(5, 5, 1)).toBe(1)
    expect(tierOf(0, 1000, 3)).toBe(4)
  })

  it("steps the files tier at 2, 5, 15 and 40, inclusive", () => {
    expect(tierOf(1, 0, 0)).toBe(0)
    expect(tierOf(1, 0, 2)).toBe(0)
    expect(tierOf(1, 0, 3)).toBe(1)
    expect(tierOf(1, 0, 5)).toBe(1)
    expect(tierOf(1, 0, 6)).toBe(2)
    expect(tierOf(1, 0, 15)).toBe(2)
    expect(tierOf(1, 0, 16)).toBe(3)
    expect(tierOf(1, 0, 40)).toBe(3)
    expect(tierOf(1, 0, 41)).toBe(4)
  })

  it("takes the heavier of the two readings", () => {
    // A forty-one-file rename of one line each is huge on files alone.
    expect(tierOf(41, 0, 41)).toBe(4)
    // Few lines across many files, many lines across few.
    expect(tierOf(12, 9, 16)).toBe(3)
    expect(tierOf(318, 141, 9)).toBe(3)
  })

  it("caps a one- or two-file diff at large, however many lines", () => {
    // A vendored SDK: +5039 -0 in two files.
    expect(tierOf(5039, 0, 2)).toBe(3)
    expect(tierOf(1000, 0, 1)).toBe(3)
    expect(tierOf(100000, 50000, 1)).toBe(3)
    // Three files is past the cap.
    expect(tierOf(1000, 0, 3)).toBe(4)
  })

  it("refuses to guess when any of the three numbers is missing", () => {
    expect(weightTierOf({})).toBeNull()
    expect(weightTierOf({ additions: 3, deletions: 1 })).toBeNull()
    expect(weightTierOf({ additions: 3, changedFiles: 1 })).toBeNull()
    expect(weightTierOf({ deletions: 3, changedFiles: 1 })).toBeNull()
  })
})

describe("meterCellsOf", () => {
  it("lights cells as a rising staircase over a flat baseline", () => {
    expect(glyphsOf(0)).toBe("▁▁▁▁")
    expect(glyphsOf(1)).toBe("▂▁▁▁")
    expect(glyphsOf(2)).toBe("▂▄▁▁")
    expect(glyphsOf(3)).toBe("▂▄▆▁")
    expect(glyphsOf(4)).toBe("▂▄▆█")
  })

  it("draws lit cells in secondary and unlit ones in muted", () => {
    expect(meterCellsOf(2).map((c) => c.color)).toEqual([
      colors.secondary,
      colors.secondary,
      colors.muted,
      colors.muted,
    ])
  })

  it("turns every lit cell warning on a huge PR, and only then", () => {
    expect(meterCellsOf(4).map((c) => c.color)).toEqual(
      Array(4).fill(colors.warning),
    )
    expect(meterCellsOf(3).map((c) => c.color)).not.toContain(colors.warning)
  })
})
