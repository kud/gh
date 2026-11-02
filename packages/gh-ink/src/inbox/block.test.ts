import { describe, it, expect } from "vitest"
import { blockEnd, rootOrphans } from "./block.js"
import { applyOverrides, type Override } from "./overrides.js"
import { diffSections, markKey, summariseDiff } from "./diff.js"
import { countedSections, withoutItem, workCount } from "./inbox.js"
import type { AnyItem, GHItem, Section, TaskRow } from "./inbox.js"

/*
 * A ticket's PRs travel with it. Every path that took a ticket out of a stage
 * tab used to take it out alone, by key, and its PR rows — which carry their own
 * keys — stayed behind at depth 1: tree corners hanging under a band heading,
 * and two of them from different tickets drawn as siblings. These pin the block
 * that moves, and each place that has to cut it.
 */

// Invented keys and repos: this package is public and its fixtures end up in
// screenshots.
const task = (key: string, depth = 0, status = "In Review"): TaskRow => ({
  kind: "task",
  key,
  ticket: key,
  summary: `${key} summary`,
  url: `https://acme.example/browse/${key}`,
  status,
  age: "2d",
  depth,
})

const pr = (number: number, depth = 1): GHItem => ({
  kind: "pr",
  number,
  title: `pull request ${number}`,
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/pull/${number}`,
  health: "waiting",
  age: "1d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  depth,
})

const band = (label: string, depth = 0): AnyItem => ({
  kind: "subgroup-header",
  id: label,
  label,
  age: "",
  depth,
})

const urlOf = (key: string) => `https://acme.example/browse/${key}`

const labelOf = (item: AnyItem): string =>
  item.kind === "task"
    ? `${item.key}@${item.depth ?? 0}`
    : item.kind === "pr"
      ? `#${item.number}@${item.depth ?? 0}`
      : item.kind === "subgroup-header"
        ? `» ${item.label}`
        : item.kind

const rowsIn = (sections: Section[], id: string) =>
  sections.find((s) => s.id === id)?.items.map(labelOf) ?? []

const override = (patch: Override["patch"]): Override => ({
  patch,
  action: "move",
  label: "SHOP-1234",
  since: 0,
  phase: "sent",
})

describe("blockEnd", () => {
  it("takes a ticket's PRs and stops at the next ticket", () => {
    const items = [task("SHOP-1"), pr(1), pr(2), task("SHOP-2"), pr(3)]
    expect(blockEnd(items, 0)).toBe(3)
    expect(blockEnd(items, 3)).toBe(5)
  })

  it("stops at a header, whatever depth the header carries", () => {
    const items = [task("SHOP-1"), pr(1), band("Their move", 1), pr(2)]
    expect(blockEnd(items, 0)).toBe(2)
  })

  // An epic's stories are tickets with their own Jira status: they do not ride
  // along with the epic into a stage they are not in.
  it("gives an epic nothing past the PRs linked to it directly", () => {
    const items = [
      task("SHOP-1"),
      task("SHOP-2", 1),
      pr(1, 2),
      task("SHOP-3", 1),
    ]
    expect(blockEnd(items, 0)).toBe(1)
    const linked = [task("SHOP-1"), pr(9), task("SHOP-2", 1), pr(1, 2)]
    expect(blockEnd(linked, 0)).toBe(2)
  })

  it("gives a story its PRs and their show-more, and stops at its sibling", () => {
    const items: AnyItem[] = [
      task("SHOP-1"),
      task("SHOP-2", 1),
      pr(1, 2),
      { kind: "show-more", hidden: [pr(2, 2)], depth: 2 },
      task("SHOP-3", 1),
    ]
    expect(blockEnd(items, 1)).toBe(4)
  })

  it("keeps a PR, an issue or a show-more a block of one", () => {
    const items: AnyItem[] = [
      pr(1, 0),
      pr(2, 1),
      { kind: "show-more", hidden: [pr(3, 1)], depth: 1 },
    ]
    expect(blockEnd(items, 0)).toBe(1)
    expect(blockEnd(items, 1)).toBe(2)
    expect(blockEnd(items, 2)).toBe(3)
  })

  it("answers the index itself past the end", () => {
    expect(blockEnd([], 0)).toBe(0)
  })
})

describe("applyOverrides, by block", () => {
  // The screenshot: two tickets leave the review band, and the band used to keep
  // their PRs, drawn as two siblings under the heading with nothing above them.
  const review: Section = {
    id: "review",
    label: "Review",
    items: [
      band("Your move"),
      task("SHOP-1"),
      pr(11),
      task("SHOP-2"),
      pr(21),
      task("SHOP-3"),
      pr(31),
    ],
  }
  const qa: Section = { id: "qa", label: "QA", items: [task("SHOP-9"), pr(91)] }

  it("takes a removed ticket's PRs with it", () => {
    const out = applyOverrides(
      [review, qa],
      new Map([
        [urlOf("SHOP-1"), override({ kind: "remove" })],
        [urlOf("SHOP-2"), override({ kind: "remove" })],
      ]),
    )
    expect(rowsIn(out, "review")).toEqual(["» Your move", "SHOP-3@0", "#31@1"])
  })

  it("moves a ticket's PRs with it, still hanging under it", () => {
    const out = applyOverrides(
      [review, qa],
      new Map([
        [urlOf("SHOP-1"), override({ kind: "move", toSection: "qa" })],
        [urlOf("SHOP-2"), override({ kind: "move", toSection: "qa" })],
      ]),
    )
    expect(rowsIn(out, "review")).toEqual(["» Your move", "SHOP-3@0", "#31@1"])
    expect(rowsIn(out, "qa")).toEqual([
      "SHOP-9@0",
      "#91@1",
      "SHOP-1@0",
      "#11@1",
      "SHOP-2@0",
      "#21@1",
    ])
  })

  it("rebases a moved story's PRs to its new depth rather than flattening them", () => {
    const board: Section[] = [
      {
        id: "review",
        label: "Review",
        items: [task("SHOP-1"), task("SHOP-2", 1), pr(1, 2), pr(2, 2)],
      },
      { id: "qa", label: "QA", items: [task("SHOP-9")] },
    ]
    const out = applyOverrides(
      board,
      new Map([[urlOf("SHOP-2"), override({ kind: "move", toSection: "qa" })]]),
    )
    expect(rowsIn(out, "review")).toEqual(["SHOP-1@0"])
    expect(rowsIn(out, "qa")).toEqual(["SHOP-9@0", "SHOP-2@0", "#1@1", "#2@1"])
  })

  it("leaves an epic's stories where they are when the epic moves", () => {
    const board: Section[] = [
      {
        id: "review",
        label: "Review",
        items: [task("SHOP-1"), task("SHOP-2", 1), pr(1, 2), task("SHOP-3", 1)],
      },
      { id: "qa", label: "QA", items: [task("SHOP-9")] },
    ]
    const out = applyOverrides(
      board,
      new Map([[urlOf("SHOP-1"), override({ kind: "move", toSection: "qa" })]]),
    )
    expect(rowsIn(out, "review")).toEqual(["SHOP-2@1", "#1@2", "SHOP-3@1"])
    expect(rowsIn(out, "qa")).toEqual(["SHOP-9@0", "SHOP-1@0"])
  })

  it("removes a leaf PR and nothing else", () => {
    const out = applyOverrides(
      [review],
      new Map([[pr(21).url, override({ kind: "remove" })]]),
    )
    expect(rowsIn(out, "review")).toEqual([
      "» Your move",
      "SHOP-1@0",
      "#11@1",
      "SHOP-2@0",
      "SHOP-3@0",
      "#31@1",
    ])
  })

  it("stays idempotent with a block in flight", () => {
    const overrides = new Map([
      [urlOf("SHOP-1"), override({ kind: "move", toSection: "qa" })],
    ])
    const once = applyOverrides([review, qa], overrides)
    expect(applyOverrides(once, overrides)).toEqual(once)
  })
})

describe("withoutItem, by block", () => {
  it("removes a PR alone and keeps the header that still owns rows", () => {
    const sections: Section[] = [
      {
        id: "review",
        label: "Review",
        items: [band("Your move"), task("SHOP-1"), pr(11), pr(12)],
      },
    ]
    expect(rowsIn(withoutItem(sections, pr(11)), "review")).toEqual([
      "» Your move",
      "SHOP-1@0",
      "#12@1",
    ])
  })
})

describe("countedSections, by block", () => {
  // Counted by leaves, so a ticket's PRs are what the pill counts. Dropping the
  // ticket alone made its PRs count on in a tab they had already left.
  it("stops counting a departing ticket's PRs in the tab it left", () => {
    const sections: Section[] = [
      {
        id: "review",
        label: "Review",
        items: [task("SHOP-1"), pr(11), pr(12), task("SHOP-2"), pr(21)],
      },
      // Sent, or the move would leave the block where it stands — see
      // `applyOverrides` — and it would rightly go on counting there.
      { id: "qa", label: "QA", items: [task("SHOP-9")] },
    ]
    expect(workCount(sections[0]!)).toBe(3)
    const counted = countedSections(
      sections,
      new Map([[urlOf("SHOP-1"), "qa"]]),
    )
    expect(workCount(counted[0]!)).toBe(1)
  })
})

describe("diffSections, by block", () => {
  const before: Section[] = [
    { id: "review", label: "Review", items: [task("SHOP-1"), pr(11), pr(12)] },
    { id: "qa", label: "QA", items: [task("SHOP-9")] },
  ]
  // #12 merged on the way: on its own key it has left the board.
  const after: Section[] = [
    { id: "review", label: "Review", items: [] },
    { id: "qa", label: "QA", items: [task("SHOP-9"), task("SHOP-1"), pr(11)] },
  ]

  it("marks a moved ticket's PRs with the ticket's own mark", () => {
    const { transients } = diffSections(before, after)
    expect(transients.get(markKey("review", urlOf("SHOP-1")))).toBe("moved-out")
    expect(transients.get(markKey("review", pr(11).url))).toBe("moved-out")
    expect(transients.get(markKey("review", pr(12).url))).toBe("moved-out")
    expect(transients.get(markKey("qa", pr(11).url))).toBe("moved-in")
  })

  it("reports the block once, through its ticket", () => {
    expect(summariseDiff(diffSections(before, after).counts)).toBe("1 moved")
  })

  it("leaves a PR that stayed under another ticket unmarked", () => {
    const stays: Section[] = [
      { id: "review", label: "Review", items: [task("SHOP-2"), pr(11)] },
      {
        id: "qa",
        label: "QA",
        items: [task("SHOP-9"), task("SHOP-1"), pr(11)],
      },
    ]
    const was: Section[] = [
      {
        id: "review",
        label: "Review",
        items: [task("SHOP-1"), pr(11), task("SHOP-2"), pr(11)],
      },
      { id: "qa", label: "QA", items: [task("SHOP-9")] },
    ]
    const { transients } = diffSections(was, stays)
    expect(transients.get(markKey("review", pr(11).url))).toBeUndefined()
  })
})

describe("rootOrphans", () => {
  it("answers the same list when every nested row hangs from something", () => {
    const items = [task("SHOP-1"), pr(1), pr(2)]
    expect(rootOrphans(items).items).toBe(items)
    expect(rootOrphans(items).orphans).toEqual([])
  })

  // Measured against the original depths, so the second orphan does not hang
  // under the first one once that has been flattened.
  it("draws two orphans under a heading flat, not as siblings", () => {
    const { items, orphans } = rootOrphans([band("Your move"), pr(1), pr(2)])
    expect(items.map(labelOf)).toEqual(["» Your move", "#1@0", "#2@0"])
    expect(orphans).toHaveLength(2)
  })

  it("roots a nested first row", () => {
    expect(rootOrphans([pr(1)]).items.map(labelOf)).toEqual(["#1@0"])
  })
})
