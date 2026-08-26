import { describe, expect, it } from "vitest"

import { hasPatterns, parseArgs } from "./args.js"

/*
 * The flags replace a built-in two-way repo split that could only ever express
 * two slices and hid which one was active behind a keypress. What is pinned here
 * is that a filter is always legible from the command line alone — which means
 * flags beat a named filter outright rather than merging with it, since a merge
 * of two complete answers is a third the reader never wrote.
 */

describe("parseArgs", () => {
  it("finds nothing in an empty argv", () => {
    const a = parseArgs([])
    expect(a.here).toBe(false)
    expect(a.named).toBeUndefined()
    expect(hasPatterns(a.filter)).toBe(false)
  })

  it("reads --here", () => {
    expect(parseArgs(["--here"]).here).toBe(true)
  })

  it("takes a named filter positionally", () => {
    // `gh-cockpit work` reads the way the reader thinks; the flags are for the
    // ad-hoc case and the name for the one used daily.
    expect(parseArgs(["work"]).named).toBe("work")
  })

  it("accepts both flag spellings", () => {
    expect(parseArgs(["--include", "acme/*"]).filter.include).toEqual([
      "acme/*",
    ])
    expect(parseArgs(["--include=acme/*"]).filter.include).toEqual(["acme/*"])
  })

  it("splits comma-separated patterns", () => {
    expect(parseArgs(["--include", "acme/*,me/acme-*"]).filter.include).toEqual(
      ["acme/*", "me/acme-*"],
    )
  })

  it("collects include and exclude independently", () => {
    const { filter } = parseArgs([
      "--include",
      "acme/*",
      "--exclude",
      "acme/legacy",
    ])
    expect(filter.include).toEqual(["acme/*"])
    expect(filter.exclude).toEqual(["acme/legacy"])
  })

  it("accumulates a repeated flag rather than replacing it", () => {
    const { filter } = parseArgs([
      "--include",
      "acme/*",
      "--include",
      "me/acme-*",
    ])
    expect(filter.include).toEqual(["acme/*", "me/acme-*"])
  })

  it("takes a name and flags together, and reports both", () => {
    // The host decides that flags override; the parser's job is only to make
    // both visible so it CAN decide, rather than silently dropping one.
    const a = parseArgs(["work", "--exclude", "acme/legacy"])
    expect(a.named).toBe("work")
    expect(a.filter.exclude).toEqual(["acme/legacy"])
  })

  it("never mistakes a flag for the positional name", () => {
    expect(parseArgs(["--here", "--include", "acme/*"]).named).toBeUndefined()
  })

  it("does not swallow the next flag as a missing value", () => {
    // `--include --here` is a typo, not a pattern called "--here". It must not
    // silently produce a filter that matches nothing and hides every row.
    const a = parseArgs(["--include", "--here"])
    expect(a.here).toBe(true)
    expect(hasPatterns(a.filter)).toBe(false)
  })

  it("survives a trailing flag with no value at all", () => {
    expect(hasPatterns(parseArgs(["--include"]).filter)).toBe(false)
  })

  it("keeps only the first positional", () => {
    expect(parseArgs(["work", "home"]).named).toBe("work")
  })
})

describe("hasPatterns", () => {
  it("is false for empty or absent lists", () => {
    expect(hasPatterns({})).toBe(false)
    expect(hasPatterns({ include: [], exclude: [] })).toBe(false)
  })

  it("is true when either side has something", () => {
    expect(hasPatterns({ include: ["a/*"] })).toBe(true)
    expect(hasPatterns({ exclude: ["a/*"] })).toBe(true)
  })
})
