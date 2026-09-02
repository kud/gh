import { describe, expect, it } from "vitest"
import { treeUrls, type AnyItem } from "./inbox.js"

// `C` copies the tree the cursor is in — a ticket and the PRs hanging off it —
// where `c` copies the one row. The tree is only implied by the flat list, so
// every case here is really about where the walk starts and where it stops.

const taskUrl = (key: string) => `https://jira/${key}`
const prUrl = (number: number) => `https://github.com/acme/api/pull/${number}`

const task = (key: string): AnyItem => ({
  kind: "task",
  key,
  summary: `${key} summary`,
  url: taskUrl(key),
  status: "In Development",
  age: "",
  indent: false,
})

const pr = (number: number): AnyItem => ({
  kind: "pr",
  number,
  title: `#${number}`,
  repo: "acme/api",
  url: prUrl(number),
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

//  0 header · 1 SHOP-1 · 2 pr1 · 3 pr2 · 4 SHOP-2 · 5 pr3
const ROWS: AnyItem[] = [
  header,
  task("SHOP-1"),
  pr(1),
  pr(2),
  task("SHOP-2"),
  pr(3),
]

const TREE = [taskUrl("SHOP-1"), prUrl(1), prUrl(2)]

describe("treeUrls", () => {
  it("copies the parent and every child under it", () => {
    expect(treeUrls(ROWS, 1)).toEqual(TREE)
  })

  // The point of walking up: you copy the tree you can see, not the row the
  // cursor happens to have landed on inside it.
  it("gives the same tree from any child of it", () => {
    expect(treeUrls(ROWS, 2)).toEqual(TREE)
    expect(treeUrls(ROWS, 3)).toEqual(TREE)
  })

  it("stops at the next tree rather than running to the end", () => {
    expect(treeUrls(ROWS, 4)).toEqual([taskUrl("SHOP-2"), prUrl(3)])
  })

  it("is just the row's own URL when nothing hangs off it", () => {
    expect(treeUrls([task("SHOP-9")], 0)).toEqual([taskUrl("SHOP-9")])
  })

  // A collapsed row is the rest of the tree, not the end of it. What `C`
  // copies must not depend on how many children happened to fit on screen —
  // that is a difference nothing on screen would report.
  const collapsed = (...numbers: number[]): AnyItem =>
    ({ kind: "show-more", hidden: numbers.map(pr), indent: true }) as AnyItem

  it("descends into a collapsed row, which holds the children not drawn", () => {
    expect(treeUrls([task("SHOP-1"), pr(1), collapsed(9, 10)], 0)).toEqual([
      taskUrl("SHOP-1"),
      prUrl(1),
      prUrl(9),
      prUrl(10),
    ])
  })

  // The row itself still carries no URL, so it contributes no blank line —
  // only what it hides.
  it("adds nothing of its own for an empty collapsed row", () => {
    expect(treeUrls([task("SHOP-1"), collapsed()], 0)).toEqual([taskUrl("SHOP-1")])
  })

  it("gives the same collapsed tree from a child of it", () => {
    const rows = [task("SHOP-1"), pr(1), collapsed(9), task("SHOP-2"), pr(3)]
    expect(treeUrls(rows, 1)).toEqual([taskUrl("SHOP-1"), prUrl(1), prUrl(9)])
    expect(treeUrls(rows, 2)).toEqual([taskUrl("SHOP-1"), prUrl(1), prUrl(9)])
    expect(treeUrls(rows, 3)).toEqual([taskUrl("SHOP-2"), prUrl(3)])
  })

  it("returns nothing for a header, which is not a tree", () => {
    expect(treeUrls([header], 0)).toEqual([])
  })

  // Guard the guard: if the walk ignored its bounds these would all match.
  it("never reaches a sibling tree's rows", () => {
    expect(treeUrls(ROWS, 1)).not.toContain(prUrl(3))
  })
})

// Three levels — epic > story > PR. Nothing above constrains any of this: the
// cases before this block were all written when a row could only be top level
// or a child, so they pin that the generalisation stayed CONSERVATIVE, not that
// it chose correctly here.
const taskAt = (key: string, depth: number): AnyItem => ({
  kind: "task",
  key,
  summary: `${key} summary`,
  url: taskUrl(key),
  status: "In Development",
  age: "",
  depth,
})

const prAt = (number: number, depth: number): AnyItem => ({
  kind: "pr",
  number,
  title: `#${number}`,
  repo: "acme/api",
  url: prUrl(number),
  health: "none",
  age: "1d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  depth,
})

//  0 epic SHOP-1 · 1 story SHOP-2 · 2 pr1 · 3 pr2 · 4 story SHOP-3 · 5 pr3
const DEEP: AnyItem[] = [
  taskAt("SHOP-1", 0),
  taskAt("SHOP-2", 1),
  prAt(1, 2),
  prAt(2, 2),
  taskAt("SHOP-3", 1),
  prAt(3, 2),
]

const STORY_TREE = [taskUrl("SHOP-2"), prUrl(1), prUrl(2)]

describe("treeUrls across three levels", () => {
  it("copies the whole epic from the epic row", () => {
    expect(treeUrls(DEEP, 0)).toEqual([
      taskUrl("SHOP-1"),
      taskUrl("SHOP-2"),
      prUrl(1),
      prUrl(2),
      taskUrl("SHOP-3"),
      prUrl(3),
    ])
  })

  // The whole point of stopping at the nearest task rather than at the top
  // level: standing on a story must not hand over its siblings' PRs, which
  // were never on screen together.
  it("copies only its own subtree from a story row", () => {
    expect(treeUrls(DEEP, 1)).toEqual(STORY_TREE)
  })

  it("gives that same story subtree from a PR under it", () => {
    expect(treeUrls(DEEP, 2)).toEqual(STORY_TREE)
    expect(treeUrls(DEEP, 3)).toEqual(STORY_TREE)
  })

  it("never reaches a sibling story's PRs", () => {
    expect(treeUrls(DEEP, 2)).not.toContain(prUrl(3))
  })

  it("stops at the next story rather than running to the end", () => {
    expect(treeUrls(DEEP, 4)).toEqual([taskUrl("SHOP-3"), prUrl(3)])
  })

  // The depth-0 half of the stop condition. An orphan PR has no task anywhere
  // above it, so without that term the walk would run to the top of the list.
  it("stops on itself for an orphan PR with no task above it", () => {
    const rows = [taskAt("SHOP-1", 0), prAt(1, 1), prAt(99, 0)]
    expect(treeUrls(rows, 2)).toEqual([prUrl(99)])
  })

  // The landmine: a collapsed row under a STORY is at depth 2, and pinning it
  // to 1 would make the walk stop early and drop everything it holds, with
  // nothing on screen to say so.
  it("descends into a collapsed row hanging off a story", () => {
    const rows = [
      taskAt("SHOP-1", 0),
      taskAt("SHOP-2", 1),
      prAt(1, 2),
      { kind: "show-more", hidden: [pr(9), pr(10)], depth: 2 } as AnyItem,
      taskAt("SHOP-3", 1),
      prAt(3, 2),
    ]
    expect(treeUrls(rows, 1)).toEqual([
      taskUrl("SHOP-2"),
      prUrl(1),
      prUrl(9),
      prUrl(10),
    ])
    expect(treeUrls(rows, 1)).not.toContain(prUrl(3))
  })
})
