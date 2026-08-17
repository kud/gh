import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"

// The browse screen mounted for real, rather than a hand-built stand-in of its
// JSX. The composition IS the subject here — which layer is absolute, which is in
// flow, and what paints over what — so a replica would only ever confirm itself.
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

const pr = (number: number, title: string): GHItem => ({
  kind: "pr",
  number,
  title,
  repo: "kud/some-repo",
  url: `https://github.com/kud/some-repo/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

// Enough rows to fill the list area top to bottom. With only a handful the panel
// is centred over blank space and every assertion below passes for the wrong
// reason — verified by deleting the panel's background and watching the opacity
// test stay green.
const SECTIONS: Section[] = [
  {
    id: "open",
    label: "Open",
    items: Array.from({ length: 40 }, (_, n) =>
      pr(1201 + n, `pull request title number ${n} padded out a fair way`),
    ),
  },
]

const TAB_HELP: [string, string][] = [["Open", "your PRs, not draft"]]

const settle = () => new Promise((resolve) => setImmediate(resolve))

// Colour codes would shift every column index below, and whether chalk emits
// them at all depends on the runner rather than on this code.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (line: string) => line.replace(ANSI, "")

const mount = async (columns: number, rows: number) => {
  const stdout = new FakeStdout(columns, rows)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
      tabHelp={TAB_HELP}
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
    stdin,
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("overlays", () => {
  it("floats the legend over the list rather than replacing it", async () => {
    const { stdout, stdin, done } = await mount(120, 44)
    expect(stdout.lastFrame()).toContain("pull request title number 0")

    stdin.press("?")
    await settle()
    const frame = stdout.lastFrame()
    done()

    expect(frame).toContain("Legend")
    // The backdrop is the whole point: the rows are still there, behind.
    expect(frame).toContain("pull request title number 1")
  })

  it("keeps the legend opaque where it covers a row", async () => {
    const { stdout, stdin, done } = await mount(120, 44)
    stdin.press("?")
    await settle()
    const frame = stdout.lastFrame()
    done()

    // Within the legend's own column range, nothing from the list may show
    // through: a panel with no background is transparent, and the rows behind it
    // read straight through its padding. Located by the panel's corners rather
    // than by `│`, which the surrounding frame also draws.
    // The outer frame draws the same corners, and always outside the panel's:
    // its top comes first and its bottom last, so the panel is the other one.
    const lines = frame.split("\n").map(stripAnsi)
    const top = lines.findLastIndex((line) => line.includes("╭"))
    const bottom = lines.findIndex((line) => line.includes("╰"))
    const left = lines[top]!.indexOf("╭")
    const right = lines[top]!.indexOf("╮")
    expect(bottom - top).toBeGreaterThan(5)

    for (const line of lines.slice(top, bottom + 1))
      expect(line.slice(left, right + 1)).not.toMatch(/pull request/)
  })

  it("shows the whole legend when it is taller than the list area", async () => {
    // 24 rows leaves a list area far shorter than the legend. Laid out the other
    // way round — panel absolute inside a fixed-height box — this centre-clipped
    // it, cutting off both the border and the closing hint.
    const { stdout, stdin, done } = await mount(120, 24)
    stdin.press("?")
    await settle()
    const frame = stdout.lastFrame()
    done()

    expect(frame).toContain("Legend")
    expect(frame).toContain("esc · ? close")
    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
  })
})
