import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect } from "vitest"
import { SidePanel, railCapacity, counts, type Sidebar } from "./side-panel.js"

/*
 * The rail is fixed to the list's height, and Ink's answer to more rows than
 * height is to cut them — silently. That is the one failure this component
 * cannot be allowed to have: a roadmap quietly missing its last three
 * initiatives looks exactly like a roadmap that has none, and an initiative
 * being invisible is the whole reason the rail was built.
 */
const rail = (n: number): Sidebar => ({
  title: "Initiatives",
  rows: Array.from({ length: n }, (_, i) => ({
    key: `PROJ-${100 + i}`,
    label: `initiative number ${i}`,
    live: i,
  })),
})

const frameOf = (node: React.ReactElement) => render(node).lastFrame() ?? ""

describe("counts", () => {
  it("says how far through, then how much is moving", () => {
    expect(counts({ key: "P-1", label: "x", done: 4, total: 9, live: 1 })).toBe(
      "4/9 · 1 live",
    )
  })

  // A numerator with no denominator is not progress, it is a number.
  it("refuses to draw half a fraction", () => {
    expect(counts({ key: "P-1", label: "x", done: 4, live: 1 })).toBe("1 live")
    expect(counts({ key: "P-1", label: "x", total: 9, live: 1 })).toBe("1 live")
  })

  // The pair can be unknown while `live` is known: `live` is what the board
  // already drew, and progress needs asking Jira a second time.
  it("says what it does know when the other half is missing", () => {
    expect(counts({ key: "P-1", label: "x", live: 2 })).toBe("2 live")
    expect(counts({ key: "P-1", label: "x", done: 0, total: 3 })).toBe("0/3")
  })

  // An initiative that is 4/9 with nothing moving is the one you most want to
  // notice, so a counted zero is printed rather than folded away.
  it("prints a zero it actually counted", () => {
    expect(counts({ key: "P-1", label: "x", done: 4, total: 9, live: 0 })).toBe(
      "4/9 · 0 live",
    )
  })

  it("says nothing at all when nothing was counted", () => {
    expect(counts({ key: "P-1", label: "x" })).toBe("")
  })
})

describe("railCapacity", () => {
  it("takes every row when they all fit", () => {
    // 2 heading lines + 3 rows × 3 lines
    expect(railCapacity(11, 3)).toBe(3)
  })

  // One fewer than physically fits, to buy the line that says how many are left.
  it("gives up a row to pay for the overflow count", () => {
    expect(railCapacity(11, 9)).toBe(2)
  })

  it("never returns a negative count on a rail with no room at all", () => {
    expect(railCapacity(1, 9)).toBe(0)
    expect(railCapacity(0, 9)).toBe(0)
  })
})

describe("SidePanel", () => {
  it("draws every row when the height allows", () => {
    const frame = frameOf(<SidePanel sidebar={rail(3)} height={11} />)
    for (const key of ["PROJ-100", "PROJ-101", "PROJ-102"])
      expect(frame).toContain(key)
    expect(frame).not.toContain("more")
  })

  it("says how many it could not draw", () => {
    const frame = frameOf(<SidePanel sidebar={rail(9)} height={11} />)
    expect(frame).toContain("PROJ-100")
    expect(frame).toContain("+7 more")
  })

  // An unconstrained rail has no reason to hold anything back.
  it("draws everything when given no height", () => {
    const frame = frameOf(<SidePanel sidebar={rail(9)} />)
    expect(frame).toContain("PROJ-108")
    expect(frame).not.toContain("more")
  })

  // "Nothing open" and "we could not tell you" are different claims, and an
  // empty rail with no words is indistinguishable from a broken one.
  it("says so when there is nothing to show", () => {
    expect(
      frameOf(<SidePanel sidebar={{ title: "Initiatives", rows: [] }} />),
    ).toContain("nothing open")
  })
})
