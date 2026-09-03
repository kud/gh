import React from "react"
import { render } from "ink-testing-library"
import { describe, it, expect } from "vitest"
import { SidePanel, railCapacity, type Sidebar } from "./side-panel.js"

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
