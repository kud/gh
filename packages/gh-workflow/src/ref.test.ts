import { describe, expect, it } from "vitest"
import { refCandidates, resolveRef, type FetchItemNode } from "./ref.js"
import { whoseMove } from "./core.js"

// Real node shapes, as `fetchItemNode` returns them: the subject is the
// MAPPING, so a hand-built stub of what toGHItem would have produced would test
// nothing.
const prNode = (repo: string, number: number) => ({
  __typename: "PullRequest",
  id: `PR_${number}`,
  number,
  title: "Tighten the retry budget",
  state: "OPEN",
  createdAt: "2026-10-01T09:00:00Z",
  url: `https://github.com/${repo}/pull/${number}`,
  headRefName: "fix/retry-budget",
  isDraft: false,
  repository: { nameWithOwner: repo },
  author: { login: "someone-else" },
  additions: 18,
  deletions: 4,
  changedFiles: 2,
  reviewDecision: "REVIEW_REQUIRED",
  mergeable: "MERGEABLE",
  statusCheckRollup: {
    contexts: {
      nodes: [{ name: "ci", conclusion: "SUCCESS", status: "COMPLETED" }],
    },
  },
  reactionGroups: [],
  comments: { totalCount: 0, nodes: [] },
  reviews: { nodes: [] },
  reviewThreads: { totalCount: 0, nodes: [] },
  commits: { nodes: [{ commit: { committedDate: "2026-10-01T09:00:00Z" } }] },
  labels: { nodes: [{ name: "backend" }] },
})

const issueNode = (repo: string, number: number) => ({
  __typename: "Issue",
  number,
  title: "Gateway drops the trace header",
  state: "OPEN",
  createdAt: "2026-10-02T09:00:00Z",
  url: `https://github.com/${repo}/issues/${number}`,
  repository: { nameWithOwner: repo },
  author: { login: "kud" },
  comments: { totalCount: 1, nodes: [] },
  labels: { nodes: [] },
})

const fake = (
  nodes: Record<string, unknown>,
): FetchItemNode & { asked: string[] } => {
  const asked: string[] = []
  const fn = async (repo: string, number: number) => {
    asked.push(`${repo}#${number}`)
    return nodes[`${repo}#${number}`] ?? null
  }
  return Object.assign(fn, { asked })
}

describe("resolveRef", () => {
  it("maps a fetched PR through toGHItem, health included", async () => {
    const fetchNode = fake({
      "acme/api-gateway#2926": prNode("acme/api-gateway", 2926),
    })
    const item = await resolveRef(
      "https://github.com/acme/api-gateway/pull/2926",
      { fetchNode },
    )
    expect(item).toMatchObject({
      kind: "pr",
      number: 2926,
      repo: "acme/api-gateway",
      url: "https://github.com/acme/api-gateway/pull/2926",
      branch: "fix/retry-budget",
      health: "waiting",
      additions: 18,
      labels: ["backend"],
    })
    // The reason the selections are shared: a row without health answers
    // `unknown` here and its drill loses the actions keyed off it.
    expect(whoseMove(item!.health, "review")).not.toBe("unknown")
  })

  // The bug the first draft shipped: shorthand was assumed to be a PR.
  it("takes the kind from the node, not the text", async () => {
    const fetchNode = fake({
      "acme/api-gateway#41": issueNode("acme/api-gateway", 41),
    })
    const item = await resolveRef("acme/api-gateway#41", { fetchNode })
    expect(item?.kind).toBe("issue")
    expect(item?.url).toBe("https://github.com/acme/api-gateway/issues/41")
  })

  it("prices a merged PR as merged, off the state the lookup asks for", async () => {
    const fetchNode = fake({
      "acme/api-gateway#7": {
        ...prNode("acme/api-gateway", 7),
        state: "MERGED",
      },
    })
    const item = await resolveRef("acme/api-gateway#7", { fetchNode })
    expect(item?.health).toBe("merged")
  })

  it("tries a bare #N against the active row's repo first, then the inbox's", async () => {
    const fetchNode = fake({ "acme/web#12": prNode("acme/web", 12) })
    const item = await resolveRef("#12", {
      fetchNode,
      activeRepo: "acme/api-gateway",
      repos: ["acme/api-gateway", "acme/web", "acme/docs"],
    })
    expect(fetchNode.asked).toEqual(["acme/api-gateway#12", "acme/web#12"])
    expect(item?.repo).toBe("acme/web")
  })

  it("never fetches more than the explicit repo for a full reference", async () => {
    const fetchNode = fake({})
    expect(
      await resolveRef("acme/api-gateway#5", {
        fetchNode,
        activeRepo: "acme/web",
        repos: ["acme/docs"],
      }),
    ).toBeNull()
    expect(fetchNode.asked).toEqual(["acme/api-gateway#5"])
  })

  it("returns null when no candidate holds the number", async () => {
    const fetchNode = fake({})
    expect(
      await resolveRef("#99", { fetchNode, repos: ["acme/web"] }),
    ).toBeNull()
    expect(await resolveRef("#99", { fetchNode: fake({}) })).toBeNull()
  })

  it("propagates a failed fetch rather than reading it as a miss", async () => {
    let calls = 0
    const fetchNode: FetchItemNode = async () => {
      calls++
      throw new Error("ECONNREFUSED")
    }
    await expect(
      resolveRef("#3", { fetchNode, repos: ["acme/web", "acme/docs"] }),
    ).rejects.toThrow("ECONNREFUSED")
    expect(calls).toBe(1)
  })

  it("throws on input that is not a reference", async () => {
    await expect(
      resolveRef("SHOP-1234", { fetchNode: fake({}) }),
    ).rejects.toThrow("not a PR or issue reference")
  })
})

describe("refCandidates", () => {
  it("puts the active repo first and asks about each repo once", () => {
    expect(
      refCandidates("Acme/Web", ["acme/api-gateway", "acme/web", "acme/docs"]),
    ).toEqual(["Acme/Web", "acme/api-gateway", "acme/docs"])
    expect(refCandidates(undefined, [])).toEqual([])
  })
})
