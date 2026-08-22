import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { TaskRow, Section } from "./inbox.js"

// `note` exists so a host can hang a secondary annotation off a row — a
// recurrence marker, a source hint — without concatenating it into `summary`.
// Concatenating is what these tests guard against: the title is truncated
// against a width budget, so a suffix hidden inside it is both undimmable and
// liable to be cut off precisely when the row is long enough to need it.
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

const row = (summary: string, note?: string): TaskRow => ({
  kind: "task",
  key: "PROJ-1",
  summary,
  url: "https://example.invalid/PROJ-1",
  status: "open",
  age: "2d",
  indent: false,
  ...(note ? { note } : {}),
})

const mount = async (item: TaskRow, columns = 120) => {
  const sections: Section[] = [{ id: "today", label: "Today", items: [item] }]
  const stdout = new FakeStdout(columns, 44)
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

describe("task row note", () => {
  it("renders the note after the summary", async () => {
    const frame = await mount(row("Water the plants", "↻"))
    expect(frame).toContain("Water the plants")
    expect(frame).toContain("↻")
  })

  it("renders nothing extra when there is no note", async () => {
    const frame = await mount(row("Water the plants"))
    expect(frame).toContain("Water the plants")
    expect(frame).not.toContain("undefined")
  })

  it("keeps the note visible when the summary is long enough to be truncated", async () => {
    // The note's width is subtracted from the title budget rather than competing
    // with it, so a row too long to fit loses title characters, never the note.
    const frame = await mount(row("x".repeat(400), "↻"), 80)
    expect(frame).toContain("↻")
  })
})
