import { describe, expect, it } from "vitest"
import { commentLines } from "./comments-panel.js"

const plain = (l: { text: string; spans?: { text: string }[] }) =>
  l.spans ? l.spans.map((s) => s.text).join("") : l.text

describe("a comment's author rule", () => {
  // A body that opens with a heading or a bold line sat flush against the
  // rule and read as part of it.
  it("has a blank line between it and the body", () => {
    const lines = commentLines(
      { author: "alice", body: "**What**\n\nA change." },
      80,
      () => "",
    ).map(plain)
    expect(lines[0]).toMatch(/^── alice ─+$/)
    expect(lines[1]).toBe("")
    expect(lines[2]).toContain("What")
    // And the blank after the body that separates it from the next comment.
    expect(lines.at(-1)).toBe("")
  })

  it("indents the blank with the rest of a thread reply", () => {
    const lines = commentLines(
      { author: "bob", body: "Fixed." },
      80,
      () => "",
      2,
    ).map(plain)
    expect(lines[0]).toMatch(/^  ── bob ─+$/)
    expect(lines[1]).toBe("")
    expect(lines[2]).toBe("  Fixed.")
  })
})
