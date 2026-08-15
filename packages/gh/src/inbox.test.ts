import { describe, expect, it } from "vitest"

import { buildInboxQuery } from "./index.js"

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

  /*
   * The shape axis exists for cost, so these pin cost-bearing selections by
   * name. `statusCheckRollup.contexts` appears on five PR sources and
   * `reviewThreads(first: 50)` multiplies beneath each — together they are why
   * the full query measures 111 points against a 5000/hour budget.
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
