import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { glyph } from "@kud/glyphs"
import { App, COLS } from "./inbox.js"
import { TYPE_GUTTER_COLS } from "../components/pr-row.js"
import type { TaskRow, Section, GHItem } from "./inbox.js"

/*
 * The type gutter and the stage pill. A task row's type moved out of the tail
 * into a fixed cell ahead of the tree, so the type is read on the cursor's scan
 * and the tree, keys and `#n`s keep one column across task and PR rows; the
 * stage took the tail, beside the note. Pinned through the real App, as
 * tree-alignment does — the geometry is cell counting.
 */

class FakeStdout extends EventEmitter {
  frames: string[] = []
  constructor(
    public columns: number,
    public rows: number,
  ) {
    super()
  }
  write = (frame: string) => {
    this.frames.push(frame)
  }
  lastFrame = () => this.frames.at(-1) ?? ""
}

class FakeStdin extends EventEmitter {
  isTTY = true
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => null
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

const task = (key: string, over: Partial<TaskRow> = {}): TaskRow => ({
  kind: "task",
  key,
  ticket: key,
  summary: `Summary of ${key}`,
  url: `https://example.invalid/${key}`,
  status: "In progress",
  age: "2d",
  marker: "▲",
  ...over,
})

const pr = (number: number): GHItem => ({
  kind: "pr",
  number,
  title: `pull request number ${number}`,
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent: true,
})

const mount = async (items: Array<TaskRow | GHItem>) => {
  const sections: Section[] = [{ id: "today", label: "Today", items }]
  const stdout = new FakeStdout(120, 44)
  const stdin = new FakeStdin()
  const instance = render(
    <App fetcher={async () => ({ sections, login: "kud" })} title="test" />,
    {
      stdout: stdout as never,
      stdin: stdin as never,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  )
  await settle()
  await settle()
  const frame = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return frame
}

const lineOf = (frame: string, text: string): string =>
  frame.split("\n").find((l) => l.includes(text)) ?? ""

const columnOf = (frame: string, text: string): number =>
  lineOf(frame, text).indexOf(text)

describe("the type gutter", () => {
  it("keeps keys and #n on one column across typed, untyped and PR rows", async () => {
    const frame = await mount([
      task("SHOP-1", { pill: "story" }),
      task("SHOP-2", { indent: true, pill: "subtask" }),
      task("SHOP-3", { indent: true }),
      pr(214),
    ])
    const column = columnOf(frame, "SHOP-2")
    expect(column).toBeGreaterThan(0)
    expect(columnOf(frame, "SHOP-3")).toBe(column)
    expect(columnOf(frame, "#214")).toBe(column)
  })

  it("draws the type ahead of the tree, not after the summary", async () => {
    const frame = await mount([
      task("SHOP-1", { pill: "story" }),
      task("SHOP-2", { indent: true, pill: "subtask" }),
    ])
    const line = lineOf(frame, "SHOP-2")
    expect(line.indexOf("subtask")).toBeGreaterThanOrEqual(0)
    expect(line.indexOf("subtask")).toBeLessThan(line.search(/[├└]/))
    expect(line.indexOf("subtask")).toBeLessThan(line.indexOf("Summary"))
  })

  it("draws no gutter on a list with no task rows", async () => {
    const plain = await mount([pr(214)])
    const typed = await mount([task("SHOP-1", { pill: "epic" }), pr(214)])
    expect(columnOf(typed, "#214")).toBe(
      columnOf(plain, "#214") + TYPE_GUTTER_COLS,
    )
  })

  it("draws no gutter when no task row carries a type", async () => {
    const untyped = await mount([task("SHOP-1"), pr(214)])
    const typed = await mount([task("SHOP-1", { pill: "epic" }), pr(214)])
    expect(columnOf(typed, "SHOP-1")).toBe(
      columnOf(untyped, "SHOP-1") + TYPE_GUTTER_COLS,
    )
  })

  it("clips a label wider than the gutter rather than shifting its row", async () => {
    const frame = await mount([
      task("SHOP-1", { pill: "story" }),
      task("SHOP-2", { pill: "improvement" }),
    ])
    expect(columnOf(frame, "SHOP-2")).toBe(columnOf(frame, "SHOP-1"))
    expect(frame).not.toContain("improvement")
  })
})

describe("the stage pill", () => {
  it("renders alongside a note rather than replacing it", async () => {
    const frame = await mount([
      task("SHOP-1", {
        stage: { label: "QA", icon: "◆" },
        note: "SHOP-900",
        warning: "PR merged",
      }),
    ])
    const line = lineOf(frame, "SHOP-1")
    const stage = `${glyph("plCapLeft")}◆ QA${glyph("plCapRight")}`
    expect(line).toContain(stage)
    expect(line).toContain("SHOP-900")
    expect(line.indexOf(stage)).toBeLessThan(line.indexOf("PR merged"))
    expect(line.indexOf("PR merged")).toBeLessThan(line.indexOf("SHOP-900"))
  })

  it("draws the label alone when the host gives no icon", async () => {
    const frame = await mount([task("SHOP-1", { stage: { label: "QA" } })])
    expect(lineOf(frame, "SHOP-1")).toContain(
      `${glyph("plCapLeft")}QA${glyph("plCapRight")}`,
    )
  })

  it("keeps the row inside the frame when the summary is far too long", async () => {
    const frame = await mount([
      task("SHOP-1", {
        summary: "x".repeat(400),
        pill: "epic",
        stage: { label: "In development", icon: "◆" },
      }),
    ])
    expect(frame).toContain("In development")
    for (const line of frame.split("\n"))
      expect([...line].length).toBeLessThanOrEqual(COLS + 4)
  })
})
