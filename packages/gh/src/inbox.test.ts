import { describe, expect, it } from "vitest"

import {
  HEALTH_BATCH_SIZE,
  INBOX_SOURCES,
  SOURCE_LIMITS,
  sourceCoverage,
  truncatedSources,
  buildHealthQueries,
  buildHealthQuery,
  buildInboxQueries,
  buildInboxQuery,
  healthIdsFrom,
  limitsFor,
  mergeHealth,
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

/*
 * A merged tab sums its sources' `issueCount`s, and a sum is only meaningful if
 * the sets cannot intersect. That disjointness is bought in the QUERY TEXT — by
 * each source negating the ones that claim rows before it — and these pin it,
 * because it is invisible at every other layer: the rows come out right either
 * way, since `pick` dedups by URL, and only the totals go wrong.
 *
 * Measured 2026-09-07: 94 own-repo issues, 95 authored, 92 of them BOTH. Summed
 * naively that claimed 189 where the truth was 97.
 */
describe("merged tabs stay disjoint by construction", () => {
  it("asks for authored issues only OUTSIDE the repos you own", () => {
    const q = searchFor(buildInboxQuery(), "authoredIssues")
    expect(q).toContain("author:@me")
    expect(q).toContain("-user:@me")
  })

  it("pairs it with a repoIssues that claims exactly what it excludes", () => {
    // The two halves of one partition. If this ever stops saying `user:@me`,
    // the negation above is excluding something nothing else collects.
    expect(searchFor(buildInboxQuery(), "repoIssues")).toContain("user:@me")
  })

  // Review carried this shape from the start, which is why it was never wrong
  // while Issues was. Pinned so the pattern reads as a rule rather than a quirk.
  it("keeps reviewed disjoint from reviewRequests the same way", () => {
    expect(searchFor(buildInboxQuery(), "reviewed")).toContain(
      "-review-requested:@me",
    )
  })

  /*
   * Under a `repo:` scope `user:@me` is REPLACED rather than joined, so there is
   * no "outside the repos you own" for the negation to name, and the search
   * degrades to a strict subset of `repoIssues` — every row discarded by `pick`,
   * paid for on every scoped fetch.
   */
  it("drops authored issues entirely under a repo scope", () => {
    const query = buildInboxQuery({ repo: "kud/ambre" })
    expect(query).not.toContain("authoredIssues: search(")
    expect(query).toContain("repoIssues: search(")
  })

  // Both builders resolved the source list independently, which is the exact
  // shape where this half-lands: one path drops the source, the other keeps
  // asking, and nothing reports the disagreement.
  it("drops it on the split path too, not just the single document", () => {
    const queries = buildInboxQueries({ repo: "kud/ambre" })
    expect(queries.join("\n")).not.toContain("authoredIssues: search(")
    expect(queries.join("\n")).toContain("repoIssues: search(")
  })

  it("still asks for it when no repo scope is set", () => {
    expect(buildInboxQueries().join("\n")).toContain("authoredIssues: search(")
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
      expect(blockFor(query, source)).toContain(
        `first: ${SOURCE_LIMITS[source]}`,
      )
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
    expect(
      sourceCoverage({ myPRs: { issueCount: 1, nodes: [{}] } }).repoIssues,
    ).toBeUndefined()
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

describe("per-source limits", () => {
  it("leaves every default in place when nothing is asked for", () => {
    // The whole option is additive, and this is what that has to mean: a caller
    // that passes no limits gets byte-for-byte the query it got before the
    // option existed.
    expect(limitsFor()).toEqual(SOURCE_LIMITS)
    expect(buildInboxQuery({ limits: {} })).toBe(buildInboxQuery())
  })

  it("overrides one source and leaves its neighbours alone", () => {
    const query = buildInboxQuery({ limits: { reviewRequests: 100 } })
    expect(blockFor(query, "reviewRequests")).toContain("first: 100")
    for (const source of INBOX_SOURCES)
      if (source !== "reviewRequests")
        expect(blockFor(query, source)).toContain(
          `first: ${SOURCE_LIMITS[source]}`,
        )
  })

  it("reaches the overflow tier the two-tier fetch is for", () => {
    // The combination that answers where neither half does alone: 99 rows of
    // the cheap fragment. A full fragment 502s at this cap and `minimal` at the
    // default cap still shows 20 of 99.
    const query = buildInboxQuery({
      sources: ["reviewRequests"],
      shape: "minimal",
      limits: { reviewRequests: 100 },
    })
    expect(query).toContain("first: 100")
    expect(query).not.toContain("statusCheckRollup")
    expect(query).not.toContain("reviewThreads")
  })

  it("clamps a limit GitHub would reject rather than losing the query", () => {
    // `first: 0`, a negative and a fraction are all document errors, so an
    // unclamped bad number costs the whole search instead of a few rows. 100 is
    // the search API's own maximum — asking for 200 fails, it does not return
    // 200.
    expect(limitsFor({ limits: { myPRs: 0 } }).myPRs).toBe(1)
    expect(limitsFor({ limits: { myPRs: -5 } }).myPRs).toBe(1)
    expect(limitsFor({ limits: { myPRs: 30.7 } }).myPRs).toBe(30)
    expect(limitsFor({ limits: { myPRs: 500 } }).myPRs).toBe(100)
    expect(limitsFor({ limits: { myPRs: Number.NaN } }).myPRs).toBe(
      SOURCE_LIMITS.myPRs,
    )
  })

  it("carries the override through the split queries too", () => {
    // `buildInboxQueries` resolves its own options, which is exactly the shape
    // where a change like this half-lands — the single-document path honours it
    // and the split path goes on asking for the default.
    const queries = buildInboxQueries({
      sources: ["reviewRequests", "reviewed"],
      limits: { reviewRequests: 50 },
    })
    const joined = queries.join("\n")
    expect(blockFor(joined, "reviewRequests")).toContain("first: 50")
    expect(blockFor(joined, "reviewed")).toContain(
      `first: ${SOURCE_LIMITS.reviewed}`,
    )
  })
})

/* A row as the minimal shape returns it: identity, no health selection. */
const overflowPr = (id: string, extra: Record<string, unknown> = {}) => ({
  __typename: "PullRequest",
  id,
  number: 1,
  title: "a pull request",
  isDraft: false,
  ...extra,
})

/* The same row as tier three answers for it. */
const enriched = (id: string, extra: Record<string, unknown> = {}) => ({
  __typename: "PullRequest",
  id,
  reviewDecision: "REVIEW_REQUIRED",
  mergeable: "MERGEABLE",
  statusCheckRollup: { contexts: { nodes: [] } },
  ...extra,
})

const withRows = (source: string, nodes: unknown[]) => ({
  [source]: { issueCount: nodes.length, nodes },
})

describe("addressable PR rows", () => {
  it("selects an id on every source that can be enriched", () => {
    const query = buildInboxQuery()
    for (const alias of OPEN_PR_SOURCES)
      expect(blockFor(query, alias)).toMatch(/\bid number title\b/)
  })

  it("keeps the id in the minimal shape, where tier three needs it", () => {
    const query = buildInboxQuery({ shape: "minimal" })
    expect(blockFor(query, "reviewRequests")).toMatch(/\bid number title\b/)
    expect(blockFor(query, "reviewRequests")).not.toContain("reviewDecision")
  })
})

describe("healthIdsFrom", () => {
  it("names the rows that arrived without a health selection", () => {
    const data = withRows("reviewRequests", [
      overflowPr("PR_one"),
      overflowPr("PR_two"),
    ])
    expect(healthIdsFrom(data)).toEqual(["PR_one", "PR_two"])
  })

  it("leaves out a row that already carries a verdict", () => {
    const data = withRows("reviewRequests", [
      overflowPr("PR_cheap"),
      enriched("PR_full", { number: 2, title: "t", isDraft: false }),
    ])
    expect(healthIdsFrom(data)).toEqual(["PR_cheap"])
  })

  it("leaves out rows whose health needs no selection", () => {
    const data = withRows("recentlyDone", [
      overflowPr("PR_merged", { state: "MERGED" }),
      overflowPr("PR_closed", { state: "CLOSED" }),
      overflowPr("PR_draft", { isDraft: true }),
    ])
    expect(healthIdsFrom(data)).toEqual([])
  })

  it("ignores issues, which have no health to fetch", () => {
    const data = withRows("repoIssues", [
      { __typename: "Issue", id: "I_one", number: 3, title: "an issue" },
    ])
    expect(healthIdsFrom(data)).toEqual([])
  })

  it("ignores a row with no id, rather than addressing nothing", () => {
    const data = withRows("reviewRequests", [
      { __typename: "PullRequest", number: 4, title: "no id" },
    ])
    expect(healthIdsFrom(data)).toEqual([])
  })

  it("names one row once, however many sources hold it", () => {
    const data = {
      ...withRows("reviewRequests", [overflowPr("PR_same")]),
      ...withRows("repoPRs", [overflowPr("PR_same")]),
    }
    expect(healthIdsFrom(data)).toEqual(["PR_same"])
  })

  it("looks only at the sources it was asked about", () => {
    const data = {
      ...withRows("reviewRequests", [overflowPr("PR_wanted")]),
      ...withRows("repoPRs", [overflowPr("PR_other")]),
    }
    expect(healthIdsFrom(data, ["reviewRequests"])).toEqual(["PR_wanted"])
  })

  it("survives no data at all", () => {
    expect(healthIdsFrom(undefined)).toEqual([])
  })
})

describe("buildHealthQuery", () => {
  it("addresses the ids it was given", () => {
    const query = buildHealthQuery(["PR_one", "PR_two"])
    expect(query).toContain('nodes(ids: ["PR_one", "PR_two"])')
  })

  it("asks for health AND conversation, never health alone", () => {
    const query = buildHealthQuery(["PR_one"])
    expect(query).toContain("reviewDecision")
    expect(query).toContain("statusCheckRollup")
    /* computeHealth reads unresolvedThreads out of this one. */
    expect(query).toContain("reviewThreads")
  })

  it("reports what it cost, like every other query here", () => {
    expect(buildHealthQuery(["PR_one"])).toContain("rateLimit")
  })
})

describe("buildHealthQueries", () => {
  it("splits at the measured batch size", () => {
    const ids = Array.from({ length: 80 }, (_, i) => `PR_${i}`)
    expect(buildHealthQueries(ids)).toHaveLength(
      Math.ceil(80 / HEALTH_BATCH_SIZE),
    )
  })

  it("carries every id exactly once across the batches", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `PR_${i}`)
    const joined = buildHealthQueries(ids).join("\n")
    for (const id of ids)
      expect(joined.match(new RegExp(`"${id}"`, "g"))).toHaveLength(1)
  })

  it("has nothing to ask when nothing lacks health", () => {
    expect(buildHealthQueries([])).toEqual([])
  })

  it("refuses to split into nothing", () => {
    expect(buildHealthQueries(["PR_one", "PR_two"], 0)).toHaveLength(2)
  })
})

describe("mergeHealth", () => {
  it("gives an overflow row the verdict it was fetched without", () => {
    const data = withRows("reviewRequests", [overflowPr("PR_one")])
    const merged = mergeHealth(data, [{ nodes: [enriched("PR_one")] }])
    expect(merged.reviewRequests.nodes[0].reviewDecision).toBe(
      "REVIEW_REQUIRED",
    )
    expect(merged.reviewRequests.nodes[0].title).toBe("a pull request")
  })

  it("leaves a row alone when its batch answered nothing", () => {
    const data = withRows("reviewRequests", [overflowPr("PR_one")])
    const merged = mergeHealth(data, [undefined, { nodes: [null] }])
    expect(merged.reviewRequests.nodes[0]).not.toHaveProperty("reviewDecision")
  })

  it("refuses a node missing one of the health keys", () => {
    const partial = enriched("PR_one")
    delete (partial as Record<string, unknown>).mergeable
    const data = withRows("reviewRequests", [overflowPr("PR_one")])
    const merged = mergeHealth(data, [{ nodes: [partial] }])
    expect(merged.reviewRequests.nodes[0]).not.toHaveProperty("reviewDecision")
  })

  it("refuses a null rollup, which would read as no checks rather than none asked", () => {
    const data = withRows("reviewRequests", [overflowPr("PR_one")])
    const merged = mergeHealth(data, [
      { nodes: [enriched("PR_one", { statusCheckRollup: null })] },
    ])
    expect(merged.reviewRequests.nodes[0]).not.toHaveProperty("reviewDecision")
  })

  it("merges the batches that answered and skips the ones that did not", () => {
    const data = withRows("reviewRequests", [
      overflowPr("PR_one"),
      overflowPr("PR_two"),
    ])
    const merged = mergeHealth(data, [undefined, { nodes: [enriched("PR_two")] }])
    expect(merged.reviewRequests.nodes[0]).not.toHaveProperty("reviewDecision")
    expect(merged.reviewRequests.nodes[1]).toHaveProperty("reviewDecision")
  })

  it("does not touch what it was given", () => {
    const data = withRows("reviewRequests", [overflowPr("PR_one")])
    mergeHealth(data, [{ nodes: [enriched("PR_one")] }])
    expect(data.reviewRequests.nodes[0]).not.toHaveProperty("reviewDecision")
  })

  it("survives no data at all", () => {
    expect(mergeHealth(undefined, [{ nodes: [enriched("PR_one")] }])).toBeUndefined()
  })
})
