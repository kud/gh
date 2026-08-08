import { describe, expect, it } from "vitest"
import { extensionFor } from "./inbox.js"
import type { InboxExtension } from "./extension.js"

// `body` is irrelevant to key matching, so a stub keeps the fixtures readable.
const ext = (id: string, key: string): InboxExtension => ({
  id,
  title: id,
  key,
  body: () => null,
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
