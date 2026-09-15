import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { TaskRow, Section } from "./inbox.js"

/*
 * A host's one-cell mark before the key — a Jira priority arrow. What is
 * pinned is the width contract from `TaskRow.marker`: every task row in a list
 * draws the same cell or none, so a mark on one row never shifts the keys of
 * the others, and a list with no marks at all is drawn exactly as before.
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

const row = (key: string, over: Partial<TaskRow> = {}): TaskRow => ({
  kind: "task",
  key,
  summary: `Summary of ${key}`,
  url: `https://example.invalid/${key}`,
  status: "open",
  age: "",
  indent: false,
  ...over,
})

const mount = async (items: TaskRow[]) => {
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

const keyColumn = (frame: string, key: string): number =>
  frame.split("\n").find((l) => l.includes(key))?.indexOf(key) ?? -1

describe("task row marker", () => {
  it("draws the mark in its own cell before the key", async () => {
    const frame = await mount([
      row("PROJ-1", { marker: "▲", markerColor: "yellow" }),
      row("PROJ-2", { marker: " " }),
    ])
    expect(frame).toMatch(/▲ PROJ-1/)
  })

  // A blank of the same width keeps the grid: the row with nothing to say
  // starts its key exactly where the marked row does.
  it("keeps every key in the list at the same column", async () => {
    const frame = await mount([
      row("PROJ-1", { marker: "▲" }),
      row("PROJ-2", { marker: " " }),
      row("PROJ-3"),
    ])
    const at = keyColumn(frame, "PROJ-1")
    expect(at).toBeGreaterThan(0)
    expect(keyColumn(frame, "PROJ-2")).toBe(at)
    expect(keyColumn(frame, "PROJ-3")).toBe(at)
  })

  // A surface that never marks a row spends no column on the cell.
  it("draws no cell at all when no row carries a mark", async () => {
    const marked = await mount([row("PROJ-1", { marker: "▲" })])
    const plain = await mount([row("PROJ-1")])
    expect(keyColumn(plain, "PROJ-1")).toBe(keyColumn(marked, "PROJ-1") - 2)
  })
})
