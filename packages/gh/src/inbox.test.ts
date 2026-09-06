import { describe, expect, it } from "vitest"

import {
  INBOX_SOURCES,
  SOURCE_LIMITS,
  sourceCoverage,
  truncatedSources,
  buildInboxQueries,
  buildInboxQuery,
  mergeInboxData,
} from "./index.js"

const searchFor = (query: string, alias: string) =>
  query.match(new RegExp(`${alias}: search\\(query: "([^"]*)"`))?.[1] ?? ""

/** One source's whole selection, from its alias to the next one's. */
const blockFor = (query: string, alias: string) =>
  query.slice(query.indexOf(`${alias}: search(`)).split(/\n  \w+: search\(/)[0]

/** Sources that select open pull requests, and so need the health fragment. */
const OPEN_PR_SOURCES = [
  "myPRs",
  "reviewRequests",
  "reviewed",
  "assigned",
  "repoPRs",
]

describe("buildInboxQuery", () => {
  it("asks for every inbox source in one round-trip", () => {
    const query = buildInboxQuery()
    for (const alias of [
      "myPRs",
      "reviewRequests",
      "reviewed",
      "assigned",
      "repoIssues",
      "authoredIssues",
      "repoPRs",
      "recentlyDone",
    ])
      expect(query).toContain(`${alias}: search(`)
  })

  it("scopes to repos I own when account-wide", () => {
    const query = buildInboxQuery()
    expect(searchFor(query, "repoIssues")).toContain("user:@me")
    expect(searchFor(query, "repoPRs")).toContain("user:@me")
  })

  // The hazard the qualifier note describes: GitHub ANDs search qualifiers, so
  // keeping `user:@me` alongside `repo:` would match nothing on any repo you
  // contribute to but do not own — an empty inbox reading as "nothing to do".
  it("replaces user:@me rather than joining it when scoped to a repo", () => {
    const query = buildInboxQuery({ repo: "someone-else/thing" })
    for (const alias of ["repoIssues", "repoPRs"]) {
      expect(searchFor(query, alias)).toContain("repo:someone-else/thing")
      expect(searchFor(query, alias)).not.toContain("user:@me")
    }
  })

  it("scopes every source, not only the owned ones", () => {
    const query = buildInboxQuery({ repo: "kud/ambre" })
    for (const alias of ["myPRs", "reviewRequests", "assigned", "recentlyDone"])
      expect(searchFor(query, alias)).toContain("repo:kud/ambre")
  })

  // computeHealth reads all three; a selection missing one does not degrade, it
  // resolves to the wrong token — a PR sent back renders as "awaiting review".
  it("carries the whole health fragment on every open-PR source", () => {
    const query = buildInboxQuery()
    for (const alias of OPEN_PR_SOURCES) {
      const block = blockFor(query, alias)
      expect(block).toContain("reviewDecision")
      expect(block).toContain("mergeable")
      expect(block).toContain("statusCheckRollup")
    }
  })

  // Both levels, and the distinction is the feature rather than a detail of it:
  // a reaction on the last comment can only settle that comment, one on the PR
  // settles the PR. Collapse them to one and whichever survives is wrong for
  // half the cases.
  it("carries reactions at both the PR and the last-comment level", () => {
    const query = buildInboxQuery()
    for (const alias of OPEN_PR_SOURCES) {
      const block = blockFor(query, alias)
      expect(block).toContain("reactionGroups { content viewerHasReacted }")
      expect(
        block.match(/reactionGroups \{ content viewerHasReacted \}/g),
      ).toHaveLength(2)
    }
  })

  // Selecting `users` would make this the one reaction sub-selection that is a
  // connection, and GitHub wants a pagination argument on those. Nothing reads
  // the count, so the cheap shape is also the correct one — this pins that.
  it("asks for no reaction field that would need paginating", () => {
    expect(buildInboxQuery()).not.toContain("users { totalCount }")
  })

  /*
   * The shape axis exists for cost, so these pin cost-bearing selections by
   * name. `statusCheckRollup.contexts` appears on five PR sources and
   * `reviewThreads(first: 50)` multiplies beneath each — together they are why
   * the full query measures 73 points against a 5000/hour budget.
   */
  describe("shape", () => {
    it("defaults to full, so an existing caller keeps what it had", () => {
      expect(buildInboxQuery()).toBe(buildInboxQuery({ shape: "full" }))
    })

    it("drops health, conversation and labels when minimal", () => {
      const query = buildInboxQuery({ shape: "minimal" })
      for (const field of [
        "statusCheckRollup",
        "reviewThreads",
        "reviewDecision",
        "mergeable",
        "comments(",
        "labels(",
        "commits(",
        "reactionGroups",
      ])
        expect(query).not.toContain(field)
    })

    // Identity has to survive, or a minimal caller cannot render a row at all.
    it("keeps every field a row is identified by", () => {
      const query = buildInboxQuery({ shape: "minimal" })
      for (const alias of OPEN_PR_SOURCES) {
        const block = blockFor(query, alias)
        for (const field of ["number", "title", "url", "isDraft"])
          expect(block).toContain(field)
        expect(block).toContain("nameWithOwner")
      }
    })

    // isDraft used to live inside the health fragment, where dropping health
    // would have taken it — and a draft rendering as an open PR is a wrong
    // answer, not a missing one.
    //
    // Both shapes, because this protects cockpit as much as any minimal caller,
    // even though cockpit only ever asks for `full`. It splits Open from Draft
    // on `!n.isDraft` / `n.isDraft`, and falls back to `"isDraft" in node` to
    // tell a PR from an issue where a fragment omits `__typename` — so a PR
    // would drill into the issues endpoint. What protects it is the field being
    // in the base list, not the shape it requests: if it ever drifts back inside
    // health, `full` keeps working and nothing warns anyone until someone prunes
    // health for an unrelated reason.
    it("keeps isDraft on every open-PR source in both shapes", () => {
      for (const shape of ["full", "minimal"] as const)
        for (const alias of OPEN_PR_SOURCES)
          expect(blockFor(buildInboxQuery({ shape }), alias)).toContain(
            "isDraft",
          )
    })

    it("still asks every source, so sections cannot silently empty", () => {
      const query = buildInboxQuery({ shape: "minimal" })
      for (const alias of [...OPEN_PR_SOURCES, "repoIssues", "recentlyDone"])
        expect(query).toContain(`${alias}: search(`)
    })
  })

  it("windows recentlyDone and recomputes the date per call", () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400 * 1000)
      .toISOString()
      .slice(0, 10)

    expect(
      searchFor(buildInboxQuery({ doneWithinDays: 0 }), "recentlyDone"),
    ).toContain(`closed:>=${today}`)
    expect(
      searchFor(buildInboxQuery({ doneWithinDays: 1 }), "recentlyDone"),
    ).toContain(`closed:>=${yesterday}`)
  })
})

