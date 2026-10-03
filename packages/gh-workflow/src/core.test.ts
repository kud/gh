import { describe, expect, it } from "vitest"

import {
  filesOf,
  filterByOrigin,
  filterBySearch,
  layoutGHItems,
  NEEDS_YOU_SECTION,
  sizeOf,
  sizePartsOf,
  type GHItem,
} from "./core.js"

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

/*
 * The needs-you tab lays out by the host's marker, never by whose-move: health,
 * standing and lastActor cannot move a row between Decide and Merge, because
 * the host already decided where each row belongs. These pin the two bands,
 * their order, their labels, and that the filters re-lay them rather than
 * falling back to whose-move.
 */
const needsYouItem = (over: Partial<GHItem> = {}): GHItem => ({
  kind: "pr",
  number: 1,
  title: "a pull request",
  repo: "acme/widget-store",
  url: "https://github.com/acme/widget-store/pull/1",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  ...over,
})

const bandLabels = (sectionId = NEEDS_YOU_SECTION) =>
  layoutGHItems(
    [
      needsYouItem({
        number: 1,
        needsYou: { band: "merge" },
      }),
      needsYouItem({
        number: 2,
        needsYou: { band: "decide", decision: "Approve the migration plan" },
      }),
    ],
    sectionId,
    "kud",
  )
    .filter((i) => i.kind === "subgroup-header")
    .map((i) => (i.kind === "subgroup-header" ? i.label : ""))

describe("needs-you layout", () => {
  it("lays Decide before Merge whatever order the rows arrive in", () => {
    expect(bandLabels()).toEqual(["Decide (1)", "Merge (1)"])
  })

  it("counts each band in its header", () => {
    const laid = layoutGHItems(
      [
        needsYouItem({ number: 1, needsYou: { band: "decide", decision: "a" } }),
        needsYouItem({ number: 2, needsYou: { band: "decide", decision: "b" } }),
        needsYouItem({ number: 3, needsYou: { band: "merge" } }),
      ],
      NEEDS_YOU_SECTION,
      "kud",
    )
    const labels = laid
      .filter((i) => i.kind === "subgroup-header")
      .map((i) => (i.kind === "subgroup-header" ? i.label : ""))
    expect(labels).toEqual(["Decide (2)", "Merge (1)"])
  })

  it("omits an empty band rather than naming it with a zero", () => {
    const laid = layoutGHItems(
      [needsYouItem({ number: 1, needsYou: { band: "merge" } })],
      NEEDS_YOU_SECTION,
      "kud",
    )
    const labels = laid
      .filter((i) => i.kind === "subgroup-header")
      .map((i) => (i.kind === "subgroup-header" ? i.label : ""))
    expect(labels).toEqual(["Merge (1)"])
  })

  // A flagged row with no band is still waiting on somebody: it reads as
  // `decide` rather than falling out of both bands, and a row the host never
  // flagged at all is laid out beside it rather than dropped.
  it("files an unbanded row under Decide", () => {
    const laid = layoutGHItems(
      [needsYouItem({ number: 1 })],
      NEEDS_YOU_SECTION,
      "kud",
    )
    const labels = laid
      .filter((i) => i.kind === "subgroup-header")
      .map((i) => (i.kind === "subgroup-header" ? i.label : ""))
    expect(labels).toEqual(["Decide (1)"])
  })

  it("leaves every other section on whose-move bands", () => {
    expect(bandLabels("mine")).not.toContain("Decide (1)")
  })

  it("keeps the two bands through filterByOrigin", () => {
    const sections = [
      {
        id: NEEDS_YOU_SECTION,
        label: "Needs you",
        items: layoutGHItems(
          [
            needsYouItem({ number: 1, needsYou: { band: "decide", decision: "a" } }),
            needsYouItem({ number: 2, needsYou: { band: "merge" } }),
          ],
          NEEDS_YOU_SECTION,
          "kud",
        ),
      },
    ]
    const kept = filterByOrigin(sections, "matched", () => true, "kud")
    const labels = kept[0]!.items
      .filter((i) => i.kind === "subgroup-header")
      .map((i) => (i.kind === "subgroup-header" ? i.label : ""))
    expect(labels).toEqual(["Decide (1)", "Merge (1)"])
  })

  // The decision line is what the row IS on this tab, so a typed search has
  // to find it: searching the decision's own words keeps the row, and the
  // band header is re-laid around what survived rather than lost.
  it("finds the decision text through filterBySearch", () => {
    const sections = [
      {
        id: NEEDS_YOU_SECTION,
        label: "Needs you",
        items: layoutGHItems(
          [
            needsYouItem({
              number: 1,
              title: "a pull request",
              needsYou: { band: "decide", decision: "Approve the migration plan" },
            }),
            needsYouItem({
              number: 2,
              title: "another one",
              needsYou: { band: "merge" },
            }),
          ],
          NEEDS_YOU_SECTION,
          "kud",
        ),
      },
    ]
    const kept = filterBySearch(sections, "migration", "kud")
    expect(kept).toHaveLength(1)
    const labels = kept[0]!.items
      .filter((i) => i.kind === "subgroup-header")
      .map((i) => (i.kind === "subgroup-header" ? i.label : ""))
    expect(labels).toEqual(["Decide (1)"])
    expect(
      kept[0]!.items.some(
        (i) => (i.kind === "pr" || i.kind === "issue") && i.number === 1,
      ),
    ).toBe(true)
  })
})
