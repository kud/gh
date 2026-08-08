import { describe, expect, it } from "vitest"
import {
  extensionFor,
  extensionHints,
  extensionLegend,
  itemExtensions,
} from "./inbox.js"
import type { InboxExtension } from "./extension.js"

// `body` is irrelevant to every helper here, so a stub keeps the fixtures readable.
const ext = (
  id: string,
  key: string,
  extra: Partial<InboxExtension> = {},
): InboxExtension => ({
  id,
  title: id,
  key,
  body: () => null,
  ...extra,
})

const JENKINS = ext("jenkins", "J")
const DELEGATE = ext("delegate", "a")

describe("extensionFor", () => {
  it("matches an extension by its declared key", () => {
    expect(extensionFor("J", [JENKINS, DELEGATE])).toBe(JENKINS)
    expect(extensionFor("a", [JENKINS, DELEGATE])).toBe(DELEGATE)
  })

  it("dispatches on more than one extension — the point of the mechanism", () => {
    // The hardcoded predecessor could only ever open Jenkins, so a second
    // extension declaring a key was silently inert.
    const ids = ["J", "a"].map((k) => extensionFor(k, [JENKINS, DELEGATE])?.id)
    expect(ids).toEqual(["jenkins", "delegate"])
  })

  it("is case sensitive, so J and a are distinct bindings", () => {
    expect(extensionFor("j", [JENKINS])).toBeUndefined()
    expect(extensionFor("A", [DELEGATE])).toBeUndefined()
  })

  it("ignores an unbound key", () => {
    expect(extensionFor("z", [JENKINS, DELEGATE])).toBeUndefined()
  })

  it("never matches on empty input, even for an extension keyed ''", () => {
    // Ink reports arrow keys, Tab and Escape with input === "". Without the
    // guard, an extension declaring an empty key would open on every cursor
    // move — and `find` would return it, because "" === "".
    expect(extensionFor("", [ext("broken", "")])).toBeUndefined()
    expect(extensionFor("", [JENKINS])).toBeUndefined()
  })

  it("tolerates a host that passes no extensions", () => {
    expect(extensionFor("J")).toBeUndefined()
    expect(extensionFor("J", [])).toBeUndefined()
  })
})

// The regression these guard: the dispatch honoured `key` while the footer, the
// legend and the action menu still named Jenkins by hand — so a second extension
// worked and was invisible everywhere a user might look for it.
describe("extension discoverability", () => {
  const SPELLED = ext("jenkins", "J", {
    title: "Jenkins explorer",
    hint: "jenkins",
  })

  it("gives the footer the short hint and the legend the full title", () => {
    expect(extensionHints([SPELLED])).toEqual([["J", "jenkins"]])
    expect(extensionLegend([SPELLED])).toEqual([["J", "Jenkins explorer"]])
  })

  it("falls back to a lowercased title when no hint is given", () => {
    expect(extensionHints([ext("delegate", "a", { title: "AI" })])).toEqual([
      ["a", "ai"],
    ])
  })

  it("advertises every extension, not just the first", () => {
    expect(extensionHints([JENKINS, DELEGATE]).map(([k]) => k)).toEqual([
      "J",
      "a",
    ])
    expect(extensionLegend([JENKINS, DELEGATE]).map(([k]) => k)).toEqual([
      "J",
      "a",
    ])
  })

  it("lists only item-scoped extensions against a row", () => {
    const items = itemExtensions([
      ext("jenkins", "J", { scope: "global" }),
      ext("delegate", "a", { scope: "item" }),
    ])
    expect(items.map((e) => e.id)).toEqual(["delegate"])
  })

  it("treats an unscoped extension as global, so listing is opt-in", () => {
    // A host that has not thought about scope must not get Jenkins offered as
    // something to do TO a pull request.
    expect(itemExtensions([JENKINS, DELEGATE])).toEqual([])
  })

  it("tolerates no extensions on every derivation", () => {
    expect(extensionHints()).toEqual([])
    expect(extensionLegend()).toEqual([])
    expect(itemExtensions()).toEqual([])
  })
})