describe("sources", () => {
  it("asks only for what was named", () => {
    const query = buildInboxQuery({ sources: ["myPRs", "recentlyDone"] })
    expect(query).toContain("myPRs: search(")
    expect(query).toContain("recentlyDone: search(")
    for (const alias of ["reviewRequests", "reviewed", "assigned", "repoPRs"])
      expect(query).not.toContain(`${alias}: search(`)
  })

  // A subset is a whole document, not a fragment: the parts are issued as
  // separate requests, so anything the caller reads off the envelope has to be
  // on every one of them.
  it("keeps a subset a complete, self-describing document", () => {
    const query = buildInboxQuery({ sources: ["reviewed"] })
    expect(query).toContain("rateLimit { cost")
    expect(query).toContain("viewer { login }")
    expect(query.trim().startsWith("{")).toBe(true)
    expect(query.trim().endsWith("}")).toBe(true)
  })

  it("defaults to every source, so an existing caller keeps what it had", () => {
    expect(buildInboxQuery()).toBe(buildInboxQuery({ sources: INBOX_SOURCES }))
  })
})

describe("buildInboxQueries", () => {
  it("covers every source exactly once, in order", () => {
    const asked = buildInboxQueries()
      .flatMap((q) => [...q.matchAll(/^ {2}(\w+): search\(/gm)])
      .map((m) => m[1])
    expect(asked).toEqual([...INBOX_SOURCES])
  })

  it("splits into the requested number per request", () => {
    expect(buildInboxQueries({ sourcesPerQuery: 4 })).toHaveLength(2)
    expect(buildInboxQueries({ sourcesPerQuery: 1 })).toHaveLength(
      INBOX_SOURCES.length,
    )
  })

  // Asking for everything in one request is the shape that draws the 502s, so
  // it has to stay reachable deliberately rather than by accident — and when a
  // caller does ask for it, it must be the same query buildInboxQuery emits.
  it("collapses to the whole query when one request holds every source", () => {
    const [only, ...rest] = buildInboxQueries({ sourcesPerQuery: 99 })
    expect(rest).toHaveLength(0)
    expect(only).toBe(buildInboxQuery())
  })

  // Zero or a fraction would produce an infinite loop or an empty chunk, and
  // the failure would be a hung process rather than an error.
  it("refuses to split into nothing", () => {
    for (const sourcesPerQuery of [0, -3, 0.5])
      expect(buildInboxQueries({ sourcesPerQuery })).toHaveLength(
        INBOX_SOURCES.length,
      )
  })

  it("passes the scope and shape through to every part", () => {
    const parts = buildInboxQueries({ repo: "kud/ambre", shape: "minimal" })
    for (const part of parts) {
      expect(part).toContain("repo:kud/ambre")
      expect(part).not.toContain("statusCheckRollup")
    }
  })
})

describe("mergeInboxData", () => {
  const part = (
    alias: string,
    limit: Partial<{
      cost: number
      nodeCount: number
      remaining: number
      resetAt: string
    }> = {},
  ) => ({
    rateLimit: {
      cost: 10,
      nodeCount: 100,
      remaining: 4000,
      resetAt: "2026-08-28T10:00:00Z",
      ...limit,
    },
    viewer: { login: "kud" },
    [alias]: { nodes: [{ number: 1 }] },
  })

  it("puts every source back under its own alias", () => {
    const merged = mergeInboxData([part("myPRs"), part("recentlyDone")])
    expect(Object.keys(merged)).toContain("myPRs")
    expect(Object.keys(merged)).toContain("recentlyDone")
    expect(merged.viewer.login).toBe("kud")
  })

  // Each part was charged separately, so reporting one part's cost as the
  // inbox's would understate what the refresh actually spent — by a factor of
  // however many requests it took.
  it("sums what each part cost", () => {
    const merged = mergeInboxData([
      part("myPRs", { cost: 17, nodeCount: 3720 }),
      part("reviewed", { cost: 11, nodeCount: 2480 }),
    ])
    expect(merged.rateLimit.cost).toBe(28)
    expect(merged.rateLimit.nodeCount).toBe(6200)
  })

  // The parts run concurrently and the budget only falls, so the lowest reading
  // is the one closest to now — and its resetAt has to travel with it, or the
  // window and its expiry describe two different moments.
  it("keeps the scarcest reading of what is left", () => {
    const merged = mergeInboxData([
      part("myPRs", { remaining: 4000, resetAt: "2026-08-28T10:00:00Z" }),
      part("reviewed", { remaining: 3900, resetAt: "2026-08-28T11:00:00Z" }),
      part("assigned", { remaining: 3950, resetAt: "2026-08-28T10:30:00Z" }),
    ])
    expect(merged.rateLimit.remaining).toBe(3900)
    expect(merged.rateLimit.resetAt).toBe("2026-08-28T11:00:00Z")
  })

  it("has nothing to say when nothing answered", () => {
    expect(mergeInboxData([])).toBeUndefined()
    expect(mergeInboxData([undefined, null])).toBeUndefined()
  })
})

describe("source coverage", () => {
  it("every source asks for issueCount", () => {
    // The guard this pins used to exist only in a comment. `issueCount` was
    // fetched for `myPRs` and nothing else, so seven of eight sources could
    // truncate with nothing anywhere able to notice — which is what turned a
    // 30-row window over 95 issues into a stream of invented arrivals and
    // departures. A scalar costs nothing; there is no reason for a source to
    // opt out, so this asserts all of them rather than a list.
    const query = buildInboxQuery()
    for (const source of INBOX_SOURCES)
      expect(blockFor(query, source)).toContain("issueCount")
  })

  it("every source asks for exactly its declared cap", () => {
    // Cap and query used to be two copies of the same number, one of them
    // unreadable from outside. A comparison against a literal nobody can import
    // is not a comparison, so they are one value now and this stops them
    // becoming two again.
    const query = buildInboxQuery()
    for (const source of INBOX_SOURCES)
      expect(blockFor(query, source)).toContain(`first: ${SOURCE_LIMITS[source]}`)
  })

  it("calls a source truncated when it matched more than it returned", () => {
    const coverage = sourceCoverage({
      authoredIssues: { issueCount: 95, nodes: new Array(30).fill({}) },
    })
    expect(coverage.authoredIssues).toEqual({
      total: 95,
      shown: 30,
      truncated: true,
    })
  })

  it("calls a source whole when it returned everything it matched", () => {
    const coverage = sourceCoverage({
      myPRs: { issueCount: 8, nodes: new Array(8).fill({}) },
    })
    expect(coverage.myPRs?.truncated).toBe(false)
  })

  it("treats a missing issueCount as whole, never as truncated", () => {
    // The direction to fail in. A source that answered without a count must not
    // invent a truncation, because a consumer reads truncation as "presence
    // changes here mean nothing" — inventing one would silence real news.
    const coverage = sourceCoverage({ repoPRs: { nodes: [{}, {}] } })
    expect(coverage.repoPRs).toEqual({ total: 2, shown: 2, truncated: false })
  })

  it("says nothing about a source that did not answer", () => {
    // A part of the split query can fail on its own. An absent source is
    // unknown, not empty, and must not be reported as a whole source of zero.
    expect(sourceCoverage({ myPRs: { issueCount: 1, nodes: [{}] } }).repoIssues)
      .toBeUndefined()
  })

  it("lists only the truncated sources", () => {
    const data = {
      myPRs: { issueCount: 8, nodes: new Array(8).fill({}) },
      assigned: { issueCount: 37, nodes: new Array(30).fill({}) },
      repoIssues: { issueCount: 94, nodes: new Array(30).fill({}) },
    }
    expect(truncatedSources(data)).toEqual(["assigned", "repoIssues"])
  })

  it("survives no data at all", () => {
    expect(sourceCoverage(undefined)).toEqual({})
    expect(truncatedSources(undefined)).toEqual([])
  })
})
