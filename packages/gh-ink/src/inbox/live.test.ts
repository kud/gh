import { describe, it, expect } from "vitest"
import type { GHItem, Section } from "./inbox.js"
import {
  patchInPlace,
  regroupWait,
  samePlacement,
  settlingRows,
} from "./live.js"

const pr = (
  n: number,
  health: GHItem["health"],
  extra: Partial<GHItem> = {},
): GHItem => ({
  kind: "pr",
  number: n,
  title: `pr ${n}`,
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/pull/${n}`,
  health,
  age: "1d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  ...extra,
})

describe("settlingRows", () => {
  it("returns pending PRs once each, across tabs", () => {
    const sections: Section[] = [
      { id: "a", label: "A", items: [pr(1, "pending"), pr(2, "approved")] },
      { id: "b", label: "B", items: [pr(1, "pending"), pr(3, "waiting")] },
    ]
    expect(settlingRows(sections).map((r) => r.number)).toEqual([1])
  })

  it("is empty on a board where nothing runs, so no timer is armed", () => {
    expect(
      settlingRows([{ id: "a", label: "A", items: [pr(2, "approved")] }]),
    ).toEqual([])
  })
})

describe("patchInPlace", () => {
  it("takes the fresh row's content without its place", () => {
    const shown: Section[] = [
      {
        id: "theirs",
        label: "Their move",
        items: [pr(1, "pending", { indent: true }), pr(2, "waiting")],
      },
      { id: "yours", label: "Your move", items: [] },
    ]
    const fresh: Section[] = [
      { id: "theirs", label: "Their move", items: [pr(2, "waiting")] },
      { id: "yours", label: "Your move", items: [pr(1, "approved")] },
    ]
    const patched = patchInPlace(shown, fresh)
    expect(patched[0]!.items.map((i) => (i as GHItem).number)).toEqual([1, 2])
    expect((patched[0]!.items[0] as GHItem).health).toBe("approved")
    expect((patched[0]!.items[0] as GHItem).indent).toBe(true)
    expect(patched[1]!.items).toEqual([])
  })
})

describe("samePlacement", () => {
  it("ignores what rows say and watches where they stand", () => {
    const a: Section[] = [
      { id: "s", label: "S", items: [pr(1, "pending"), pr(2, "waiting")] },
    ]
    const ticked: Section[] = [
      { id: "s", label: "S", items: [pr(1, "approved"), pr(2, "waiting")] },
    ]
    const swapped: Section[] = [
      { id: "s", label: "S", items: [pr(2, "waiting"), pr(1, "approved")] },
    ]
    expect(samePlacement(a, ticked)).toBe(true)
    expect(samePlacement(a, swapped)).toBe(false)
  })
})

describe("regroupWait", () => {
  it("waits out the quiet window from the last key", () => {
    expect(regroupWait(1_000, 2_000, 4_000)).toBe(3_000)
    expect(regroupWait(1_000, 9_000, 4_000)).toBe(0)
  })
})
