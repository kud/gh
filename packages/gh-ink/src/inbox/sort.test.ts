import { describe, expect, it } from "vitest"

import { layoutGHItems, sortItems, type GHItem } from "./inbox.js"

/*
 * What is pinned here is the ORDER OF KEYS, not any one arrangement. The two
 * halves pull against each other: repo grouping needs same-repo items adjacent,
 * recency wants the freshest row at the top, and only one of them can be the
 * outer key. Losing the tiebreak is invisible — the list still renders, still
 * groups, and simply shows a stale row first — so it needs a test that fails
 * rather than a comment that explains.
 *
 * The case is the real one from 2026-08-19: two open PRs on gnachman/iTerm2
 * where the OLDER one had just been replied to, and the inbox showed the
 * quiet one first because the sort had no time component at all.
 */

const item = (over: Partial<GHItem> & { repo: string; ts: number }): GHItem => ({
  kind: "pr",
  number: 1,
  title: "",
  url: "",
  health: "waiting",
  age: "",
  unresolved: 0,
  conversation: 0,
  indent: false,
  ...over,
})

describe("sortItems", () => {
  it("puts the most recently active item first within a repo", () => {
    const quiet = item({ repo: "gnachman/iTerm2", number: 733, ts: 2_000 })
    const replied = item({ repo: "gnachman/iTerm2", number: 731, ts: 9_000 })

    expect(sortItems([quiet, replied]).map((i) => i.number)).toEqual([731, 733])
  })

  it("never lets recency reorder repos", () => {
    // kud/* outranks a third-party repo at home, and a fresher third-party item
    // must not overtake it — otherwise the grouping is decided by whoever
    // commented last.
    const mine = item({ repo: "kud/ambre", number: 1, ts: 1 })
    const theirs = item({ repo: "raycast/extensions", number: 2, ts: 9_999 })

    expect(sortItems([theirs, mine]).map((i) => i.number)).toEqual([1, 2])
  })

  it("keeps each repo in one contiguous block", () => {
    const rows = [
      item({ repo: "kud/ambre", number: 1, ts: 1 }),
      item({ repo: "kud/shui", number: 2, ts: 9 }),
      item({ repo: "kud/ambre", number: 3, ts: 5 }),
    ]

    expect(sortItems(rows).map((i) => i.repo)).toEqual([
      "kud/ambre",
      "kud/ambre",
      "kud/shui",
    ])
  })

  it("emits one header per repo once sorted", () => {
    const rows = [
      item({ repo: "kud/ambre", number: 1, ts: 1 }),
      item({ repo: "kud/shui", number: 2, ts: 9 }),
      item({ repo: "kud/ambre", number: 3, ts: 5 }),
    ]

    const headers = layoutGHItems(rows, "open").filter(
      (i) => i.kind === "repo-header",
    )
    expect(headers).toHaveLength(2)
  })
})
