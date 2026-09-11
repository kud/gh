import { describe, expect, it } from "vitest"

import { filesOf, sizeOf, sizePartsOf } from "./core.js"

describe("sizeOf", () => {
  it("puts additions before deletions, always", () => {
    expect(sizeOf({ additions: 412, deletions: 38 })).toBe("+412 -38")
  })

  /*
   * Order is a channel, and it is the one that survives when hue does not.
   * Reordering by magnitude would make the position meaningless and leave a
   * colourblind reader with nothing but the signs.
   */
  it("does not reorder when deletions are the larger number", () => {
    expect(sizeOf({ additions: 3, deletions: 900 })).toBe("+3 -900")
  })

  it("uses an ASCII hyphen, not a typographic minus", () => {
    // U+2212 is ambiguous-width in some fonts, this codebase holds a
    // single-column invariant on glyphs, and `git diff --stat` uses the hyphen.
    const size = sizeOf({ additions: 1, deletions: 1 }) ?? ""
    expect(size).toContain("-")
    expect(size).not.toContain("−")
  })

  it("is absent rather than zero when the fetch has not answered", () => {
    // A PR of "+0 -0" and a PR we have not measured are different claims.
    expect(sizeOf({})).toBeNull()
    expect(sizeOf({ additions: 4 })).toBeNull()
  })

  it("keeps four digits exact and compacts from five", () => {
    // +412 and +4120 are the difference between a review and a day; past that
    // the digits stop being weighed and three columns say enough.
    expect(sizeOf({ additions: 9999, deletions: 1000 })).toBe("+9999 -1000")
    expect(sizeOf({ additions: 12345, deletions: 3456 })).toBe("+12k -3456")
    expect(sizeOf({ additions: 10000, deletions: 250000 })).toBe("+10k -250k")
  })

  /*
   * The coloured form is the plain string split at its one space, so a surface
   * painting each half can never disagree with one printing the whole: same
   * sign, same compaction, same absence while unmeasured.
   */
  it("splits into the two halves the string is made of", () => {
    expect(sizePartsOf({ additions: 412, deletions: 38 })).toEqual({
      added: "+412",
      removed: "-38",
    })
    expect(sizePartsOf({ additions: 12345, deletions: 0 })).toEqual({
      added: "+12k",
      removed: "-0",
    })
    expect(sizePartsOf({ additions: 4 })).toBeNull()
  })
})

describe("filesOf", () => {
  it("says file, not files, for one", () => {
    expect(filesOf({ changedFiles: 1 })).toBe("1 file")
    expect(filesOf({ changedFiles: 7 })).toBe("7 files")
  })

  it("is absent while unmeasured", () => {
    expect(filesOf({})).toBeNull()
  })
})
