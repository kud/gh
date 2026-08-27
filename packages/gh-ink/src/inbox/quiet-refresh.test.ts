import { describe, expect, it } from "vitest"
import { layoutGHItems, signatureOf, type GHItem, type Section } from "./inbox.js"

// A cockpit left open kept lighting up "● new · r apply" over an inbox nobody
// had touched: `activityAge` is a string rendered from a timestamp, so a row
// that said "5m" said "6m" a minute later and the signature changed on the
// clock alone. What is pinned here is that only things a reader can act on move
// the signature.

const item = (over: Partial<GHItem> = {}): GHItem => ({
  kind: "pr",
  number: 1,
  title: "a row",
  repo: "acme/api",
  url: "https://github.com/acme/api/pull/1",
  health: "none",
  age: "2d",
  activityAge: "5m",
  ts: 1000,
  unresolved: 0,
  conversation: 0,
  indent: false,
  ...over,
})

const sections = (over: Partial<GHItem> = {}): Section[] => [
  { id: "mine", label: "Mine", items: layoutGHItems([item(over)], "mine") },
]

describe("signatureOf", () => {
  it("ignores the clock ticking on age", () => {
    expect(signatureOf(sections({ age: "3d" }))).toBe(
      signatureOf(sections({ age: "2d" })),
    )
  })

  it("ignores the clock ticking on activityAge", () => {
    expect(signatureOf(sections({ activityAge: "6m" }))).toBe(
      signatureOf(sections({ activityAge: "5m" })),
    )
  })

  // `ts` is the underlying timestamp rather than a rendering of it, so when it
  // moves something really did happen and the reader should be told.
  it("still notices a real change behind the relative time", () => {
    expect(signatureOf(sections({ ts: 2000 }))).not.toBe(
      signatureOf(sections({ ts: 1000 })),
    )
  })

  it("still notices health, title and count changes", () => {
    for (const over of [
      { health: "ci-fail" as const },
      { title: "renamed" },
      { unresolved: 2 },
    ])
      expect(signatureOf(sections(over))).not.toBe(signatureOf(sections()))
  })

  // Guard the guard: identical input must produce identical output, or every
  // "ignores" case above passes for the wrong reason.
  it("is stable for identical input", () => {
    expect(signatureOf(sections())).toBe(signatureOf(sections()))
  })
})
