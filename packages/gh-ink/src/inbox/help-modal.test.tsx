import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { HelpModal } from "./inbox.js"
import type { InboxExtension } from "./extension.js"

// ink-testing-library hardcodes 100 columns, and width is the whole subject
// here, so the harness is ink's own render over a stdout we size ourselves.
class FakeStdout extends EventEmitter {
  frames: string[] = []
  constructor(
    public columns: number,
    public rows = 60,
  ) {
    super()
  }
  write = (frame: string) => {
    this.frames.push(frame)
  }
  lastFrame = () => this.frames.at(-1) ?? ""
}

// The widest legend either cockpit actually mounts: work adds Jira and the work
// toggle, both carry the two global extensions, home supplies tab meanings.
const EXTENSIONS: InboxExtension[] = [
  {
    id: "delegate",
    title: "Delegate to an agent",
    key: "a",
    scope: "global",
    body: () => null,
  },
  {
    id: "copy-prompt",
    title: "Copy prompt to clipboard",
    key: "y",
    scope: "global",
    body: () => null,
  },
]

const TAB_HELP: [string, string][] = [
  ["Assigned", "assigned to you"],
  ["Reviewed", "you already reviewed"],
  ["Issues", "your repos + filed by you"],
  ["Done", "your PRs closed < 14d"],
]

const frameAt = (
  columns: number,
  opts: { maxRows?: number; scroll?: number } = {},
) => {
  const stdout = new FakeStdout(columns)
  const instance = render(
    <HelpModal
      workToggle
      hasJira
      extensions={EXTENSIONS}
      tabHelp={TAB_HELP}
      maxRows={opts.maxRows}
      scroll={opts.scroll}
    />,
    {
      stdout: stdout as never,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  )
  const frame = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return frame
}

const tallest = (frame: string) => frame.split("\n").filter(Boolean).length

// Every label the legend promises, spelled as the reader sees it. A row that
// wraps splits one of these across two lines, so a substring test over the whole
// frame catches the failure exactly — nothing else about the layout is asserted.
const LABELS = [
  "You spoke last · waiting on them",
  "your repos + filed by you",
  "switch to branch here",
  "open repo in new pane",
  "Jira: move / open ticket",
  "Copy prompt to clipboard",
  "Delegate to an agent",
]

const widest = (frame: string) =>
  Math.max(...frame.split("\n").map((line) => [...line].length))

// 80 forces the single stack, 100 and 114 the two-column layout, 130 the three
// across. Every rung of the ladder, and 114 is the terminal this broke on.
const WIDTHS = [80, 100, 114, 130]

describe("HelpModal", () => {
  for (const columns of WIDTHS) {
    it(`keeps every label intact at ${columns} columns`, () => {
      const frame = frameAt(columns)
      for (const label of LABELS) expect(frame).toContain(label)
    })

    it(`stays inside ${columns} columns`, () => {
      expect(widest(frameAt(columns))).toBeLessThanOrEqual(columns)
    })
  }

  it("puts all three columns across when the terminal is wide enough", () => {
    const heading = frameAt(130)
      .split("\n")
      .find((line) => line.includes("Status"))
    expect(heading).toContain("Tabs")
    expect(heading).toContain("Keys")
  })

  it("drops to two columns when three no longer fit", () => {
    const heading = frameAt(100)
      .split("\n")
      .find((line) => line.includes("Status"))
    expect(heading).toContain("Keys")
    expect(heading).not.toContain("Tabs")
  })

  // A short terminal used to clip the panel from the TOP — heading, borders and
  // the first rows gone, with nothing on screen admitting it. The window is the
  // fix; these pin the three things that make it readable rather than merely
  // shorter.
  describe("on a terminal too short for the whole legend", () => {
    it("stays inside the rows it was given", () => {
      expect(tallest(frameAt(100, { maxRows: 16 }))).toBeLessThanOrEqual(16)
    })

    it("keeps the heading and the close hint", () => {
      const frame = frameAt(100, { maxRows: 16 })
      expect(frame).toContain("Legend")
      expect(frame).toContain("↑↓ scroll")
      expect(frame).toContain("esc · ? close")
    })

    it("reaches the rows the first screen cut off", () => {
      const top = frameAt(100, { maxRows: 16 })
      const bottom = frameAt(100, { maxRows: 16, scroll: 99 })
      expect(top).not.toContain("Copy prompt to clipboard")
      expect(bottom).toContain("Copy prompt to clipboard")
    })

    it("says nothing about scrolling when it all fits", () => {
      expect(frameAt(100, { maxRows: 40 })).not.toContain("↑↓ scroll")
    })
  })
})
