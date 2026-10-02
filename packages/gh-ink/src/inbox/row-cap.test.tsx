import { describe, it, expect, beforeAll } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import type { GHItem, Section } from "./inbox.js"

/*
 * On a wide window the PR row stops at 140 cells, and the trailing block
 * (threads, size, age) right-aligns to that line rather than to the window
 * edge. The tab strip and the header rule still span the frame.
 *
 * `COLS` is sampled from `process.stdout` when the module loads — see the long
 * note in narrow.test.tsx — so a FakeStdout alone cannot widen the rows. This
 * file pins the real stream's width BEFORE importing the inbox, which is the
 * only way to make the row budget read a wide window. Vitest isolates modules
 * per file, so the pinned width does not leak into any other suite.
 */
const WIDE = 220

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

const pr = (number: number, repo: string, title: string): GHItem => ({
  kind: "pr",
  number,
  title,
  repo,
  url: `https://github.com/${repo}/pull/${number}`,
  health: "waiting",
  age: "1w",
  activityAge: "6d",
  ts: 0,
  unresolved: 2,
  conversation: 0,
  additions: 412,
  deletions: 38,
  depth: 0,
})

const sections: Section[] = [
  {
    id: "mine",
    label: "Mine",
    items: [
      pr(172, "acme/api-gateway", "retry a declined card"),
      pr(464, "acme/api-gateway", "drop the legacy webhook route"),
      pr(31805, "example/web", "move the footer links into the sitemap"),
      pr(2005, "example/web", "lazy-load the checkout fonts"),
    ],
  },
]

let App: typeof import("./inbox.js").App
let COLS: number

beforeAll(async () => {
  Object.defineProperty(process.stdout, "columns", {
    value: WIDE,
    configurable: true,
  })
  ;({ App, COLS } = await import("./inbox.js"))
})

const frame = async () => {
  const stdout = new FakeStdout(WIDE, 30)
  const instance = render(
    <App fetcher={async () => ({ sections, login: "kud" })} title="cockpit" />,
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
  const out = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return out
}

describe("a PR row on a wide window", () => {
  it("ends its trailing block at 140 cells, not at the window edge", async () => {
    expect(COLS).toBeGreaterThan(140)
    const lines = (await frame()).split("\n")
    const rows = lines.filter((l) => /#\d+ /.test(l))
    expect(rows).toHaveLength(4)
    // Each row's content (inside the frame's border and padding) is at most
    // 140 cells, and every one ends on the age at the same column.
    const ends = rows.map((l) => l.lastIndexOf("(1w)") + "(1w)".length)
    expect(new Set(ends).size).toBe(1)
    const contentStart = rows[0].indexOf("│") + 2
    expect(ends[0] - contentStart).toBe(140)
    // The frame itself still spans the window.
    expect(Math.max(...lines.map((l) => l.length))).toBeGreaterThan(200)
  })

  it("starts every title two cells past the widest number", async () => {
    const rows = (await frame()).split("\n").filter((l) => /#\d+ /.test(l))
    const starts = [
      "retry a declined card",
      "drop the legacy webhook route",
      "move the footer links",
      "lazy-load the checkout fonts",
    ].map((t, i) => rows[i].indexOf(t))
    expect(new Set(starts).size).toBe(1)
    expect(starts[2] - (rows[2].indexOf("#31805") + "#31805".length)).toBe(2)
  })
})
