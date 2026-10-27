import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { TaskRow, Section, GHItem } from "./inbox.js"

/*
 * The identity column of the board list: a child ticket's key and its PR
 * siblings' `#n` share one column, and the focus mark sits in the cursor
 * gutter, ahead of the tree stem. Pinned through the real App, the way
 * task-marker does it — the geometry is cell counting, and a unit test of
 * `ItemRow` (which is not exported) would test a copy.
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

const parent = (key: string): TaskRow => ({
  kind: "task",
  key,
  ticket: key,
  summary: `Summary of ${key}`,
  url: `https://example.invalid/${key}`,
  status: "In progress",
  age: "2d",
  marker: "▲",
})

const child = (key: string): TaskRow => ({
  ...parent(key),
  indent: true,
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

const columnOf = (frame: string, text: string): number =>
  frame
    .split("\n")
    .find((l) => l.includes(text))
    ?.indexOf(text) ?? -1

describe("the identity column in the board list", () => {
  it("starts a child ticket's key where its PR sibling starts its number", async () => {
    const frame = await mount([parent("PROJ-1"), child("PROJ-2"), pr(214)])
    expect(frame).toContain("PROJ-2")
    expect(frame).toContain("#214")
    // At the same tree depth: both rows indented under PROJ-1, drawn with the
    // tree's own prefixes rather than flat siblings.
    expect(columnOf(frame, "PROJ-2")).toBeGreaterThanOrEqual(0)
    expect(columnOf(frame, "#214")).toBeGreaterThanOrEqual(0)
    expect(columnOf(frame, "PROJ-2")).toBe(columnOf(frame, "#214"))
  })

  it("renders the child ticket and the PR as siblings under the parent", async () => {
    const frame = await mount([parent("PROJ-1"), child("PROJ-2"), pr(214)])
    const childLine = frame.split("\n").find((l) => l.includes("PROJ-2"))
    const prLine = frame.split("\n").find((l) => l.includes("#214"))
    expect(childLine).toBeDefined()
    expect(prLine).toBeDefined()
    // Both carry a tree stem, not the flat run: same depth, under the parent.
    expect(childLine).toMatch(/[├└]/)
    expect(prLine).toMatch(/[├└]/)
  })

  it("is the tree's job now, never the opener's: the only `┬` is the root's, over its child's stem", async () => {
    const frame = await mount([parent("PROJ-1"), pr(214)])
    const lines = frame.split("\n")
    const parentLine = lines.find((l) => l.includes("PROJ-1")) ?? ""
    const prLine = lines.find((l) => l.includes("#214")) ?? ""
    expect(lines.filter((l) => l.includes("┬"))).toEqual([parentLine])
    expect(prLine.indexOf("└")).toBe(parentLine.indexOf("┬"))
  })
})
