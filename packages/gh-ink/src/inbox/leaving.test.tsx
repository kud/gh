import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, LEAVING_HOLD_MS, MERGED_FRAME_MS } from "./inbox.js"
import type { DetailContext, GHItem, Section } from "./inbox.js"

// Closing a row used to remove it on the keypress. The flash said "✓ Closed
// #412" about a row that was already off screen, so the one thing that could
// have confirmed it — the row itself — was gone before the sentence describing
// it arrived. These pin the replacement: the row stays for a beat wearing GONE,
// only that row wears it, and it is gone once the hold expires.
//
// Mounted for real rather than asserted on a stand-in, like merged.test.tsx
// beside it: all of this lives in the gap between "state was set" and "a frame
// came out carrying it", which only a real mount can tell apart.
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

// Ink 7 drives input off `readable` and pulls with `read()`, not off `data`.
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
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const issue = (number: number, title: string): GHItem => ({
  kind: "issue",
  number,
  title,
  repo: "kud/some-repo",
  url: `https://github.com/kud/some-repo/issues/${number}`,
  health: "none",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const CLOSING = issue(412, "the issue being closed")
const BYSTANDER = issue(398, "a bystander that must not leave")
const SECTIONS: Section[] = [
  { id: "open", label: "Open", items: [CLOSING, BYSTANDER] },
]

// The host's drill view, reduced to the one thing under test: a handle on the
// onRemove App hands down, which is what the Close action calls. Real timers
// throughout — the hold and the dissolve are both setTimeout/setInterval inside
// a mounted Ink tree, and faking them desynchronises the render loop from the
// clock, so a passing test would prove nothing about what a person sees.
//
// `drill` is opt-out because opening the drill view HIDES the list, and this
// stand-in renders null in its place. Closing navigates back on its own, which
// is why the closing tests need no way out of it.
const mount = async ({ drill = true } = {}) => {
  const stdout = new FakeStdout(120, 44)
  const stdin = new FakeStdin()
  let close: (() => void) | null = null

  const instance = render(
    <App
      fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
      title="cockpit"
      detailFor={(ctx: DetailContext) => {
        close = () => ctx.onRemove(ctx.item)
        return null
      }}
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

  // ↵ on the first row opens the drill view, which is what causes detailFor to
  // run and hand us its onRemove.
  if (drill) {
    stdin.press("\r")
    await settle()
    await settle()
  }

  return {
    stdout,
    close: () => close?.(),
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("a closed row", () => {
  it("says GONE, and only on the row that left", async () => {
    const { stdout, close, stop } = await mount()
    close()
    await settle()
    await after(MERGED_FRAME_MS * 2)

    const frame = stdout.lastFrame()
    // The word, not the colour: kud is colourblind, so a test that only checked
    // for grey would pass against a row nobody could read.
    expect(frame).toContain("GONE")
    expect(frame).toContain("the issue being closed")
    expect(frame.match(/GONE/g)).toHaveLength(1)
    stop()
  })

  it("drops the row once the hold expires", async () => {
    const { stdout, close, stop } = await mount()
    close()
    await settle()
    await after(LEAVING_HOLD_MS + 400)

    const frame = stdout.lastFrame()
    expect(frame).not.toContain("the issue being closed")
    expect(frame).not.toContain("GONE")
    // The guard: without it this would pass just as well if closing had blanked
    // the whole list, which is the failure mode a "not.toContain" cannot see.
    expect(frame).toContain("a bystander that must not leave")
    stop()
  })

  it("leaves every row alone until something is actually dismissed", async () => {
    const { stdout, stop } = await mount({ drill: false })
    await after(MERGED_FRAME_MS * 4)

    const frame = stdout.lastFrame()
    expect(frame).not.toContain("GONE")
    expect(frame).toContain("the issue being closed")
    stop()
  })

  it("holds the row for longer than the dissolve takes to play once", () => {
    // Both are tunable, and a later edit could invert them — leaving a row that
    // is removed before its animation has completed a single cycle.
    expect(LEAVING_HOLD_MS).toBeGreaterThan(MERGED_FRAME_MS * 4)
  })
})
