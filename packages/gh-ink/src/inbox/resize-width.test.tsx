import { describe, expect, it, beforeAll } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import type { GHItem, Section } from "./inbox.js"

/*
 * A terminal narrowed after launch still draws its frame to the terminal it is
 * standing in NOW, not the one the process started in. This file existed in a
 * note first: layout-height.test.tsx ends by saying it does not yet cover a
 * narrower-after-launch mount, because the frame width used to live in `COLS`,
 * which is sampled from `process.stdout` when the inbox module loads and never
 * looked at again. The symptom was the header's segments spilling onto a second
 * line, the frame running a row past the terminal, and Ink clipping overflow
 * from the top — which eats the header.
 *
 * `COLS` is pinned BEFORE importing the inbox, the way row-cap.test.tsx pins it
 * wide — so the module-load sample is provably 116 (120 - 4 frame chrome) while
 * the mount is 70, which is what makes a stale width fail this file. Vitest
 * isolates modules per file, so the pin never leaks into another suite.
 */
const MODULE_COLS = 120

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

// Ink 7 drives input off the `readable` event and pulls with `read()`, not off
// `data` — a stdin that only emits `data` looks alive and delivers nothing.
class FakeStdin extends EventEmitter {
  isTTY = true
  private buffer: string | null = null
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => {
    const data = this.buffer
    this.buffer = null
    return data
  }
  press = (key: string) => {
    this.buffer = key
    this.emit("readable")
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

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
  indent: false,
})

const SECTIONS: Section[] = [
  { id: "open", label: "Open", items: [pr(1), pr(2)] },
]

// Colour codes would shift every column index below, and whether chalk emits
// them at all depends on the runner rather than on this code.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (line: string) => line.replace(ANSI, "")
const height = (frame: string) => frame.replace(/\n$/, "").split("\n").length

let App: typeof import("./inbox.js").App
let COLS: number

beforeAll(async () => {
  Object.defineProperty(process.stdout, "columns", {
    value: MODULE_COLS,
    configurable: true,
  })
  ;({ App, COLS } = await import("./inbox.js"))
})

const mount = async (columns: number) => {
  const stdout = new FakeStdout(columns, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      title="cockpit"
      fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
    />,
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
  return {
    stdout,
    frame: () => stripAnsi(stdout.lastFrame()),
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

// The header's dotted rule is the one thing that spans the frame by measuring
// it: the fill is priced off the width the header was drawn against (see
// `InboxHeader`). Two `╌` lines means an overflowed row wrapped mid-rule, which
// is the stale-width slack the frame pays for in height.
const assertFrameFitsTerminal = (frame: string, rows: number) => {
  const lines = frame.replace(/\n$/, "").split("\n")
  const ruleLines = lines.filter((l) => l.includes("╌"))
  expect(ruleLines).toHaveLength(1)
  expect(ruleLines[0]!.startsWith("│")).toBe(true)
  const bottom = lines.findLastIndex((l) => l.includes("╰"))
  expect({ h: height(frame), bottom: bottom + 1 }).toEqual({ h: rows, bottom: rows })
}

describe("a terminal narrower than the one the module loaded with", () => {
  it("keeps the frame exactly the terminal's height, and the header on one line", async () => {
    expect(COLS).toBe(MODULE_COLS - 4)
    const t = await mount(70)
    const frame = t.frame()
    t.done()
    assertFrameFitsTerminal(frame, 30)
  })

  // The true route to the bug: launched with the good width, then the window
  // is dragged in. Mounting the whole run narrow covers the same read, but this
  // is the path a live cockpit takes — the resize event, not the mount.
  it("follows a resize emitted after launch", async () => {
    const t = await mount(MODULE_COLS)
    t.stdout.columns = 70
    t.stdout.emit("resize")
    await settle()
    await settle()
    const frame = t.frame()
    t.done()
    assertFrameFitsTerminal(frame, 30)
  })
})
