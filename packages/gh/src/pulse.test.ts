import { describe, expect, it } from "vitest"

import { MY_PRS_LIMIT, buildPulseQuery, pulseFingerprint } from "./index.js"

const searchFor = (query: string, alias: string) =>
  query.match(new RegExp(`${alias}: search\\(query: "([^"]*)"`))?.[1] ?? ""

const pr = (
  repo: string,
  number: number,
  mergeable: string,
  state: string | null,
) => ({
  number,
  mergeable,
  repository: { nameWithOwner: repo },
  commits: {
    nodes: [{ commit: { statusCheckRollup: state ? { state } : null } }],
  },
})

const base = () => ({
  involved: { nodes: [{ updatedAt: "2026-09-27T10:00:00Z" }] },
  owned: { nodes: [{ updatedAt: "2026-09-27T09:00:00Z" }] },
  reviewRequests: { nodes: [] },
  myPRs: {
    nodes: [
      pr("kud/glyphs", 15, "MERGEABLE", "PENDING"),
      pr("kud/gh", 3, "UNKNOWN", null),
    ],
  },
})

describe("buildPulseQuery", () => {
  it("asks for the newest change in each scope, one row apiece", () => {
    const query = buildPulseQuery()
    expect(searchFor(query, "involved")).toBe("involves:@me sort:updated-desc")
    expect(searchFor(query, "owned")).toBe(
      "user:@me archived:false sort:updated-desc",
    )
    expect(searchFor(query, "reviewRequests")).toBe(
      "is:pr is:open review-requested:@me sort:updated-desc",
    )
    expect(query.match(/first: 1\)/g)).toHaveLength(3)
  })

  it("watches my open PRs at the inbox's own cap, with the states updatedAt misses", () => {
    const query = buildPulseQuery()
    expect(searchFor(query, "myPRs")).toBe("is:pr is:open author:@me")
    expect(query).toContain(`first: ${MY_PRS_LIMIT})`)
    expect(query).toContain("mergeable")
    expect(query).toContain("statusCheckRollup { state }")
    expect(query).toContain("rateLimit { cost remaining }")
  })

  it("replaces user:@me with repo: under a repo scope, as the inbox does", () => {
    const query = buildPulseQuery({ repo: "kud/gh" })
    expect(searchFor(query, "owned")).toBe(
      "repo:kud/gh archived:false sort:updated-desc",
    )
    expect(searchFor(query, "involved")).toBe(
      "repo:kud/gh involves:@me sort:updated-desc",
    )
    expect(query).not.toContain("user:@me")
  })

  it("stops watching a hidden repo, on every alias the inbox hides it from", () => {
    const query = buildPulseQuery({ excludeRepos: ["acme/scratch"] })
    expect(searchFor(query, "owned")).toBe(
      "-repo:acme/scratch user:@me archived:false sort:updated-desc",
    )
    for (const alias of ["involved", "reviewRequests", "myPRs"])
      expect(searchFor(query, alias)).toContain("-repo:acme/scratch")
  })
})

describe("pulseFingerprint", () => {
  it("is stable for the same board", () => {
    expect(pulseFingerprint(base())).toBe(pulseFingerprint(base()))
  })

  it("changes on a newer updatedAt in any timestamp search", () => {
    const next = base()
    next.reviewRequests.nodes = [{ updatedAt: "2026-09-27T11:00:00Z" }] as any
    expect(pulseFingerprint(next)).not.toBe(pulseFingerprint(base()))
  })

  it("does not change when an older row moves below the newest", () => {
    const next = base()
    next.owned.nodes = [{ updatedAt: "2026-09-27T09:30:00Z" }]
    expect(pulseFingerprint(next)).toBe(pulseFingerprint(base()))
  })

  it("changes on a mergeable flip", () => {
    const next = base()
    next.myPRs.nodes[0] = pr("kud/glyphs", 15, "CONFLICTING", "PENDING")
    expect(pulseFingerprint(next)).not.toBe(pulseFingerprint(base()))
  })

  it("changes when a rollup finishes without updatedAt moving", () => {
    const next = base()
    next.myPRs.nodes[0] = pr("kud/glyphs", 15, "MERGEABLE", "SUCCESS")
    expect(pulseFingerprint(next)).not.toBe(pulseFingerprint(base()))
  })

  it("is stable under reordering of my PRs", () => {
    const next = base()
    next.myPRs.nodes.reverse()
    expect(pulseFingerprint(next)).toBe(pulseFingerprint(base()))
  })

  it("tells the same number in two repos apart", () => {
    const a = base()
    const b = base()
    a.myPRs.nodes = [pr("kud/a", 1, "MERGEABLE", "SUCCESS")]
    b.myPRs.nodes = [pr("kud/b", 1, "MERGEABLE", "SUCCESS")]
    expect(pulseFingerprint(a)).not.toBe(pulseFingerprint(b))
  })

  it("degrades a partial response to empty rather than throwing", () => {
    expect(() => pulseFingerprint(null)).not.toThrow()
    expect(pulseFingerprint({ involved: null, myPRs: { nodes: [null] } })).toBe(
      "|",
    )
  })
})
