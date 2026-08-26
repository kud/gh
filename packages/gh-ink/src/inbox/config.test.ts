import { afterEach, describe, expect, it } from "vitest"

import { configureInbox, resetInboxConfig, checkoutDirs } from "./config.js"
import { repoPriority, sortItems, type GHItem } from "./inbox.js"

/*
 * These values used to be compiled in — a specific owner ranked first, a
 * specific repo above it, a specific on-disk layout. That is wrong twice over in
 * a published library: it ranks its author's repos above its reader's, and it
 * states things about a private machine to anyone who unpacks the tarball.
 *
 * What is pinned here is that NOTHING is assumed when nothing is configured.
 * An unconfigured default that happens to suit one reader is the same bug in a
 * quieter coat, so the empty case is tested first and deliberately.
 */

afterEach(resetInboxConfig)

const item = (repo: string, number: number): GHItem => ({
  kind: "pr",
  number,
  title: "",
  repo,
  url: "",
  health: "waiting",
  age: "",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

describe("unconfigured", () => {
  it("ranks every repo equally", () => {
    expect(repoPriority("acme/api")).toBe(repoPriority("someone/else"))
  })

  it("resolves no checkout directories at all", () => {
    // Not a guess at ~/src or ~/Projects: a library that invents a path finds
    // someone else's directory and reports a repo as checked out when it is not.
    expect(checkoutDirs()).toEqual([])
  })

  it("still groups by repo name — grouping is not a priority feature", () => {
    // Unconfigured means no repo OUTRANKS another, not that repos stop
    // clustering: same-repo adjacency is what insertRepoHeaders depends on, so
    // it survives an empty priority list and recency still cannot cross a repo
    // boundary. Ranking and grouping are separate keys that happen to be
    // adjacent, and losing that distinction orphans headers.
    const fresh = { ...item("zz/other", 2), ts: 9_000 }
    const stale = item("acme/api", 1)
    expect(sortItems([fresh, stale]).map((i) => i.number)).toEqual([1, 2])
  })
})

describe("repoPriority", () => {
  it("matches an owner by trailing slash and a repo exactly", () => {
    configureInbox({ repoPriority: ["acme/monorepo", "acme/", "me/"] })
    expect(repoPriority("acme/monorepo")).toBe(0)
    expect(repoPriority("acme/api")).toBe(1)
    expect(repoPriority("me/dotfiles")).toBe(2)
    expect(repoPriority("stranger/thing")).toBe(3)
  })

  it("lets one repo outrank the owner containing it", () => {
    // The whole reason entries are ordered rather than a map: "acme/" would
    // otherwise swallow the repo meant to lead it.
    configureInbox({ repoPriority: ["acme/monorepo", "acme/"] })
    expect(repoPriority("acme/monorepo")).toBeLessThan(repoPriority("acme/api"))
  })

  it("does not match an owner prefix without the slash", () => {
    // "acme" must not claim "acmecorp/thing".
    configureInbox({ repoPriority: ["acme/"] })
    expect(repoPriority("acmecorp/thing")).toBe(1)
  })

  it("sorts repos into the configured order ahead of recency", () => {
    configureInbox({ repoPriority: ["mine/"] })
    const theirs = { ...item("theirs/repo", 2), ts: 9_999 }
    const mine = item("mine/repo", 1)
    expect(sortItems([theirs, mine]).map((i) => i.number)).toEqual([1, 2])
  })
})

describe("checkoutDirs", () => {
  it("lists each profile's directory, then the fallback", () => {
    configureInbox({
      profiles: [
        { name: "a", match: (r) => r.startsWith("a/"), checkoutDir: "/w/a" },
        { name: "b", match: (r) => r.startsWith("b/"), checkoutDir: "/w/b" },
      ],
      checkoutDir: "/w",
    })
    expect(checkoutDirs()).toEqual(["/w/a", "/w/b", "/w"])
  })

  it("dedupes when profiles share the fallback directory", () => {
    configureInbox({
      profiles: [{ name: "a", match: () => true, checkoutDir: "/w" }],
      checkoutDir: "/w",
    })
    expect(checkoutDirs()).toEqual(["/w"])
  })

  it("omits profiles that name no directory of their own", () => {
    configureInbox({
      profiles: [{ name: "a", match: () => true }],
      checkoutDir: "/w",
    })
    expect(checkoutDirs()).toEqual(["/w"])
  })
})
