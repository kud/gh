import { describe, expect, it } from "vitest"
import { fitCount, gapsAbove, type AnyItem } from "./inbox.js"

// The blank line belongs BETWEEN ticket groups and nowhere else: a ticket opens
// a group, so it gets air above it; its PRs hang underneath with none, or the
// tree it draws would be pulled apart by the spacing meant to separate it from
// the next one.
//
// And there is exactly one definition, because two readers need the same answer
// — the renderer draws the gap, fitCount pays for it out of the window budget.
// They disagreed once, and a tab drew one line more than the window had bought.

const task = (key: string): AnyItem => ({
  kind: "task",
  key,
  summary: `${key} summary`,
  url: `https://jira/${key}`,
  status: "In Development",
  age: "",
  indent: false,
})

const pr = (number: number): AnyItem => ({
  kind: "pr",
  number,
  title: `#${number}`,
  repo: "acme/api",
  url: `https://github.com/acme/api/pull/${number}`,
  health: "none",
  age: "1d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent: true,
})

const header: AnyItem = {
  kind: "subgroup-header",
  label: "Needs you",
  indent: false,
} as AnyItem

//  0 header · 1 task · 2 pr · 3 pr · 4 task · 5 pr
const ROWS: AnyItem[] = [header, task("SHOP-1"), pr(1), pr(2), task("SHOP-2"), pr(3)]

//  0 task · 1 task · 2 task — the Off Board shape: tickets, no PRs anywhere.
const BARE: AnyItem[] = [task("SHOP-1"), task("SHOP-2"), task("SHOP-3")]

describe("gapsAbove", () => {
  it("gaps before a ticket that opens a tree", () => {
    expect(gapsAbove(ROWS, 1)).toBe(true)
    expect(gapsAbove(ROWS, 4)).toBe(true)
  })

  // The Off Board tab: ten tickets, no PRs on any of them. Air between them
  // separates nothing, and costs nearly half the window to say so.
  it("never gaps between tickets that have nothing under them", () => {
    for (const i of [1, 2]) expect(gapsAbove(BARE, i)).toBe(false)
  })

  // A boundary belongs to both groups, so either side can ask for it.
  it("gaps after a tree even when the next ticket has no PRs", () => {
    const rows = [task("SHOP-1"), pr(1), task("SHOP-2")]
    expect(gapsAbove(rows, 2)).toBe(true)
  })

  it("gaps before a tree even when the ticket above had no PRs", () => {
    const rows = [task("SHOP-1"), task("SHOP-2"), pr(1)]
    expect(gapsAbove(rows, 1)).toBe(true)
  })

  // show-more is a child row too — a ticket whose PRs are collapsed behind it
  // still has a tree, and hiding the rows must not also remove the spacing.
  it("counts a collapsed tree as a tree", () => {
    const more: AnyItem = {
      kind: "show-more",
      hidden: [pr(9)],
      indent: true,
    } as AnyItem
    expect(gapsAbove([task("SHOP-1"), more, task("SHOP-2")], 2)).toBe(true)
  })

  it("never gaps before a PR, so a ticket's tree stays together", () => {
    for (const i of [2, 3, 5]) expect(gapsAbove(ROWS, i)).toBe(false)
  })

  it("gaps before a band header", () => {
    expect(gapsAbove([pr(1), header], 1)).toBe(true)
  })

  it("never gaps the very first row, which has nothing above it", () => {
    expect(gapsAbove(ROWS, 0)).toBe(false)
    expect(gapsAbove([task("SHOP-1")], 0)).toBe(false)
  })
})

describe("fitCount pays for exactly the gaps that get drawn", () => {
  // 6 rows, 3 of which gap (1, 4, and the header at 0 — which does not gap when
  // it IS the window start). From 0: rows 1 and 4 cost two lines each.
  it("charges two lines for a gapping row and one otherwise", () => {
    expect(fitCount(ROWS, 0, 8)).toBe(6)
    expect(fitCount(ROWS, 0, 7)).toBe(5)
  })

  it("never charges the window's first row for a gap it will not draw", () => {
    // Starting AT the ticket: it gaps in the middle of a list but not here, so
    // three rows fit in three lines.
    expect(fitCount(ROWS, 1, 3)).toBe(3)
  })

  // Guard the guard: if the budget were ignored these would all return 6.
  it("is actually bounded by the budget", () => {
    expect(fitCount(ROWS, 0, 1)).toBe(1)
  })
})
