import { describe, expect, it } from "vitest"
import React from "react"
import { Box } from "ink"
import { render } from "ink-testing-library"
import type { PrComments, ReviewThread } from "@kud/gh"
import { CommentsPanel, commentLines } from "./comments-panel.js"

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

describe("a comment's author", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

  it("carries an age from createdAt", () => {
    const [rule] = commentLines(
      { author: "alice", body: "Hi.", createdAt: ago(3 * 86_400_000 + 60_000) },
      80,
      () => "",
    )
    expect(plain(rule)).toMatch(/^── alice 3d ─+$/)
    // Exactly as wide as a rule without an age: the fill pays for it.
    expect(plain(rule)).toHaveLength(80)
  })

  it("draws no age when there is no timestamp", () => {
    const [rule] = commentLines({ author: "alice", body: "Hi." }, 80, () => "")
    expect(plain(rule)).toMatch(/^── alice ─+$/)
  })

  // The accent belongs to the cursor; a dozen orange names competed with it.
  it("is bold and never in the accent", () => {
    const [rule] = commentLines({ author: "alice", body: "Hi." }, 80, () => "")
    const name = rule.spans!.find((s) => s.text === "alice")!
    expect(name.bold).toBe(true)
    expect(name.color).toBeUndefined()
  })
})

describe("settled threads", () => {
  const thread = (over: Partial<ReviewThread>): ReviewThread => ({
    id: "T",
    path: "src/a.ts",
    line: 3,
    originalLine: 3,
    isResolved: false,
    isOutdated: false,
    comments: [
      { author: "alice", body: "First remark." },
      { author: "bob", body: "Second remark." },
    ],
    ...over,
  })
  const data: PrComments = {
    headRef: "main",
    conversation: [],
    threads: [
      thread({ id: "open", path: "src/open.ts" }),
      thread({ id: "done", path: "src/done.ts", isResolved: true }),
      thread({ id: "old", path: "src/old.ts", line: null, isOutdated: true }),
    ],
  }
  const tick = () => new Promise((r) => setTimeout(r, 30))
  // A sized parent, as both hosts give it: the ScrollView measures a flexGrow
  // box, which in a parent of no fixed height grows into one row.
  const mount = () =>
    render(
      <Box flexDirection="column" height={40}>
        <CommentsPanel
          repo="kud/gh"
          number={1}
          data={data}
          error={null}
          reload={() => {}}
        />
      </Box>,
    )

  it("fold to one line each, and R unfolds them", async () => {
    const app = mount()
    await tick()
    let frame = app.lastFrame() ?? ""
    expect(frame).toContain("src/done.ts:3 · resolved · 2 comments")
    expect(frame).toContain("src/old.ts · outdated · 2 comments")
    // The open thread is drawn in full; the folded ones are not.
    expect(frame.match(/First remark\./g)).toHaveLength(1)
    expect(frame).toContain("2 resolved/outdated folded — R to unfold")

    app.stdin.write("R")
    await tick()
    frame = app.lastFrame() ?? ""
    expect(frame.match(/First remark\./g)).toHaveLength(3)
    expect(frame).not.toContain("folded")
    app.unmount()
  })

  it("heads the list with its count, unbracketed", async () => {
    const app = mount()
    await tick()
    expect(app.lastFrame()).toMatch(/^Review threads 3$/m)
    app.unmount()
  })
})
