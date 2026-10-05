import { describe, it, expect } from "vitest"
import {
  agrees,
  applyOverrides,
  failedOverrides,
  failureNotice,
  OVERRIDE_HOLD_MS,
  pruneOverrides,
  type Override,
} from "./overrides.js"
import type { Section, TaskRow } from "./inbox.js"

// Invented keys, per mock.ts: this package is public and its fixtures end up
// in screenshots.
const task = (key: string, status: string, depth = 0): TaskRow => ({
  kind: "task",
  key,
  ticket: key,
  summary: `${key} summary`,
  url: `https://acme.example/browse/${key}`,
  status,
  age: "2d",
  depth,
})

const board = (todo: TaskRow[], review: TaskRow[]): Section[] => [
  { id: "todo", label: "To do", items: todo },
  { id: "review", label: "Review", items: review },
]

const urlOf = (key: string) => `https://acme.example/browse/${key}`

const move = (
  toSection: string,
  status: string,
  phase: Override["phase"] = "sent",
  since = 0,
): Override => ({
  patch: { kind: "move", toSection, fields: { status } },
  action: "move",
  label: "SHOP-1234",
  since,
  phase,
})

const keysIn = (sections: Section[], id: string) =>
  sections.find((s) => s.id === id)?.items.map((i) => (i as TaskRow).key) ?? []

describe("applyOverrides", () => {
  const truth = board(
    [task("SHOP-1234", "To Do"), task("SHOP-1235", "To Do")],
    [task("SHOP-1236", "In Review")],
  )
  const overrides = new Map([[urlOf("SHOP-1234"), move("review", "In Review")]])

  it("moves the row to its new tab, wearing its new fields", () => {
    const out = applyOverrides(truth, overrides)
    expect(keysIn(out, "todo")).toEqual(["SHOP-1235"])
    expect(keysIn(out, "review")).toEqual(["SHOP-1236", "SHOP-1234"])
    const moved = out[1]!.items[1] as TaskRow
    expect(moved.status).toBe("In Review")
  })

  // The property the whole layer stands on: laid over the fetch every time, and
  // over what is already on screen when a patch is new, so applying twice must
  // be applying once.
  it("is idempotent", () => {
    const once = applyOverrides(truth, overrides)
    expect(applyOverrides(once, overrides)).toEqual(once)
  })

  it("lifts a nested row to the top level of its new tab", () => {
    const nested = board(
      [task("SHOP-1", "To Do"), task("SHOP-1234", "To Do", 1)],
      [task("SHOP-1236", "In Review")],
    )
    const moved = applyOverrides(nested, overrides)[1]!.items[1] as TaskRow
    expect(moved.depth).toBe(0)
  })

  it("never invents a row the fetch no longer carries", () => {
    const gone = board([task("SHOP-1235", "To Do")], [])
    expect(applyOverrides(gone, overrides)).toEqual(gone)
  })

  it("patches in place when the target tab was not sent", () => {
    const noReview: Section[] = [truth[0]!]
    const out = applyOverrides(noReview, overrides)
    expect(keysIn(out, "todo")).toEqual(["SHOP-1234", "SHOP-1235"])
    expect((out[0]!.items[0] as TaskRow).status).toBe("In Review")
  })

  it("removes and mutates", () => {
    const out = applyOverrides(
      truth,
      new Map<string, Override>([
        [urlOf("SHOP-1235"), { ...move("x", "x"), patch: { kind: "remove" } }],
        [
          urlOf("SHOP-1236"),
          {
            ...move("x", "x"),
            patch: { kind: "mutate", fields: { summary: "renamed" } },
          },
        ],
      ]),
    )
    expect(keysIn(out, "todo")).toEqual(["SHOP-1234"])
    expect((out[1]!.items[0] as TaskRow).summary).toBe("renamed")
  })
})

describe("pruneOverrides", () => {
  const stale = board([task("SHOP-1234", "To Do")], [])
  const agreeing = board([], [task("SHOP-1234", "In Review")])
  const key = urlOf("SHOP-1234")

  it("keeps a patch the fetch disagrees with, inside the hold", () => {
    const kept = pruneOverrides(
      new Map([[key, move("review", "In Review")]]),
      stale,
      1000,
    )
    expect(kept.has(key)).toBe(true)
  })

  it("drops a patch the fetch agrees with, whatever the clock says", () => {
    expect(agrees(agreeing, key, move("review", "In Review").patch)).toBe(true)
    const kept = pruneOverrides(
      new Map([[key, move("review", "In Review")]]),
      agreeing,
      1,
    )
    expect(kept.size).toBe(0)
  })

  it("believes the fetch once the hold has run out", () => {
    const kept = pruneOverrides(
      new Map([[key, move("review", "In Review")]]),
      stale,
      OVERRIDE_HOLD_MS + 1,
    )
    expect(kept.size).toBe(0)
  })

  it("never drops an in-flight or failed patch", () => {
    const late = OVERRIDE_HOLD_MS * 10
    for (const phase of ["inflight", "failed"] as const) {
      const kept = pruneOverrides(
        new Map([[key, move("review", "In Review", phase)]]),
        agreeing,
        late,
      )
      expect(kept.has(key)).toBe(true)
    }
  })
})

describe("failureNotice", () => {
  const failed = (label: string, at: number): Override => ({
    ...move("review", "In Review", "failed"),
    label,
    failure: { reason: "not permitted", seq: at },
  })

  it("names the action, the row and the reason, and the way back", () => {
    const one = failedOverrides(new Map([["a", failed("SHOP-1234", 1)]]))
    expect(failureNotice(one)).toBe(
      "✗ Couldn't move SHOP-1234: not permitted  w restore",
    )
  })

  it("keeps several failures to one line, newest first", () => {
    const many = failedOverrides(
      new Map([
        ["a", failed("SHOP-1", 1)],
        ["b", failed("SHOP-3", 3)],
        ["c", failed("SHOP-2", 2)],
      ]),
    )
    expect(many.map(([k]) => k)).toEqual(["b", "c", "a"])
    expect(failureNotice(many)).toBe(
      "✗ Couldn't move SHOP-3: not permitted  +2 more  w restore",
    )
  })

  it("says nothing when nothing failed", () => {
    expect(failureNotice([])).toBeNull()
  })
})
