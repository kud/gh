import { describe, expect, it } from "vitest"

import { matchesFilter, parsePatterns } from "./filter.js"

/*
 * What is pinned here is that the old two-way work/home split is expressible as
 * data, because that is the entire claim this replaces it on. If a pair of
 * pattern lists cannot reproduce the boolean exactly, the boolean was carrying
 * something and removing it loses a behaviour.
 */

const WORK = ["acme/*", "me/acme-*"]

describe("the old split, as data", () => {
  const repos = [
    "acme/api",
    "acme/monorepo",
    "me/acme-fork",
    "me/dotfiles",
    "stranger/thing",
  ]
  const keep = (f: Parameters<typeof matchesFilter>[1]) =>
    repos.filter((r) => matchesFilter(r, f))

  it("reproduces `work` with an include list", () => {
    expect(keep({ include: WORK })).toEqual([
      "acme/api",
      "acme/monorepo",
      "me/acme-fork",
    ])
  })

  it("reproduces `home` as the exact complement", () => {
    expect(keep({ exclude: WORK })).toEqual(["me/dotfiles", "stranger/thing"])
  })

  it("covers every repo between the two, with no overlap", () => {
    // The property the boolean guaranteed for free and a filter pair must not
    // quietly lose: nothing falls between the two views, nothing sits in both.
    const a = keep({ include: WORK })
    const b = keep({ exclude: WORK })
    expect([...a, ...b].sort()).toEqual([...repos].sort())
    expect(a.filter((r) => b.includes(r))).toEqual([])
  })
})

describe("matchesFilter", () => {
  it("shows everything when nothing is configured", () => {
    expect(matchesFilter("anyone/anything", {})).toBe(true)
    expect(matchesFilter("anyone/anything", { include: [] })).toBe(true)
  })

  it("treats a bare owner as all of its repos", () => {
    expect(matchesFilter("acme/api", { include: ["acme"] })).toBe(true)
    expect(matchesFilter("other/api", { include: ["acme"] })).toBe(false)
  })

  it("never lets `*` cross the owner boundary", () => {
    // `acme/*` must not reach into another owner, however the name reads.
    expect(matchesFilter("acme/a/b", { include: ["acme/*"] })).toBe(false)
    expect(matchesFilter("notacme/api", { include: ["acme/*"] })).toBe(false)
  })

  it("does not let an owner prefix claim a longer owner", () => {
    // "acme" must not swallow "acmecorp" — the trap the old startsWith had.
    expect(matchesFilter("acmecorp/api", { include: ["acme/*"] })).toBe(false)
  })

  it("matches a name prefix, which is how forks are picked out", () => {
    expect(matchesFilter("me/acme-fork", { include: ["me/acme-*"] })).toBe(true)
    expect(matchesFilter("me/dotfiles", { include: ["me/acme-*"] })).toBe(false)
  })

  it("lets exclude beat include", () => {
    // Take a whole org and drop one repo, without listing the rest.
    const f = { include: ["acme/*"], exclude: ["acme/legacy"] }
    expect(matchesFilter("acme/api", f)).toBe(true)
    expect(matchesFilter("acme/legacy", f)).toBe(false)
  })

  it("is case-insensitive, as GitHub is about owners and names", () => {
    expect(matchesFilter("ACME/Api", { include: ["acme/*"] })).toBe(true)
  })

  it("does not read a dot as a metacharacter", () => {
    // Regex-escaping, not glob-to-regex sloppiness: `me/a.b` is one repo.
    expect(matchesFilter("me/axb", { include: ["me/a.b"] })).toBe(false)
    expect(matchesFilter("me/a.b", { include: ["me/a.b"] })).toBe(true)
  })
})

describe("parsePatterns", () => {
  it("splits, trims and drops blanks", () => {
    expect(parsePatterns("acme/*, me/acme-* ,")).toEqual([
      "acme/*",
      "me/acme-*",
    ])
  })

  it("returns nothing for an empty value", () => {
    expect(parsePatterns("")).toEqual([])
    expect(parsePatterns("  ,  ")).toEqual([])
  })
})
