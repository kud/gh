import { describe, expect, it } from "vitest"
import { workCount, type AnyItem, type Section } from "./inbox.js"

// What the tab badge says. The number is the whole point of this file: it is
// read at a glance and acted on, so a row counted wrongly is a lie nobody
// checks.
//
// The invariant every spec here serves: A PIECE OF WORK COUNTS ONCE, at whatever
// depth the board files it. This was `topLevelCount` and counted rows at depth
// 0, which was correct while a ticket was always top level — and went to literal
// zero the day epics arrived, because the only depth-0 rows left were containers
// and containers are excluded. Two rules from different eras, each right alone,
// that together said "count the parent" and "don't count the parent".
//
// Keys are invented, per the standard mock.ts sets: nothing here belongs to a
// real instance. This package is public and its fixtures end up in screenshots
// and READMEs, so a key that merely resembles a real one is already wrong.

const task = (key: string, depth: number, role?: "container"): AnyItem => ({
  kind: "task",
  key,
  summary: `${key} summary`,
  url: `https://jira/${key}`,
  status: "In Development",
  age: "",
  depth,
  ...(role ? { role } : {}),
})

const pr = (n: number, depth: number): AnyItem => ({
  kind: "pr",
  number: n,
  title: `#${n}`,
  repo: "acme/api",
  url: `https://github.com/acme/api/pull/${n}`,
  health: "none",
  age: "1d",
  ts: n,
  unresolved: 0,
  conversation: 0,
  depth,
})

const section = (items: AnyItem[]): Section => ({
  id: "open",
  label: "Open",
  items,
})

describe("workCount", () => {
  it("counts the leaves, not the rows that hold them", () => {
    // A story with two PRs is two things to do, not three. The story is what
    // they hang under, the same way an epic is what stories hang under.
    expect(workCount(section([task("SHOP-100", 0), pr(1, 1), pr(2, 1)]))).toBe(
      2,
    )
  })

  /*
   * The spec that chose leaves over "every non-container row", and the reason
   * the fix is not simply deleting the depth clause.
   *
   * One PR, counted before and after its ticket becomes parseable from the
   * branch so the board can file it under a story. Nothing was created — the
   * board merely got tidier — so the number must not move. Counting every
   * non-container row would report 1 and then 2, which is the epic bug one
   * level down.
   */
  it("does not change when the same PR gains a parent", () => {
    const loose = section([pr(1, 0)])
    const filed = section([task("SHOP-100", 0), pr(1, 1)])
    expect(workCount(filed)).toBe(workCount(loose))
  })

  it("counts a story that has no PRs yet, because it is its own leaf", () => {
    // A ticket in review with nothing to show is real work — arguably the most
    // actionable row on the board — so it must not count zero.
    expect(workCount(section([task("SHOP-100", 0)]))).toBe(1)
  })

  it("still counts one when that story gains its first PR", () => {
    // The other half of the 0-to-1 case. The story stops being the item and its
    // PR becomes the item: same work, same number. A row earns container-hood by
    // HAVING children, not by being flagged as one.
    expect(workCount(section([task("SHOP-100", 0), pr(1, 1)]))).toBe(1)
  })

  // The bug this file exists for. Every depth-0 row on the tab was an epic, and
  // epics are excluded, so a tab showing seven rows read `(0)`.
  it("counts work nested under a container, at any depth", () => {
    const items = [
      task("SHOP-300", 0, "container"),
      task("SHOP-412", 1),
      pr(1, 2),
      pr(2, 2),
    ]
    expect(workCount(section(items))).toBe(2)
  })

  // An epic is real, owned, and openable — but the work is the stories under
  // it. Counting the container as well reported five things to do where there
  // were four.
  it("does not count a container, which is context rather than work", () => {
    const items = [
      task("SHOP-300", 0, "container"),
      task("SHOP-412", 1),
      task("SHOP-500", 0),
    ]
    expect(workCount(section(items))).toBe(2)
  })

  it("does not count headers, which are furniture rather than entities", () => {
    const header = { kind: "subgroup-header", label: "Needs you", age: "" }
    expect(workCount(section([header as AnyItem, task("SHOP-100", 0)]))).toBe(1)
  })

  /*
   * Load-bearing, and the place a second bug would have shipped.
   *
   * Pressing return on a `show-more` splices its hidden rows into `items` in
   * place. Once the count depends on the shape of the list, a collapsed tail
   * that counted as furniture would make the badge RISE on expanding and FALL
   * on collapsing — a key that only changes what is drawn changing how much
   * work you have.
   */
  it("reads the same collapsed as expanded", () => {
    const hidden = [pr(8, 1), pr(9, 1)]
    const collapsed = section([
      task("SHOP-100", 0),
      pr(1, 1),
      { kind: "show-more", hidden, depth: 1 } as AnyItem,
    ])
    const expanded = section([
      task("SHOP-100", 0),
      pr(1, 1),
      ...hidden,
      { kind: "show-less", toHide: hidden, depth: 1 } as AnyItem,
    ])
    expect(workCount(collapsed)).toBe(3)
    expect(workCount(expanded)).toBe(workCount(collapsed))
  })

  it("counts a story whose every PR is hidden by the tail standing for them", () => {
    // The all-hidden case: the story is not a leaf — something does hang under
    // it — and the tail carries the payload, so the number comes from the hidden
    // rows rather than from the row standing in for them.
    const items = [
      task("SHOP-100", 0),
      { kind: "show-more", hidden: [pr(8, 1), pr(9, 1)], depth: 1 } as AnyItem,
    ]
    expect(workCount(section(items))).toBe(2)
  })

  it("counts sibling top-level rows normally", () => {
    const items = [
      task("SHOP-300", 0, "container"),
      task("SHOP-301", 0, "container"),
      task("SHOP-500", 0),
      task("SHOP-501", 0),
    ]
    expect(workCount(section(items))).toBe(2)
  })
})
