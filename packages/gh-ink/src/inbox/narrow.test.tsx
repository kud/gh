import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, COLS } from "./inbox.js"
import type { GHItem, Section, TaskRow } from "./inbox.js"
import type { Sidebar } from "../components/side-panel.js"

/*
 * A row must FIT the width it was given, always.
 *
 * Ink's answer to a row wider than its container is not to clip it — it is to
 * compress every flexible child in that row, so a key, a number and a title all
 * shrink together and wrap into a column of fragments. The frame stops looking
 * like a list at all, and the rail beside it gets pushed off the screen.
 *
 * The title budget floored at 20 columns, which is fine while the frame is wide
 * and fatal once the rail takes forty of them: a PR row carrying a long repo name
 * and two ages has no room left, takes the floor anyway, and overflows by exactly
 * the difference. Found live, on the real board, minutes after the rail was
 * turned on by default — the specs that existed used task rows, which have none
 * of the trailing furniture that makes a PR row long.
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

const settle = () => new Promise((r) => setImmediate(r))

const task = (key: string, summary: string, depth: number): TaskRow => ({
  kind: "task",
  key,
  summary,
  url: `https://jira/${key}`,
  status: "In Development",
  age: "",
  depth,
  ticket: key,
})

// The real shape that broke it: a long title, a long repo, and both ages.
const pr = (n: number, depth: number): GHItem => ({
  kind: "pr",
  number: n,
  title:
    "ACC-11125: Wire the Segment write key into the qa/uat/prod build pipeline",
  repo: "theorchard/frontend-royalties",
  url: `https://github.com/theorchard/frontend-royalties/pull/${n}`,
  health: "waiting",
  age: "1w",
  activityAge: "6d",
  ts: 0,
  unresolved: 2,
  conversation: 0,
  author: "someone-else",
  depth,
})

const sections: Section[] = [
  {
    id: "in-progress",
    label: "In progress",
    items: [
      task("ACC-11125", "Provision Segment as Terraform-managed infra", 0),
      pr(2843, 1),
      pr(38328, 1),
    ],
  },
]

const sidebar: Sidebar = {
  title: "Initiatives",
  rows: [
    {
      key: "ACC-11089",
      label: "New branding — abacus.sonymusic.com subdomain setup",
      live: 1,
      done: 4,
      total: 9,
      wantsYou: true,
    },
  ],
}

const frameAt = async (columns: number, withSidebar: boolean) => {
  const stdout = new FakeStdout(columns, 30)
  const instance = render(
    <App
      fetcher={async () => ({
        sections,
        login: "kud",
        ...(withSidebar ? { sidebar } : {}),
      })}
      title="cockpit"
    />,
    {
      stdout: stdout as never,
      stdin: new FakeStdin() as never,
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

// A row that fits is drawn on ONE line. A row that overflows is compressed by
// Ink into a stack of fragments, which is what the reader actually sees — so
// counting lines is a truer assertion than measuring the widest one.
const bodyLines = (frame: string) =>
  frame.split("\n").filter((l) => /#\d|ACC-/.test(l)).length

describe("a row given less width than it wants", () => {
  it("still draws each row on a single line, with the rail open", async () => {
    expect(bodyLines(await frameAt(COLS + 4, true))).toBe(3)
  })

  it("still draws each row on a single line, with the rail closed", async () => {
    expect(bodyLines(await frameAt(COLS + 4, false))).toBe(3)
  })

  /*
   * Every case here narrows the row by OPENING THE RAIL, never by mounting a
   * smaller terminal, and that is not a stylistic choice.
   *
   * `COLS` is sampled from the real terminal when the module loads, so a row's
   * budget does not know what width the FakeStdout was given: mount at 48 columns
   * and the rows still measure themselves against whatever window is running the
   * suite. A spec written that way passes wherever it is run and proves nothing —
   * a check that cannot fail, which is worse than no check because it is counted.
   *
   * The rail is the one lever that moves the number the rows actually read.
   */
  it("gives up its trailing context rather than its subject", async () => {
    const roomy = await frameAt(COLS + 4, false)
    const tight = await frameAt(COLS + 4, true)
    // Room for everything: the repo and the author are context worth having.
    expect(roomy).toContain("theorchard/frontend-royalties")
    expect(roomy).toContain("by someone-else")
    // Forty columns poorer, the same row sheds them and keeps its subject. The
    // title is elided in the MIDDLE, so this asserts its head rather than a span
    // that truncation would cut through.
    expect(tight).not.toContain("theorchard/frontend-royalties")
    expect(tight).not.toContain("by someone-else")
    expect(tight).toContain("ACC-11125: Wire the Seg")
  })

  // The news is never what yields. A row that dropped its own headline to keep a
  // repo name would have the priority exactly backwards.
  it("keeps what the refresh just said about the row", async () => {
    const tight = await frameAt(COLS + 4, true)
    expect(tight).not.toContain("theorchard/frontend-royalties")
    expect(tight).toContain("#2843")
  })
})
