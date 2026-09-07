import { describe, expect, it } from "vitest"

import { stripAnsi } from "./check-log-view.js"

/*
 * A CI log is written BY programs that colour their own output, so arriving full
 * of escape sequences is the normal case rather than an edge — which is why this
 * broke for almost every failing check rather than occasionally.
 *
 * Two independent reasons they must not reach the frame. `gh` refuses to print
 * them at all without `--allow-escape-sequences` and exits 1: "the response
 * contains terminal escape sequences". And once allowed through, they are
 * someone else's styling arriving inside a view that does its own — a `\x1b[2J`
 * in a build log would clear the frame drawn around it.
 */

const ESC = ""

describe("stripAnsi", () => {
  it("removes the colour a build tool wrote around its own output", () => {
    expect(stripAnsi(`${ESC}[31mFAILED${ESC}[0m tests/test_api.py`)).toBe(
      "FAILED tests/test_api.py",
    )
  })

  it("removes a cursor or screen command that would redraw our frame", () => {
    // The one that does damage rather than merely looking wrong.
    expect(stripAnsi(`before${ESC}[2Jafter`)).toBe("beforeafter")
  })

  it("removes an OSC hyperlink, terminator and all", () => {
    // Modern build tools emit these and they are NOT CSI — a pattern written
    // only for `\x1b[…` leaves the payload and the BEL behind as visible junk.
    expect(
      stripAnsi(`${ESC}]8;;https://example.com${ESC}\\link${ESC}]8;;${ESC}\\`),
    ).toBe("link")
    expect(stripAnsi(`${ESC}]0;window titletext`)).toBe("text")
  })

  it("leaves an ordinary log line exactly as it was", () => {
    const line = "  ✓ 41 passed in 3.20s  [100%]"
    expect(stripAnsi(line)).toBe(line)
  })

  it("keeps the newlines the view splits on", () => {
    // Stripping happens before `.split("\n")`, so eating a newline would merge
    // two log lines into one and silently shorten the log.
    expect(stripAnsi(`${ESC}[32mone${ESC}[0m\ntwo\n`).split("\n")).toEqual([
      "one",
      "two",
      "",
    ])
  })
})
