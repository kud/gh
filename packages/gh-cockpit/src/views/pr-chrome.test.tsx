import { describe, expect, it } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, type GHItem, type Section } from "../lib.js"
import { detailFor } from "./detail.js"

// The real drill path: `d` on a pull request mounts the cockpit's own PrView
// through `detailFor`, and the inbox frame, title row and footer stay mounted
// around it — the title PrView used to draw for itself now arrives as the
// header breadcrumb via `useChrome`.
//
// Same sized-stdout harness as gh-ink's inbox specs: the subject is App-level
// composition with keypresses, which ink-testing-library's fixed 100-column,
// row-less stdout cannot size.
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

const settle = () => new Promise((resolve) => setImmediate(resolve))
const ESC = String.fromCharCode(27)

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (line: string) => line.replace(ANSI, "")

describe("PrView inside the persistent chrome", () => {
  it("keeps the header and frame around the real drill view", async () => {
    const stdout = new FakeStdout(120, 30)
    const stdin = new FakeStdin()
    const instance = render(
      <App
        title="cockpit"
        fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
        detailFor={detailFor}
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

    stdin.press("d")
    await settle()
    await settle()
    await settle()
    const frame = stripAnsi(stdout.lastFrame())
    instance.unmount()
    instance.cleanup()

    // The drill's own content is up …
    expect(frame).toContain("pull request number 1")
    // … inside the inbox chrome: frame, title row, and the drill's title as
    // the header breadcrumb rather than a second title line of its own.
    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("@kud")
    expect(frame).toContain("#1 · acme/api-gateway")
    expect(frame).toMatch(/⌫ back.*q quit/)
    expect(frame).not.toContain("pull request number 2")
  })

  it("hands esc back to the browse list", async () => {
    const stdout = new FakeStdout(120, 30)
    const stdin = new FakeStdin()
    const instance = render(
      <App
        title="cockpit"
        fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
        detailFor={detailFor}
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

    stdin.press("d")
    await settle()
    await settle()
    await settle()
    expect(stripAnsi(stdout.lastFrame())).toContain("#1 · acme/api-gateway")

    stdin.press(ESC)
    await settle()
    await settle()
    await new Promise((r) => setTimeout(r, 20))
    await settle()
    const frame = stripAnsi(stdout.lastFrame())
    instance.unmount()
    instance.cleanup()

    expect(frame).not.toContain("#1 · acme/api-gateway")
    expect(frame).toContain("pull request number 1")
    expect(frame).toContain("pull request number 2")
  })
})
