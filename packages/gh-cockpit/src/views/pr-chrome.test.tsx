import { describe, expect, it } from "vitest"
import { EventEmitter } from "node:events"
import { createRequire } from "node:module"
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
//
// `writes` counts every frame any mounted tree has drawn, for `settle` to tell
// a quiet tree from one still drawing.
let writes = 0

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
    writes += 1
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

/*
 * Wait for React, not for a number of event-loop turns.
 *
 * Both specs here used to count `setImmediate` turns: two after mounting, three
 * after `d`. Ink mounts a LEGACY root, whose passive effects run on React's
 * scheduler in 5ms slices measured on the real clock, so the number of turns
 * any of it takes depends on how loaded the machine is. And one of those
 * effects is `useInput` subscribing the browse list's key handler — a key
 * emitted before it lands is not queued, it is dropped. On a loaded CI runner
 * `d` went in before the list was listening, the drill never opened, and the
 * spec read the list it started on.
 *
 * So `settle` waits until the tree is quiet: an idle-priority task, which the
 * scheduler runs only once every pending effect has, then a turn for whatever
 * render those effects scheduled, round again until a round draws nothing. It
 * is the scheduler instance Ink's reconciler resolved; there is one in the tree.
 */
type Scheduler = {
  unstable_scheduleCallback: (priority: number, task: () => void) => unknown
  unstable_IdlePriority: number
}
const scheduler = createRequire(import.meta.url)("scheduler") as Scheduler
const drainScheduler = () =>
  new Promise<void>((resolve) => {
    scheduler.unstable_scheduleCallback(scheduler.unstable_IdlePriority, () =>
      resolve(),
    )
  })
const settle = async () => {
  let seen: number
  do {
    seen = writes
    await drainScheduler()
    await new Promise((resolve) => setImmediate(resolve))
  } while (writes !== seen)
}

// Wait on what the screen says rather than on how long it might take to say
// it. A lone `esc` is the reason this cannot be a single settle: Ink holds it
// for 20ms of real time in case it starts an escape sequence, and only then
// hands it to the app. The deadline only bounds a failure; a passing wait
// returns at the first frame that matches.
const frameWith = async (
  stdout: FakeStdout,
  ok: (frame: string) => boolean,
  what: string,
) => {
  const deadline = performance.now() + 5000
  await settle()
  while (!ok(stripAnsi(stdout.lastFrame()))) {
    if (performance.now() > deadline)
      throw new Error(`no frame ${what}:\n${stdout.lastFrame()}`)
    await settle()
  }
}

const ESC = String.fromCharCode(27)
const BREADCRUMB = "#1 · acme/api-gateway"

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
    await frameWith(
      stdout,
      (f) => f.includes("pull request number 2"),
      "with the list drawn",
    )

    stdin.press("d")
    await frameWith(
      stdout,
      (f) => f.includes(BREADCRUMB),
      "with the drill open",
    )
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
    expect(frame).toContain(BREADCRUMB)
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
    await frameWith(
      stdout,
      (f) => f.includes("pull request number 2"),
      "with the list drawn",
    )

    stdin.press("d")
    await frameWith(
      stdout,
      (f) => f.includes(BREADCRUMB),
      "with the drill open",
    )

    stdin.press(ESC)
    await frameWith(
      stdout,
      (f) => !f.includes(BREADCRUMB),
      "with the drill closed",
    )
    const frame = stripAnsi(stdout.lastFrame())
    instance.unmount()
    instance.cleanup()

    expect(frame).not.toContain(BREADCRUMB)
    expect(frame).toContain("pull request number 1")
    expect(frame).toContain("pull request number 2")
  })
})
