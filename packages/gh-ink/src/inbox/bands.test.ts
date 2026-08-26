import { describe, expect, it } from "vitest"

import { layoutGHItems, whoseMove, type GHItem } from "./inbox.js"

/*
 * The 2026-08-26 case: the Review tab held 20 rows across five repos, of which
 * exactly two could be reviewed. The other eighteen were red CI, merge
 * conflicts and drafts — all of them the author's problem, none of them
 * yours, and all of them interleaved with the two that were.
 *
 * Repo grouping cannot express that, because it is the wrong axis: the tab
 * already says which relationship you are looking at, and nothing said whether
 * there was anything to do once you got there. What is pinned here is that the
 * band is decided by health AND tab together — the same token means opposite
 * things on `open` and on `review`, so a classifier that reads only the row is
 * wrong half the time and looks right the other half.
 */

const item = (
  over: Partial<GHItem> & { repo: string; number: number },
): GHItem => ({
  kind: "pr",
  title: "",
  url: "",
  health: "waiting",
  age: "",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
  ...over,
})

const labels = (rows: ReturnType<typeof layoutGHItems>) =>
  rows.flatMap((r) => (r.kind === "subgroup-header" ? [r.label] : []))

const numbers = (rows: ReturnType<typeof layoutGHItems>) =>
  rows.flatMap((r) => (r.kind === "pr" || r.kind === "issue" ? [r.number] : []))

describe("whoseMove", () => {
  it("flips the mechanical blockers with the side you stand on", () => {
    // Red CI on a PR you wrote is an afternoon's work. The same red CI on one
    // you were asked to review is the author's, and reviewing it is wasted.
    expect(whoseMove("ci-fail", "open")).toBe("you")
    expect(whoseMove("ci-fail", "review")).toBe("them")
    expect(whoseMove("conflict", "open")).toBe("you")
    expect(whoseMove("conflict", "review")).toBe("them")
    expect(whoseMove("changes-req", "open")).toBe("you")
    expect(whoseMove("changes-req", "review")).toBe("them")
  })

  it("flips the review-queue states the other way", () => {
    // "Awaiting review" on your own PR means waiting on somebody else; on a PR
    // whose review was asked of you, you ARE the somebody else.
    expect(whoseMove("waiting", "open")).toBe("them")
    expect(whoseMove("waiting", "review")).toBe("you")
    expect(whoseMove("pending", "open")).toBe("them")
    expect(whoseMove("pending", "review")).toBe("you")
  })

  it("keeps threads and approval yours while a review is still wanted", () => {
    for (const tab of ["open", "review", "incoming", "assigned"]) {
      expect(whoseMove("threads", tab)).toBe("you")
      expect(whoseMove("approved", tab)).toBe("you")
    }
  })

  it("claims nothing but threads on a PR you have already reviewed", () => {
    // `reviewed` is `reviewed-by:@me -author:@me -review-requested:@me`, so
    // GitHub is provably not waiting on you there and a re-request moves the
    // row to `review`. Only an open thread is still yours; an approval is the
    // author's to merge and "awaiting review" is somebody else's queue.
    expect(whoseMove("threads", "reviewed")).toBe("you")
    for (const h of ["waiting", "pending", "approved", "ci-fail"] as const)
      expect(whoseMove(h, "reviewed")).toBe("them")
  })

  it("never claims a draft or an unknown", () => {
    for (const tab of ["open", "review", "reviewed"]) {
      expect(whoseMove("draft", tab)).toBe("them")
      expect(whoseMove("none", tab)).toBe("them")
    }
  })

  it("reads a folded `mine` tab exactly like `open` and `draft`", () => {
    // Folding your own PRs into one tab must not change any row's band — the
    // draft-ness the old split expressed is already on the row.
    for (const h of ["ci-fail", "waiting", "approved", "draft"] as const)
      expect(whoseMove(h, "mine")).toBe(whoseMove(h, "open"))
  })

  it("treats an unrecognised tab as a review queue", () => {
    // A host adding a tab gets the reviewer reading, never the authored one —
    // over-claiming a stranger's PR as your work is the worse wrong guess.
    expect(whoseMove("waiting", "some-new-tab")).toBe("you")
    expect(whoseMove("ci-fail", "some-new-tab")).toBe("them")
  })
})

describe("layoutGHItems bands", () => {
  it("splits a mixed tab into two counted bands, yours first", () => {
    const rows = [
      item({
        repo: "theorchard/graphql-abacus",
        number: 1496,
        health: "ci-fail",
      }),
      item({
        repo: "theorchard/graphql-abacus",
        number: 1495,
        health: "threads",
      }),
      item({
        repo: "theorchard/graphql-abacus",
        number: 1449,
        health: "conflict",
      }),
      item({
        repo: "theorchard/ows-abacus-event",
        number: 290,
        health: "waiting",
      }),
    ]

    const laid = layoutGHItems(rows, "review")

    expect(labels(laid)).toEqual(["Your move (2)", "Their move (2)"])
    expect(numbers(laid)).toEqual([1495, 290, 1496, 1449])
  })

  it("puts the same rows in the opposite bands on an authored tab", () => {
    const rows = [
      item({ repo: "kud/ambre", number: 1, health: "ci-fail" }),
      item({ repo: "kud/ambre", number: 2, health: "waiting" }),
    ]

    expect(numbers(layoutGHItems(rows, "review"))).toEqual([2, 1])
    expect(numbers(layoutGHItems(rows, "open"))).toEqual([1, 2])
  })

  it("leaves a single-sided tab as a plain list", () => {
    // Not an edge case: Draft and Issues are single-sided by construction, and
    // two headers over one undivided list is ceremony with no information in it.
    const rows = [
      item({ repo: "kud/ambre", number: 1, health: "draft" }),
      item({ repo: "kud/shui", number: 2, health: "draft" }),
    ]

    const laid = layoutGHItems(rows, "draft")
    expect(labels(laid)).toEqual([])
    expect(numbers(laid)).toEqual([1, 2])
  })

  it("restarts repo headers inside each band", () => {
    // A repo with work on both sides of the line appears under each — the band
    // is the outer key now, so its header cannot be shared across the split.
    const rows = [
      item({ repo: "kud/ambre", number: 1, health: "waiting" }),
      item({ repo: "kud/ambre", number: 2, health: "ci-fail" }),
    ]

    const headers = layoutGHItems(rows, "review").filter(
      (r) => r.kind === "repo-header",
    )
    expect(headers).toHaveLength(2)
  })

  it("never bands the Done tab", () => {
    // Done is a timeline, and "whose move" is a question about live work.
    const rows = [
      item({ repo: "kud/ambre", number: 1, health: "merged", ts: 1 }),
      item({ repo: "kud/shui", number: 2, health: "approved", ts: 9 }),
    ]

    expect(labels(layoutGHItems(rows, "done"))).toEqual([])
  })
})
