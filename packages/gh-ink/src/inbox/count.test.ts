import { describe, expect, it } from "vitest"
import { topLevelCount, type AnyItem, type Section } from "./inbox.js"

// What the tab badge says. The number is the whole point of this file: it is
// read at a glance and acted on, so a row counted wrongly is a lie nobody
// checks.
//
// Keys are invented, per the standard mock.ts sets: nothing here belongs to a
// real instance. This package is public and its fixtures end up in screenshots
// and READMEs, so a key that merely resembles a real one is already wrong.

const task = (key: string, depth: number, role?: "container"): AnyItem => ({
  kind: "task",
  key,
  summary: `${key} summary`,
  url: `https://jira/${key}`,
  status: "In Development",
  age: "",
  depth,
  ...(role ? { role } : {}),
})

const pr = (n: number, depth: number): AnyItem => ({
  kind: "pr",
  number: n,
  title: `#${n}`,
  repo: "acme/api",
  url: `https://github.com/acme/api/pull/${n}`,
  health: "none",
  age: "1d",
  ts: n,
  unresolved: 0,
  conversation: 0,
  depth,
})

const section = (items: AnyItem[]): Section => ({
  id: "open",
  label: "Open",
  items,
})

describe("topLevelCount", () => {
  it("counts top-level rows and not their children", () => {
    expect(
      topLevelCount(section([task("SHOP-100", 0), pr(1, 1), pr(2, 1)])),
    ).toBe(1)
  })

  it("does not count headers, which are furniture rather than entities", () => {
    const header = { kind: "subgroup-header", label: "Needs you", age: "" }
    expect(
      topLevelCount(section([header as AnyItem, task("SHOP-100", 0)])),
    ).toBe(1)
  })

  // An epic is real, owned, and openable — but the work is the stories under
  // it. Counting the container as well reported five things to do where there
  // were four.
  it("does not count a container, which is context rather than work", () => {
    const items = [
      task("SHOP-300", 0, "container"),
      task("SHOP-412", 1),
      pr(1, 2),
      task("SHOP-500", 0),
    ]
    expect(topLevelCount(section(items))).toBe(1)
  })

  it("counts a container's own top-level siblings normally", () => {
    const items = [
      task("SHOP-300", 0, "container"),
      task("SHOP-301", 0, "container"),
      task("SHOP-500", 0),
      task("SHOP-501", 0),
    ]
    expect(topLevelCount(section(items))).toBe(2)
  })

  // Guard against the fix being spelled as a depth. A container is a genuine
  // top-level row; if it were pushed to depth 1 to drop it from the count,
  // every site that draws indentation would read that as truth.
  it("still counts a top-level row that is not marked a container", () => {
    expect(topLevelCount(section([task("SHOP-100", 0)]))).toBe(1)
  })
})
