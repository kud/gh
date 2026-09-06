import { describe, expect, it } from "vitest"

import { computeHealth, toGHItem } from "./map.js"

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
