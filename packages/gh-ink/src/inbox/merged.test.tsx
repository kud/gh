import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { glyphs } from "@kud/glyphs"
import { App, MERGED_HOLD_MS, MERGED_FRAME_MS } from "./inbox.js"
import type { DetailContext, GHItem, Section } from "./inbox.js"

// Merging is the one action in this cockpit that ENDS a piece of work, and it
// used to leave the row sitting there until some later refresh quietly took it
// away. These pin the three halves of the replacement: the row says MERGED, only
// that row says it, and it is gone once the hold expires.
//
// Mounted for real rather than asserted on a stand-in, like the tests beside it:
// all of this lives in the gap between "state was set" and "a frame came out
// carrying it", which only a real mount can tell apart.
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

const pr = (number: number, title: string): GHItem => ({
  kind: "pr",
  number,
  title,
  repo: "kud/some-repo",
  url: `https://github.com/kud/some-repo/pull/${number}`,
  health: "approved",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const MERGING = pr(412, "the pull request being merged")
const BYSTANDER = pr(398, "a bystander that must not sparkle")
const SECTIONS: Section[] = [
  { id: "open", label: "Open", items: [MERGING, BYSTANDER] },
]

// The host's drill view, reduced to the one thing under test: a handle on the
// onMerged the App hands down. Real timers throughout — the hold and the sparkle
// are both setTimeout/setInterval inside a mounted Ink tree, and faking them
// desynchronises the render loop from the clock, so a passing test would prove
// nothing about what a person sees.
//
// `drill` is opt-out because opening the drill view HIDES the list, and this
// stand-in renders null in its place — so a test that drills and never merges is
// asserting against a blank frame. Merging navigates back on its own, which is
// why the two merge tests need no way out of it.
const mount = async ({ drill = true } = {}) => {
  const stdout = new FakeStdout(120, 44)
  const stdin = new FakeStdin()
  let merge: (() => void) | null = null

  const instance = render(
    <App
      fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
      title="cockpit"
      detailFor={(ctx: DetailContext) => {
        merge = () => ctx.onMerged?.(ctx.item)
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
  // run and hand us its onMerged.
  if (drill) {
    stdin.press("\r")
    await settle()
    await settle()
  }

  return {
    stdout,
    merge: () => merge?.(),
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("a merged row", () => {
  it("says MERGED, and only on the row that merged", async () => {
    const { stdout, merge, stop } = await mount()
    merge()
    await settle()
    await after(MERGED_FRAME_MS * 2)

    const frame = stdout.lastFrame()
    // The word, not the colour: kud is colourblind, so a test that only checked
    // for purple would pass against a row nobody could read. In a pill, because
    // the marker shares the end of the row with the dim age and author cells and
    // as plain text read as one more of them.
    expect(frame).toContain(
      `${glyphs.plCapLeft}MERGED${glyphs.plCapRight}`,
    )
    expect(frame).toContain("the pull request being merged")
    stop()
  })

  it("drops the row once the hold expires", async () => {
    const { stdout, merge, stop } = await mount()
    merge()
    await settle()
    await after(MERGED_HOLD_MS + 400)

    const frame = stdout.lastFrame()
    expect(frame).not.toContain("the pull request being merged")
    expect(frame).not.toContain("MERGED")
    // The guard: without it this would pass just as well if the merge had blanked
    // the whole list, which is the failure mode a "not.toContain" cannot see.
    expect(frame).toContain("a bystander that must not sparkle")
    stop()
  })

  it("leaves every row alone until something is actually merged", async () => {
    const { stdout, stop } = await mount({ drill: false })
    await after(MERGED_FRAME_MS * 4)

    const frame = stdout.lastFrame()
    expect(frame).not.toContain("MERGED")
    expect(frame).toContain("the pull request being merged")
    stop()
  })

  it("holds the row for longer than the sparkle takes to say anything", () => {
    // Both are tunable, and a later edit could invert them — leaving a row that
    // is removed before its animation has completed a single cycle.
    expect(MERGED_HOLD_MS).toBeGreaterThan(MERGED_FRAME_MS * 4)
  })
})
