import { describe, expect, it } from "vitest"
import { formatRef, parseRef } from "./ref.js"

describe("parseRef", () => {
  it("reads a PR URL", () => {
    expect(parseRef("https://github.com/acme/api-gateway/pull/2926")).toEqual({
      repo: "acme/api-gateway",
      number: 2926,
    })
  })

  it("reads an issue URL", () => {
    expect(parseRef("https://github.com/acme/api-gateway/issues/41")).toEqual({
      repo: "acme/api-gateway",
      number: 41,
    })
  })

  it("reads a URL copied from any tab of the item", () => {
    for (const url of [
      "https://github.com/acme/api-gateway/pull/2926/files",
      "https://github.com/acme/api-gateway/pull/2926#issuecomment-1",
      "https://github.com/acme/api-gateway/pull/2926?w=1",
      "http://www.github.com/acme/api-gateway/pull/2926",
    ])
      expect(parseRef(url)).toEqual({ repo: "acme/api-gateway", number: 2926 })
  })

  it("reads owner/repo#N, keeping the case it was typed in", () => {
    expect(parseRef("Acme/API-Gateway#7")).toEqual({
      repo: "Acme/API-Gateway",
      number: 7,
    })
  })

  it("reads a bare #N with no repo, for the caller to expand", () => {
    expect(parseRef("#99")).toEqual({ number: 99 })
  })

  it("ignores the whitespace a paste carries", () => {
    expect(parseRef("  acme/api-gateway#7\n")).toEqual({
      repo: "acme/api-gateway",
      number: 7,
    })
  })

  // The launcher calls this on every keystroke, so the misses matter as much
  // as the hits: anything returned here is a row claiming the input for GitHub.
  it("claims nothing that is not a reference", () => {
    for (const input of [
      "",
      "   ",
      "SHOP-1234",
      "acme/api-gateway",
      "acme/api-gateway#",
      "#",
      "#12a",
      "42",
      "github.com/acme/api-gateway/pull/1",
      "https://github.com/acme/api-gateway/commit/abc123",
      "https://example.com/acme/api-gateway/pull/1",
      "a/b/c#1",
    ])
      expect(parseRef(input), input).toBeNull()
  })
})

describe("formatRef", () => {
  it("draws the full ref, or the bare number until the repo is known", () => {
    expect(formatRef({ repo: "acme/api-gateway", number: 2926 })).toBe(
      "acme/api-gateway#2926",
    )
    expect(formatRef({ number: 2926 })).toBe("#2926")
  })
})
