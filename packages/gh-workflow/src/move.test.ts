import { beforeEach, describe, expect, it } from "vitest"

import {
  filterByOrigin,
  filterByRepos,
  filterBySearch,
  layoutGHItems,
  whoseMove,
  type GHItem,
  type Move,
  type Standing,
  type Section,
} from "./core.js"
import { resetInboxConfig } from "./config.js"
import type { Health } from "@kud/gh/health"

/*
 * The invariant this file exists for, stated once: AN ABSENT VERDICT MUST NEVER
 * RENDER AS `them`.
 *
 * Everything below is that sentence checked from a different angle. It is
 * asserted exhaustively rather than on a sampled tab because the original defect
 * was `includes(undefined)` — false for every position at once, so any single
 * case would have caught it and none of them was written.
 */

const SECTION_IDS = [
  "mine",
  "open",
  "draft",
  "assigned",
  "issues",
  "review",
  "incoming",
  "reviewed",
  "a-tab-this-library-has-never-heard-of",
]

const STANDINGS: Standing[] = ["authored", "queued", "spoken"]

const HEALTHS: Health[] = [
  "ci-fail",
  "conflict",
  "changes-req",
  "threads",
  "pending",
  "approved",
  "waiting",
  "draft",
  "merged",
  "closed",
  "none",
]

let serial = 0

const row = (over: Partial<GHItem> = {}): GHItem => {
  serial += 1
  return {
    kind: "pr",
    number: serial,
    title: `row ${serial}`,
    repo: "kud/thing",
    url: `https://github.com/kud/thing/pull/${serial}`,
    health: "waiting",
    age: "2d",
    ts: 1_000 - serial,
    unresolved: 0,
    conversation: 0,
    ...over,
  }
}

const headers = (rows: ReturnType<typeof layoutGHItems>) =>
  rows.flatMap((r) => (r.kind === "subgroup-header" ? [r.label] : []))

const bandOf = (rows: ReturnType<typeof layoutGHItems>, title: string) => {
  const out: GHItem[] = []
  let inside = false
  for (const r of rows) {
    if (r.kind === "subgroup-header") {
      inside = r.label.startsWith(title)
      continue
    }
    if (inside && (r.kind === "pr" || r.kind === "issue")) out.push(r)
  }
  return out
}

beforeEach(resetInboxConfig)

describe("a row with no health never resolves to them", () => {
  it("holds for every section id, with and without a standing", () => {
    // The measured case: the two-tier fetch asks for 99 review requests with the
    // cheap fragment, and 79 of them arrive carrying no health at all. Filing
    // those under Their move would have reproduced the reported complaint —
    // rows missing from the column that was reported missing — while looking
    // like the fix for it.
    for (const sectionId of SECTION_IDS) {
      expect(whoseMove(undefined, sectionId)).not.toBe("them")
      expect(whoseMove(undefined, sectionId)).toBe("unknown")
      for (const standing of STANDINGS) {
        expect(whoseMove(undefined, sectionId, standing)).not.toBe("them")
        expect(whoseMove(undefined, sectionId, standing)).toBe("unknown")
      }
    }
  })

  it("holds when the last word was theirs on somebody else's row", () => {
    // `theySpokeLast` claims a row only from `authored`. From the other two it
    // is deliberately not a claim — and the row must still decline rather than
    // fall through to them.
    for (const standing of ["queued", "spoken"] as Standing[])
      expect(whoseMove(undefined, "review", standing, true)).toBe("unknown")
  })
})

describe("an issue's absent review state is the same absence", () => {
  it("never resolves `none` to them, from any position", () => {
    // All 44 rows matching `assignee:@me` are issues, an issue has no review
    // state to read, and every one of them resolved to `them` — which is why
    // the column headed "Assigned to you" read 0 while 44 items matched.
    for (const sectionId of SECTION_IDS) {
      expect(whoseMove("none", sectionId)).not.toBe("them")
      for (const standing of STANDINGS)
        expect(whoseMove("none", sectionId, standing)).not.toBe("them")
    }
  })
})

describe("the two claims that outrank an absent verdict", () => {
  it("keeps a pinned row yours whatever the fetch paid for", () => {
    // A pin is the viewer having said so outright. It reads a reaction on the
    // row itself, which no fetch depth can take away, so declining here would
    // throw away a fact we hold to report one we do not.
    expect(whoseMove(undefined, "review", undefined, undefined, true)).toBe(
      "you",
    )
    expect(whoseMove("none", "assigned", undefined, undefined, true)).toBe(
      "you",
    )
  })

  it("keeps your own row yours when somebody else spoke last", () => {
    expect(whoseMove(undefined, "mine", undefined, true)).toBe("you")
    expect(whoseMove("none", "mine", undefined, true)).toBe("you")
  })
})

