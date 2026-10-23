import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { glyph } from "@kud/glyphs"
import { App, warningCount } from "./inbox.js"
import type { TaskRow, Section } from "./inbox.js"
import { stripGlyph } from "../components/status-strip.js"

/*
 * `warning` says something about a row is wrong — a ticket sitting in a column
 * its PRs contradict, say. It is drawn right after the pill, in the strip's
 * warn mark and colour, and the tab holding the row counts it as `⚠ N` after
 * its badge. The count is read off the rows, so a tab can never warn about a
 * row that is silent.
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
  key: "SHOP-1234",
  summary: "Round statement totals",
  url: "https://example.invalid/SHOP-1234",
  status: "Review",
  age: "",
  ...over,
})

const mount = async (sections: Section[], columns = 140) => {
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

const [MARK] = stripGlyph("warn")
const CAP_R = glyph("plCapRight")

describe("task row warning", () => {
  it("draws the mark and the words right after the pill", async () => {
    const frame = await mount([
      {
        id: "review",
        label: "Review",
        items: [
          row({
            pill: "story",
            warning: "PR merged · move to QA?",
            note: "SHOP-1000",
          }),
        ],
      },
    ])
    expect(frame).toContain(
      `story${CAP_R} ${MARK} PR merged · move to QA? SHOP-1000`,
    )
  })

  it("draws no mark on a row without a warning", async () => {
    const frame = await mount([
      { id: "review", label: "Review", items: [row({ pill: "story" })] },
    ])
    expect(frame).not.toContain(MARK)
  })

  it("counts the warned rows on the tab, after its badge", async () => {
    const frame = await mount([
      {
        id: "review",
        label: "Review",
        items: [
          row({ warning: "PR merged · move to QA?" }),
          row({ key: "SHOP-1235", url: "https://example.invalid/SHOP-1235" }),
        ],
      },
      { id: "qa", label: "QA", items: [row({ key: "SHOP-1236" })] },
    ])
    const tabs = frame.split("\n").find((l) => l.includes("Review"))!
    expect(tabs).toMatch(new RegExp(`Review \\S2\\S ${glyph("warning")} 1`))
    expect(tabs).not.toMatch(/QA \S1\S \S 1/)
  })

  it("keeps a long warning inside the row's width", async () => {
    const frame = await mount(
      [
        {
          id: "qa",
          label: "QA",
          items: [
            row({
              summary: "A very long summary ".repeat(6),
              pill: "story",
              warning: "PR not merged · in QA",
            }),
          ],
        },
      ],
      100,
    )
    const line = frame.split("\n").find((l) => l.includes("SHOP-1234"))!
    expect(line).toContain(`${MARK} PR not merged · in QA`)
    expect(line).toContain("…")
  })
})

describe("warningCount", () => {
  it("counts distinct keys, so a ticket drawn twice warns once", () => {
    const s: Section = {
      id: "qa",
      label: "QA",
      items: [
        row({ warning: "PR not merged · in QA" }),
        row({ warning: "PR not merged · in QA" }),
        row({ key: "SHOP-1235", warning: "PR not merged · in UAT" }),
        row({ key: "SHOP-1236" }),
      ],
    }
    expect(warningCount(s)).toBe(2)
  })

  it("is zero for a tab with nothing wrong", () => {
    expect(warningCount({ id: "x", label: "X", items: [row()] })).toBe(0)
  })
})
