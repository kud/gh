import { describe, expect, it } from "vitest"

import type { AnyItem, GHItem } from "./core.js"
import { matchesSearchQuery, parseSearchQuery } from "./search-query.js"

const item = (over: Partial<GHItem> = {}): GHItem => ({
  kind: "pr",
  number: 7,
  title: "bump react to 19",
  repo: "acme/api-gateway",
  url: "https://github.com/acme/api-gateway/pull/7",
  author: "octocat",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  ...over,
})

const task = (
  over: Partial<Extract<AnyItem, { kind: "task" }>> = {},
): AnyItem => ({
  kind: "task",
  key: "SHOP-1234",
  summary: "reconcile the December ledger",
  age: "1d",
  ts: 0,
  ...over,
})

const match = (item: AnyItem, query: string, login = "kud"): boolean =>
  matchesSearchQuery(item, parseSearchQuery(query), login)

describe("parseSearchQuery", () => {
  it("splits on whitespace", () => {
    expect(parseSearchQuery("bump react")).toEqual([
      { kind: "text", negate: false, value: "bump" },
      { kind: "text", negate: false, value: "react" },
    ])
  })

  it("keeps a double-quoted phrase as one term", () => {
    expect(parseSearchQuery('author:dependabot "bump react"')).toEqual([
      {
        kind: "qualifier",
        negate: false,
        key: "author",
        value: "dependabot",
      },
      { kind: "text", negate: false, value: "bump react" },
    ])
  })

  it("negates qualifiers and bare terms with a leading dash", () => {
    expect(parseSearchQuery("word -author:octocat -legacy")).toEqual([
      { kind: "text", negate: false, value: "word" },
      { kind: "qualifier", negate: true, key: "author", value: "octocat" },
      { kind: "text", negate: true, value: "legacy" },
    ])
  })

  it("negates a quoted phrase", () => {
    expect(parseSearchQuery('-"bump react"')).toEqual([
      { kind: "text", negate: true, value: "bump react" },
    ])
  })

  it("reads the key case-insensitively", () => {
    expect(parseSearchQuery("AUTHOR:octocat Repo:acme")).toEqual([
      { kind: "qualifier", negate: false, key: "author", value: "octocat" },
      { kind: "qualifier", negate: false, key: "repo", value: "acme" },
    ])
  })

  it("drops a qualifier with an empty value", () => {
    expect(parseSearchQuery("author:")).toEqual([])
    // Partial typing must not hide everything mid-keystroke.
    expect(parseSearchQuery("bump author:")).toEqual([
      { kind: "text", negate: false, value: "bump" },
    ])
  })

  it("treats an unknown key as a bare term of the whole token", () => {
    expect(parseSearchQuery("foo:bar")).toEqual([
      { kind: "text", negate: false, value: "foo:bar" },
    ])
  })

  it("returns nothing for an empty or blank query", () => {
    expect(parseSearchQuery("")).toEqual([])
    expect(parseSearchQuery("   ")).toEqual([])
  })
})

describe("matchesSearchQuery", () => {
  it("matches a plain word by case-insensitive substring", () => {
    expect(match(item(), "bump")).toBe(true)
    expect(match(item(), "BUMP REACT")).toBe(true)
    expect(match(item(), "deploy")).toBe(false)
  })

  it("matches author exactly, both spellings of a bot, both orders", () => {
    expect(match(item({ author: "octocat" }), "author:@octocat")).toBe(true)
    expect(match(item({ author: "kud" }), "author:@ME", "kud")).toBe(true)
    expect(match(item({ author: "octocat" }), "author:OctoCAT")).toBe(true)
    expect(match(item({ author: "octocat" }), "author:someone-else")).toBe(
      false,
    )

    expect(match(item(), "author:dependabot")).toBe(false)
    expect(
      match(item({ author: "dependabot[bot]" }), "author:dependabot"),
    ).toBe(true)
    expect(match(item({ author: "app/dependabot" }), "author:dependabot")).toBe(
      true,
    )
    expect(
      match(item({ author: "dependabot[bot]" }), "author:app/dependabot"),
    ).toBe(true)
  })

  it("resolves me to the login", () => {
    expect(match(item({ author: "kud" }), "author:me", "kud")).toBe(true)
    expect(match(item({ author: "kud" }), "author:@me", "kud")).toBe(true)
    expect(match(item({ author: "octocat" }), "author:me", "kud")).toBe(false)
  })

  it("matches repo by case-insensitive substring", () => {
    expect(match(item(), "repo:acme/")).toBe(true)
    expect(match(item(), "repo:gateway")).toBe(true)
    expect(match(item(), "repo:ACME/API-GATEWAY")).toBe(true)
    expect(match(item(), "repo:billing")).toBe(false)
  })

  it("treats is:draft as a bare text term, not a health filter", () => {
    expect(match(item({ title: "reuse the is:draft wording" }), "is:draft")).toBe(
      true,
    )
    // A draft row without that substring is dropped by the substring miss
    // alone, so nothing here reads health.
    expect(match(item({ health: "draft" }), "is:draft")).toBe(false)
  })

  it("negates a qualifier", () => {
    expect(match(item({ author: "octocat" }), "-author:dependabot")).toBe(true)
    expect(match(item({ author: "octocat" }), "-author:octocat")).toBe(false)
  })

  it("negates a bare term", () => {
    expect(match(item(), "-legacy")).toBe(true)
    expect(match(item(), "-react")).toBe(false)
  })

  it("ANDs terms together", () => {
    expect(match(item(), "bump acme")).toBe(true)
    expect(match(item(), "bump billing")).toBe(false)
    expect(
      match(
        item({ author: "octocat", health: "approved" }),
        "author:octocat bump",
      ),
    ).toBe(true)
    expect(match(item({ author: "dependabot" }), "author:octocat bump")).toBe(
      false,
    )
  })

  it("keeps a quoted phrase whole", () => {
    expect(match(item({ title: "bump react to 19" }), '"bump react"')).toBe(
      true,
    )
    expect(match(item({ title: "bump vite to 3" }), '"bump react"')).toBe(false)
  })

  it("searches an unknown key as a bare term", () => {
    expect(
      match(item({ title: "fix: leak with trailing colon issue" }), "fix:"),
    ).toBe(true)
  })

  it("a task row answers its own text, not author or repo", () => {
    expect(match(task(), "ledger")).toBe(true)
    expect(match(task(), "SHOP-1234")).toBe(true)

    // Task rows carry no author or repo, so positive qualifiers fail them…
    expect(match(task(), "author:octocat")).toBe(false)
    expect(match(task(), "repo:acme")).toBe(false)
    // …and their negations let them through.
    expect(match(task(), "-author:octocat")).toBe(true)
    expect(match(task(), "-repo:acme")).toBe(true)
  })
})