describe("every other verdict is exactly what it was", () => {
  it("answers you or them for every real health token", () => {
    // The third state is additive. A row that could always answer must go on
    // answering the same way, or this stopped being a fix and became a rewrite.
    for (const health of HEALTHS.filter((h) => h !== "none"))
      for (const sectionId of SECTION_IDS)
        expect(["you", "them"]).toContain(whoseMove(health, sectionId))
  })

  it("keeps the readings the bands were built on", () => {
    expect(whoseMove("ci-fail", "open")).toBe("you")
    expect(whoseMove("ci-fail", "review")).toBe("them")
    expect(whoseMove("waiting", "review")).toBe("you")
    expect(whoseMove("waiting", "open")).toBe("them")
    expect(whoseMove("threads", "reviewed")).toBe("you")
    expect(whoseMove("draft", "mine")).toBe("you")
    expect(whoseMove("draft", "review")).toBe("them")
  })
})

describe("layoutGHItems", () => {
  it("puts the unclassified band between the two, never after them", () => {
    // Sorting it last would leave these rows precisely where
    // `includes(undefined)` already had them: at the bottom, under Their move.
    const rows = layoutGHItems(
      [
        row({ health: "waiting" }),
        row({ health: undefined }),
        row({ health: "ci-fail" }),
      ],
      "review",
    )
    expect(headers(rows)).toEqual([
      "Your move (1)",
      "Unclassified (1)",
      "Their move (1)",
    ])
  })

  it("omits a band with nothing in it", () => {
    const rows = layoutGHItems([row({ health: undefined })], "review")
    expect(headers(rows)).toEqual(["Unclassified (1)"])
  })

  it("files a whole overflow tier as unclassified, not as theirs", () => {
    // The shape the two-tier fetch actually produces: the full fragment for the
    // rows the cap allows, the minimal one for the rest.
    const classified = Array.from({ length: 20 }, () =>
      row({ health: "waiting" }),
    )
    const overflow = Array.from({ length: 79 }, () =>
      row({ health: undefined }),
    )

    const rows = layoutGHItems([...classified, ...overflow], "review")
    expect(headers(rows)).toEqual(["Your move (20)", "Unclassified (79)"])
    expect(bandOf(rows, "Their move")).toHaveLength(0)
    expect(bandOf(rows, "Unclassified")).toHaveLength(79)
  })

  it("sorts inside the unclassified band exactly as it sorts elsewhere", () => {
    // The band says what is known about a row. How rows rank among themselves
    // is a separate claim, and re-ranking here would smuggle it in.
    const older = row({ health: undefined, ts: 1 })
    const newer = row({ health: undefined, ts: 2 })
    const band = bandOf(layoutGHItems([older, newer], "review"), "Unclassified")
    expect(band.map((r) => r.ts)).toEqual([2, 1])
  })

  it("leaves the Done tab's flat list alone", () => {
    const rows = layoutGHItems([row({ health: undefined })], "done")
    expect(headers(rows)).toEqual([])
  })
})

describe("the filters re-lay the third band with everything else", () => {
  const sections = (): Section[] => [
    {
      id: "review",
      label: "Review requested",
      items: [
        row({ health: "waiting", title: "classified", repo: "kud/one" }),
        row({ health: undefined, title: "overflow", repo: "kud/two" }),
      ],
    },
  ]

  it("keeps an unclassified row unclassified through a search", () => {
    const out = filterBySearch(sections(), "overflow")
    expect(headers(out[0]!.items)).toEqual(["Unclassified (1)"])
  })

  it("keeps it through a repo filter", () => {
    const out = filterByRepos(sections(), new Set(["kud/two"]))
    expect(headers(out[0]!.items)).toEqual(["Unclassified (1)"])
  })

  it("keeps it through an origin split", () => {
    const out = filterByOrigin(sections(), "matched", (r) => r === "kud/two")
    expect(headers(out[0]!.items)).toEqual(["Unclassified (1)"])
  })
})

describe("Move", () => {
  it("is the three answers and no more", () => {
    // A compile-time assertion with a runtime body, so the union cannot grow a
    // fourth member without a deliberate edit here.
    const every: Record<Move, true> = { you: true, them: true, unknown: true }
    expect(Object.keys(every).sort()).toEqual(["them", "unknown", "you"])
  })
})
