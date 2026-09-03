import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { glyphs } from "@kud/glyphs"
import { App } from "./inbox.js"
import type { TaskRow, Section } from "./inbox.js"

/*
 * `pill` and `note` are the two trailing annotations a task row can carry, and
 * they are deliberately not one field wearing two hats.
 *
 * `pill` is a category the row BELONGS to — the word itself is the information,
 * so it gets a filled shape. `note` is a reference the reader follows — a parent
 * ticket key — and filling one gives a breadcrumb a weight it has not earned.
 * The cockpit epic marker used to borrow `note`, which is what made the question
 * worth answering: it read as more prose at the end of a sentence.
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

const row = (over: Partial<TaskRow> = {}): TaskRow => ({
  kind: "task",
  key: "PROJ-1",
  summary: "Stand up the new subdomain",
  url: "https://example.invalid/PROJ-1",
  status: "open",
  age: "",
  indent: false,
  ...over,
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

describe("task row pill", () => {
  it("draws the label as a filled pill", async () => {
    const frame = await mount(row({ pill: "epic" }))
    expect(frame).toContain("epic")
    expect(frame).toContain(glyphs.plCapLeft)
    expect(frame).toContain(glyphs.plCapRight)
  })

  it("draws no caps on a row that has no pill", async () => {
    expect(await mount(row())).not.toContain(glyphs.plCapLeft)
  })

  // Both, on one row: a story under someone else's epic carries that epic's key
  // as a breadcrumb, and the pill still has to be able to say what the row is.
  it("sits alongside a note rather than replacing it", async () => {
    const frame = await mount(row({ pill: "epic", note: "PROJ-900" }))
    expect(frame).toContain("epic")
    expect(frame).toContain("PROJ-900")
  })

  // The trap the indent term already taught this budget once. Priced by its
  // label alone the pill overflows by exactly its two caps, and the frame is
  // sized to fill the terminal — so one column too many scrolls the whole panel
  // instead of clipping the row.
  it("keeps the row inside the frame when the summary is far too long", async () => {
    const frame = await mount(
      row({ summary: "x".repeat(400), pill: "epic" }),
      80,
    )
    expect(frame).toContain("epic")
    for (const line of frame.split("\n"))
      expect([...line].length).toBeLessThanOrEqual(80)
  })
})
