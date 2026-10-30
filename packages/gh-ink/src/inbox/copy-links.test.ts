import { describe, expect, it } from "vitest"
import { bandUrls, copyUrls, type AnyItem } from "./inbox.js"

// `c` copies from wherever the cursor stands — one row's URL, every URL under
// a repo fence, or every URL under a `»` band header — so the footer hint and
// the key read the same answer off `copyUrls`. Every case here is about which
// run of the flat list that answer is.

const prUrl = (repo: string, number: number) =>
  `https://github.com/${repo}/pull/${number}`

const pr = (number: number, repo: string): AnyItem => ({
  kind: "pr",
  number,
  title: `pull request number ${number}`,
  repo,
  url: prUrl(repo, number),
  health: "waiting",
  age: "2d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const task = (key: string): AnyItem => ({
  kind: "task",
  key,
  summary: `${key} summary`,
  url: `https://jira/${key}`,
  status: "In Development",
  age: "",
  indent: false,
})

const fence = (repo: string): AnyItem => ({
  kind: "repo-header",
  repo,
  age: "",
  indent: false,
})

const band = (label: string): AnyItem => ({
  kind: "subgroup-header",
  label,
  age: "",
  indent: false,
})

//  0 band(Your move) · 1 fence(api) · 2 #1 · 3 #2 · 4 fence(bus) · 5 #3 ·
//  6 band(Their move) · 7 fence(api) · 8 #4
const ROWS: AnyItem[] = [
  band("Your move (3)"),
  fence("acme/api"),
  pr(1, "acme/api"),
  pr(2, "acme/api"),
  fence("acme/bus"),
  pr(3, "acme/bus"),
  band("Their move (1)"),
  fence("acme/api"),
  pr(4, "acme/api"),
]

describe("copyUrls on a single row", () => {
  it("is just that row's URL", () => {
    expect(copyUrls(ROWS, 2)).toEqual([prUrl("acme/api", 1)])
    expect(copyUrls(ROWS, 5)).toEqual([prUrl("acme/bus", 3)])
  })

  it("takes a ticket's URL the same way", () => {
    const rows = [band("Today"), task("SHOP-1")]
    expect(copyUrls(rows, 1)).toEqual(["https://jira/SHOP-1"])
  })

  // A row with no URL of its own contributes no blank line — only headers
  // expand to the rows under them.
  it("is nothing for a row that carries no URL", () => {
    const more: AnyItem = {
      kind: "show-more",
      hidden: [],
      indent: true,
    } as AnyItem
    expect(copyUrls([more], 0)).toEqual([])
  })
})

describe("copyUrls on a repo fence", () => {
  it("takes the whole group in display order", () => {
    expect(copyUrls(ROWS, 1)).toEqual([
      prUrl("acme/api", 1),
      prUrl("acme/api", 2),
    ])
  })

  it("stops at the next fence rather than gathering the repo everywhere", () => {
    expect(copyUrls(ROWS, 1)).not.toContain(prUrl("acme/api", 4))
  })

  it("stops at the next band header", () => {
    expect(copyUrls(ROWS, 4)).toEqual([prUrl("acme/bus", 3)])
  })

  it("gives nothing for a fence that owns no rows", () => {
    expect(copyUrls([fence("acme/api")], 0)).toEqual([])
    expect(copyUrls([fence("acme/api"), fence("acme/bus")], 0)).toEqual([])
  })

  // A collapsed row is not a gap in the group, it IS the rest of it — same
  // reasoning as treeUrls, pinned here so the two cannot drift apart.
  it("includes the rows a show-more is holding", () => {
    const rows: AnyItem[] = [
      fence("acme/api"),
      pr(1, "acme/api"),
      { kind: "show-more", hidden: [pr(9, "acme/api")], indent: true } as AnyItem,
    ]
    expect(copyUrls(rows, 0)).toEqual([
      prUrl("acme/api", 1),
      prUrl("acme/api", 9),
    ])
  })
})

describe("copyUrls on a band header", () => {
  // The band, not the tab: standing on `» Your move (3)` hands over those
  // three, never Their move's rows below.
  it("takes the whole band across however many fences that spans", () => {
    expect(copyUrls(ROWS, 0)).toEqual([
      prUrl("acme/api", 1),
      prUrl("acme/api", 2),
      prUrl("acme/bus", 3),
    ])
    expect(copyUrls(ROWS, 6)).toEqual([prUrl("acme/api", 4)])
  })

  it("never reaches the next band's rows", () => {
    expect(copyUrls(ROWS, 0)).not.toContain(prUrl("acme/api", 4))
    expect(bandUrls(ROWS, 0)).not.toContain(prUrl("acme/api", 4))
  })

  it("gives nothing for a band that owns no rows", () => {
    expect(copyUrls([band("Your move (0)")], 0)).toEqual([])
    expect(
      copyUrls([band("Your move (0)"), band("Their move (1)")], 0),
    ).toEqual([])
  })

  it("includes the rows a show-more is holding", () => {
    const rows: AnyItem[] = [
      band("Your move (2)"),
      fence("acme/api"),
      pr(1, "acme/api"),
      { kind: "show-more", hidden: [pr(9, "acme/bus")], indent: true } as AnyItem,
    ]
    expect(copyUrls(rows, 0)).toEqual([
      prUrl("acme/api", 1),
      prUrl("acme/bus", 9),
    ])
  })
})

describe("copyUrls out of range", () => {
  it("is nothing below zero and past the end", () => {
    expect(copyUrls(ROWS, -1)).toEqual([])
    expect(copyUrls(ROWS, ROWS.length)).toEqual([])
    expect(copyUrls([], 0)).toEqual([])
  })
})

describe("copyUrls under two levels", () => {
  const level = (label: string, depth: number): AnyItem => ({
    kind: "subgroup-header",
    label,
    age: "",
    depth,
  })

  //  0 side(Mine) · 1 band(Your move) · 2 fence · 3 #1 · 4 band(Their move) ·
  //  5 fence · 6 #2 · 7 side(Others) · 8 band(Your move) · 9 fence · 10 #3
  const TWO: AnyItem[] = [
    level("Mine (2)", 0),
    level("Your move (1)", 1),
    fence("acme/api"),
    pr(1, "acme/api"),
    level("Their move (1)", 1),
    fence("acme/bus"),
    pr(2, "acme/bus"),
    level("Others (1)", 0),
    level("Your move (1)", 1),
    fence("acme/api"),
    pr(3, "acme/api"),
  ]

  it("takes every band under a side, and stops at the next side", () => {
    expect(copyUrls(TWO, 0)).toEqual([
      prUrl("acme/api", 1),
      prUrl("acme/bus", 2),
    ])
    expect(copyUrls(TWO, 7)).toEqual([prUrl("acme/api", 3)])
  })

  it("keeps a band inside a side to its own rows", () => {
    expect(copyUrls(TWO, 1)).toEqual([prUrl("acme/api", 1)])
    expect(copyUrls(TWO, 4)).toEqual([prUrl("acme/bus", 2)])
  })

  it("never carries a side's last band into the next side", () => {
    expect(bandUrls(TWO, 4)).not.toContain(prUrl("acme/api", 3))
  })
})
