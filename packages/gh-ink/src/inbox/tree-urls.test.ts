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

//  0 header · 1 ACC-1 · 2 pr1 · 3 pr2 · 4 ACC-2 · 5 pr3
const ROWS: AnyItem[] = [
  header,
  task("ACC-1"),
  pr(1),
  pr(2),
  task("ACC-2"),
  pr(3),
]

const TREE = [taskUrl("ACC-1"), prUrl(1), prUrl(2)]

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
    expect(treeUrls(ROWS, 4)).toEqual([taskUrl("ACC-2"), prUrl(3)])
  })

  it("is just the row's own URL when nothing hangs off it", () => {
    expect(treeUrls([task("ACC-9")], 0)).toEqual([taskUrl("ACC-9")])
  })

  // show-more draws as a child and has no URL. Including it would put a blank
  // line on the clipboard, which is exactly what a paste would show.
  it("skips collapsed-tree rows, which carry no URL", () => {
    const more: AnyItem = {
      kind: "show-more",
      hidden: [pr(9)],
      indent: true,
    } as AnyItem
    expect(treeUrls([task("ACC-1"), more], 0)).toEqual([taskUrl("ACC-1")])
  })

  it("returns nothing for a header, which is not a tree", () => {
    expect(treeUrls([header], 0)).toEqual([])
  })

  // Guard the guard: if the walk ignored its bounds these would all match.
  it("never reaches a sibling tree's rows", () => {
    expect(treeUrls(ROWS, 1)).not.toContain(prUrl(3))
  })
})
