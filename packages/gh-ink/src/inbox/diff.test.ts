import { describe, expect, it } from "vitest"

import { diffSections, keyOf, summariseDiff } from "./diff.js"
import type { GHItem, Section } from "./inbox.js"

/*
 * What is pinned here is that a refresh can SAY what it did.
 *
 * Before this, applying a refresh swapped one list for another and left the
 * reader to spot the difference from memory of a frame the terminal had already
 * scrolled away. Every case below is one of the three things that can happen to
 * a row, plus the two ways the diff can lie about it: flagging a row that only
 * got older, and flagging the headers that moved because a real row did.
 */

const item = (over: Partial<GHItem> & { url: string }): GHItem => ({
  kind: "pr",
  number: 1,
  title: "t",
  repo: "kud/a",
  health: "waiting",
  age: "1d",
  ts: 1_000,
  unresolved: 0,
  conversation: 0,
  indent: false,
  ...over,
})

const section = (items: GHItem[]): Section[] => [
  { id: "open", label: "Open", items },
]

const a = item({ url: "u/a", number: 1 })
const b = item({ url: "u/b", number: 2 })
const c = item({ url: "u/c", number: 3 })

describe("keyOf", () => {
  it("gives rows their URL as identity", () => {
    expect(keyOf(a)).toBe("u/a")
  })

  // Headers exist because rows do. If they carried identity, one arriving PR
  // would report itself twice: once as the row, once as the header that had to
  // appear to hold it.
  it("refuses identity to anything computed from the rows around it", () => {
    expect(
      keyOf({ kind: "repo-header", repo: "kud/a", age: "", indent: false }),
    ).toBeNull()
    expect(keyOf({ kind: "show-more", hidden: [], indent: false })).toBeNull()
  })
})

describe("diffSections", () => {
  it("calls a row that was not there before new", () => {
    const { transients, counts } = diffSections(section([a]), section([a, b]))
    expect(transients.get("u/b")).toBe("in")
    expect(counts).toEqual({ added: 1, removed: 0, changed: 0 })
  })

  it("calls a row that has gone gone", () => {
    const { transients, counts } = diffSections(section([a, b]), section([a]))
    expect(transients.get("u/b")).toBe("out")
    expect(counts).toEqual({ added: 0, removed: 1, changed: 0 })
  })

  it("calls a row whose rendered state moved changed", () => {
    const before = section([item({ url: "u/a", health: "waiting" })])
    const after = section([item({ url: "u/a", health: "approved" })])
    expect(diffSections(before, after).transients.get("u/a")).toBe("changed")
  })

  /*
   * The failure that would make the whole feature worthless. `age` is a relative
   * string, so it drifts on EVERY fetch — and `ts` moves whenever anything
   * touches the item. Comparing either would mark most of the list as changed
   * each time, and a marker that fires constantly is one you learn to ignore,
   * which is worse than having none.
   */
  it("does not call a row changed just because it got older", () => {
    const before = section([item({ url: "u/a", age: "1d", ts: 1_000 })])
    const after = section([item({ url: "u/a", age: "2d", ts: 5_000 })])
    expect(diffSections(before, after).transients.size).toBe(0)
  })

  it("reports an unchanged list as nothing at all", () => {
    expect(diffSections(section([a, b]), section([a, b])).counts).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
    })
  })

  it("handles all three at once", () => {
    const before = section([a, b])
    const after = section([item({ url: "u/a", health: "approved" }), c])
    const { transients, counts } = diffSections(before, after)
    expect(transients.get("u/a")).toBe("changed")
    expect(transients.get("u/b")).toBe("out")
    expect(transients.get("u/c")).toBe("in")
    expect(counts).toEqual({ added: 1, removed: 1, changed: 1 })
  })

  it("treats a first paint as all new, not as an empty diff", () => {
    expect(diffSections([], section([a, b])).counts.added).toBe(2)
  })
})

describe("diffSections union", () => {
  /*
   * A departing row has to be rendered somewhere for the hold, and the only
   * place that means anything is where it actually was. Appended to the end it
   * reads as an arrival — the opposite of what it is saying.
   */
  it("keeps a departing row at the index it held", () => {
    const { union } = diffSections(section([a, b, c]), section([a, c]))
    expect(union[0]!.items.map((i) => keyOf(i))).toEqual(["u/a", "u/b", "u/c"])
  })

  it("keeps several departing rows in their original order", () => {
    const { union } = diffSections(section([a, b, c]), section([a]))
    expect(union[0]!.items.map((i) => keyOf(i))).toEqual(["u/a", "u/b", "u/c"])
  })

  it("leaves the sections untouched when nothing departed", () => {
    const next = section([a, b])
    expect(diffSections(section([a]), next).union).toBe(next)
  })

  // Bringing the row back would mean bringing its section header back with it,
  // and a section reappearing to show you something leaving reads as arrival.
  it("drops a departing row whose whole section has gone", () => {
    const before: Section[] = [
      { id: "open", label: "Open", items: [a] },
      { id: "review", label: "Review", items: [b] },
    ]
    const after: Section[] = [{ id: "open", label: "Open", items: [a] }]
    const { union, transients } = diffSections(before, after)
    expect(transients.get("u/b")).toBe("out")
    expect(union.flatMap((s) => s.items.map((i) => keyOf(i)))).toEqual(["u/a"])
  })
})

describe("summariseDiff", () => {
  // Words, not colour. The header line has to mean the same thing to a reader
  // who cannot separate the orange from the grey.
  it("names each kind of change in words", () => {
    expect(summariseDiff({ added: 2, removed: 1, changed: 3 })).toBe(
      "2 new · 1 gone · 3 moved",
    )
  })

  it("omits the kinds that did not happen", () => {
    expect(summariseDiff({ added: 1, removed: 0, changed: 0 })).toBe("1 new")
  })

  it("says nothing when nothing moved", () => {
    expect(summariseDiff({ added: 0, removed: 0, changed: 0 })).toBe("")
  })
})
