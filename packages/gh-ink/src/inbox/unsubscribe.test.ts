import { describe, expect, it } from "vitest"
import { buildActions } from "./inbox.js"
import type { GHItem, TaskRow } from "./inbox.js"

// Unsubscribing is per-ITEM, so it belongs to a PR and an issue and to nothing
// else — a Jira task has no GitHub subscription to drop, and pressing `u` on one
// must not reach for a node id that cannot exist.

const gh = (kind: "pr" | "issue"): GHItem => ({
  kind,
  number: 42,
  title: "a row",
  repo: "kud/gh",
  url: "https://github.com/kud/gh/pull/42",
  health: "none",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const task: TaskRow = {
  kind: "task",
  key: "ACC-1",
  summary: "a ticket",
  url: "https://example.invalid/ACC-1",
  status: "In Development",
  age: "2d",
  indent: false,
}

const actionsFor = (item: GHItem | TaskRow) =>
  buildActions(item, "kud", () => {})

const labels = (item: GHItem | TaskRow) => actionsFor(item).map((a) => a.label)

describe("the unsubscribe action", () => {
  it("is offered on a PR and on an issue", () => {
    expect(labels(gh("pr"))).toContain("Unsubscribe")
    expect(labels(gh("issue"))).toContain("Unsubscribe")
  })

  it("is not offered on a Jira task, which has no GitHub subscription", () => {
    expect(labels(task)).not.toContain("Unsubscribe")
  })

  // Guard the guard: every assertion above passes just as quietly if buildActions
  // returns an empty list for these fixtures, which is exactly what a renamed
  // field or a tightened kind check would produce.
  it("builds a real menu for each fixture, so the checks above are not vacuous", () => {
    expect(labels(gh("pr")).length).toBeGreaterThan(3)
    expect(labels(gh("issue")).length).toBeGreaterThan(3)
    expect(labels(task).length).toBeGreaterThan(0)
  })

  // The hint is not dispatched by the menu — it advertises a row-level key
  // handled in the inbox's own keymap. Two actions claiming one letter would
  // render as two working shortcuts where only the keymap decides, so the
  // collision is invisible until someone presses it.
  it("claims a key no other action in the same menu claims", () => {
    for (const item of [gh("pr"), gh("issue")]) {
      const hints = actionsFor(item)
        .map((a) => a.hint)
        .filter(Boolean)
      expect(new Set(hints).size).toBe(hints.length)
      expect(hints).toContain("u")
    }
  })
})
