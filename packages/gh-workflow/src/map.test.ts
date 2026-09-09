import { describe, expect, it } from "vitest"

import { computeHealth, healthOf, toGHItem } from "./map.js"

/*
 * These tests exist because 0.2.0 shipped a `toGHItem` that threw on any real
 * pull request. The extraction moved `toGHItem` out of @kud/gh-cockpit but left
 * behind the adapter that reshapes a GraphQL node into what `computeHealth`
 * expects — so the first PR with a status check produced "checks is not
 * iterable", and every existing test passed because none of them ever fed a node
 * through the mapper. The suite asserted what the package IMPORTED, never what
 * it DID.
 *
 * So the fixture below is deliberately shaped like the real thing: checks nested
 * under statusCheckRollup.contexts.nodes, threads under reviewThreads.nodes.
 * A fixture that flattens those would pass while the bug was present, which is
 * the only property that matters here.
 */

const pr = (over: Record<string, unknown> = {}) => ({
  __typename: "PullRequest",
  number: 42,
  title: "Make the thing work",
  url: "https://github.com/kud/thing/pull/42",
  repository: { nameWithOwner: "kud/thing" },
  author: { login: "kud" },
  createdAt: "2026-09-01T10:00:00Z",
  isDraft: false,
  mergeable: "MERGEABLE",
  reviewDecision: null,
  headRefName: "fix/thing",
  statusCheckRollup: {
    contexts: {
      nodes: [{ name: "build", status: "COMPLETED", conclusion: "SUCCESS" }],
    },
  },
  reviewThreads: { nodes: [{ isResolved: false }, { isResolved: true }] },
  comments: { totalCount: 0, nodes: [] },
  reviews: { totalCount: 0, nodes: [] },
  ...over,
})

describe("computeHealth", () => {
  it("reads checks out of the rollup rather than off the node", () => {
    expect(() => computeHealth(pr())).not.toThrow()
  })

  it("reports a failing check", () => {
    const node = pr({
      statusCheckRollup: {
        contexts: {
          nodes: [
            { name: "build", status: "COMPLETED", conclusion: "FAILURE" },
          ],
        },
      },
    })
    expect(computeHealth(node)).toBe("ci-fail")
  })

  it("reports a conflict", () => {
    expect(computeHealth(pr({ mergeable: "CONFLICTING" }))).toBe("conflict")
  })

  it("survives a node with no checks and no threads at all", () => {
    const bare = pr({ statusCheckRollup: null, reviewThreads: null })
    expect(() => computeHealth(bare)).not.toThrow()
  })
})

describe("toGHItem", () => {
  it("maps a real pull request node without throwing", () => {
    const item = toGHItem(pr())
    expect(item.kind).toBe("pr")
    expect(item.number).toBe(42)
    expect(item.repo).toBe("kud/thing")
    expect(item.url).toBe("https://github.com/kud/thing/pull/42")
  })

  it("counts only unresolved threads", () => {
    expect(toGHItem(pr()).unresolved).toBe(1)
  })

  // @kud/gh windows `reviewThreads` at `first: 10`, so on any PR carrying more
  // the nodes are a sample. Counting them reports fourteen threads as ten and
  // reports that as the whole number — the count has to come off the connection.
  it("takes the thread total from the connection, not from the window", () => {
    const deep = pr({
      reviewThreads: {
        totalCount: 14,
        nodes: Array.from({ length: 10 }, () => ({ isResolved: true })),
      },
    })
    expect(toGHItem(deep).detail?.threadsTotal).toBe(14)
  })

  // A caller whose own query omits the scalar still gets a number rather than
  // zero — the fixture above is exactly that query.
  it("falls back to the returned nodes when no total was selected", () => {
    expect(toGHItem(pr()).detail?.threadsTotal).toBe(2)
  })

  it("maps an issue node", () => {
    const issue = {
      __typename: "Issue",
      number: 7,
      title: "Something is wrong",
      url: "https://github.com/kud/thing/issues/7",
      repository: { nameWithOwner: "kud/thing" },
      createdAt: "2026-09-01T10:00:00Z",
      comments: { totalCount: 0, nodes: [] },
    }
    const item = toGHItem(issue)
    expect(item.kind).toBe("issue")
    expect(item.number).toBe(7)
  })
})

/*
 * A minimal node: exactly what `@kud/gh`'s `shape: "minimal"` returns. Identity
 * and `isDraft`, and no health selection at all — not a null `reviewDecision`,
 * an ABSENT one, which is the distinction `computeHealth` alone cannot make.
 */
const minimalPr = (over: Record<string, unknown> = {}) => ({
  __typename: "PullRequest",
  number: 42,
  title: "Make the thing work",
  url: "https://github.com/kud/thing/pull/42",
  repository: { nameWithOwner: "kud/thing" },
  author: { login: "kud" },
  createdAt: "2026-09-01T10:00:00Z",
  headRefName: "fix/thing",
  isDraft: false,
  ...over,
})

describe("healthOf", () => {
  it("declines rather than inventing `waiting` for an unread PR", () => {
    // The whole ladder falls through an absent reviewDecision, mergeable and
    // rollup to `waiting` — "nothing red, nothing running, nobody has reviewed
    // it" — which from the `queued` standing reads as YOUR MOVE. So the cheapest
    // fetch produced the most confident verdict, and it was asserted from three
    // fields nobody paid for.
    expect(computeHealth(minimalPr())).toBe("waiting")
    expect(healthOf(minimalPr())).toBeUndefined()
  })

  it("still reads a null reviewDecision as a real reading", () => {
    // The distinction the whole helper turns on: selected-and-null is an answer,
    // never-selected is not.
    expect(healthOf(pr())).toBe("threads")
    expect(healthOf(pr({ reviewDecision: null, reviewThreads: null }))).toBe(
      "waiting",
    )
  })

  it("keeps the four tokens the minimal shape can still support", () => {
    // Read off `state` and `isDraft`, both of which minimal carries — so they
    // are honest at any fetch depth and must not be blanked with the rest.
    expect(healthOf(minimalPr({ state: "MERGED" }))).toBe("merged")
    expect(healthOf(minimalPr({ state: "CLOSED" }))).toBe("closed")
    expect(healthOf(minimalPr({ isDraft: true }))).toBe("draft")
    expect(healthOf({ number: 7, title: "an issue" })).toBe("none")
  })

  it("gives toGHItem a row that carries everything but the verdict", () => {
    // Present, openable, and honest: the row keeps its title, repo, age and
    // link, and declines only the thing it was never given the facts for.
    const item = toGHItem(minimalPr())
    expect(item.health).toBeUndefined()
    expect(item.title).toBe("Make the thing work")
    expect(item.repo).toBe("kud/thing")
    expect(item.url).toBe("https://github.com/kud/thing/pull/42")
    expect(item.age).not.toBe("")
  })
})
