import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"

// A first fetch that comes back with nothing used to console.log and
// process.exit. Hosts render this App under `alternateScreen: true`, where Ink
// restores the primary buffer on teardown without replaying anything written to
// the alternate one — so the message was printed into a buffer that was then
// thrown away, and the user got a blank terminal.
//
// Mounted for real rather than asserted on a stand-in: the bug lived in the gap
// between "a message was produced" and "a message survived", which only a real
// mount can tell apart. These tests also fail LOUDLY against the old code — the
// process.exit takes the vitest worker with it.
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
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

const POPULATED: Section[] = [
  {
    id: "open",
    label: "Open",
    items: [
      {
        kind: "pr",
        number: 1,
        title: "a pull request that is definitely here",
        repo: "kud/some-repo",
        url: "https://github.com/kud/some-repo/pull/1",
        health: "waiting",
        age: "2d",
        ts: 0,
        unresolved: 0,
        conversation: 0,
        indent: false,
      } satisfies GHItem,
    ],
  },
]

const mount = async (
  fetcher: () => Promise<{ sections: Section[]; login: string }>,
  emptyHint?: string,
) => {
  const stdout = new FakeStdout(120, 44)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={fetcher}
      title="cockpit · kud/some-repo"
      emptyHint={emptyHint}
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
  const frame = stdout.lastFrame()
  instance.unmount()
  instance.cleanup()
  return frame
}

describe("no rows to browse", () => {
  it("renders an empty state instead of printing and exiting", async () => {
    const frame = await mount(async () => ({ sections: [], login: "kud" }))
    expect(frame).toContain("Nothing open.")
  })

  it("names the scope that came back empty", async () => {
    const frame = await mount(
      async () => ({ sections: [], login: "kud" }),
      "No open PRs or issues on kud/some-repo.",
    )
    // The title alone is not enough: `cockpit` and `cockpit · kud/some-repo`
    // differ by a suffix that is easy to read past, and reading past it is the
    // mistake this state exists to prevent.
    expect(frame).toContain("No open PRs or issues on kud/some-repo.")
    expect(frame).toContain("Cockpit · kud/some-repo")
  })

  it("says the fetch failed, and why, rather than dying silently", async () => {
    const frame = await mount(async () => {
      throw new Error("gh: HTTP 502")
    })
    expect(frame).toContain("Fetch failed")
    expect(frame).toContain("gh: HTTP 502")
    // Distinct from the empty state — telling a dead fetch from a clear repo is
    // the whole point, and both rendering "nothing to show" would pass a test
    // that only asserted *something* was on screen.
    expect(frame).not.toContain("Nothing open.")
  })

  it("offers a way out, since it no longer exits on its own", async () => {
    const frame = await mount(async () => ({ sections: [], login: "kud" }))
    expect(frame).toContain("q")
    expect(frame).toContain("quit")
  })

  // The guard: without it every assertion above would still pass if the empty
  // state rendered unconditionally, over a list that was actually there.
  it("shows none of this when rows did come back", async () => {
    const frame = await mount(async () => ({
      sections: POPULATED,
      login: "kud",
    }))
    expect(frame).toContain("a pull request that is definitely here")
    expect(frame).not.toContain("Nothing open.")
    expect(frame).not.toContain("Fetch failed")
  })
})
