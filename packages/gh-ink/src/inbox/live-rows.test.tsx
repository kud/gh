import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import { createRequire } from "node:module"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"

/*
 * The manual refresh gate is deliberate: nothing repaints until you press `r`,
 * so the list cannot reshuffle under you mid-read. What it used to cost was the
 * other half of knowing — applying swapped one list for another and left you to
 * spot the difference against a frame the terminal had already scrolled away.
 *
 * These pin both halves of the fix. Before pressing, the header names what is
 * waiting; after pressing, each row that moved says so in words, and the ones
 * that left do it from where they actually were. And the stamp file, which is
 * the whole reason a refresh can now arrive unprompted, is pinned to stop at
 * the indicator — it must never reach the screen on its own.
 */

// Every frame any mounted tree has written, for `settle` to tell a quiet tree
// from one still drawing.
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

/*
 * Wait for React, not for a number of event-loop turns.
 *
 * `settle` used to be one `setImmediate`, called twice wherever two felt like
 * enough. Ink mounts a LEGACY root, and a legacy root runs its passive effects
 * on React's scheduler rather than at the end of the commit; the scheduler
 * works in 5ms slices measured on the real `performance.now()`, which no fake
 * clock here touches, and yields a macrotask whenever a slice runs out. So the
 * number of turns a frame needs depends on how fast the machine is.
 *
 * "settles once the hold is up" failed on a loaded CI runner in exactly that
 * gap. Spending a hold is two renders, not one: App drops the marks and the
 * departed rows, and BrowseScreen copies the new list into its own state from
 * an effect. The two trailing settles after the clock jump caught the frame
 * between them — marks gone, the departed row still standing unmarked, which
 * reads as a hold that spent itself and kept the row anyway.
 *
 * So `settle` waits until the tree is quiet instead. An idle-priority task runs
 * only once nothing more urgent is queued on the scheduler, which drains every
 * pending effect; the turn after it lets a render those effects scheduled
 * land. Round again until a round writes no frame. It is the scheduler instance
 * Ink's reconciler resolved, not a copy: there is one in the tree.
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
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const frameWith = async (
  stdout: FakeStdout,
  ok: (frame: string) => boolean,
  what: string,
) => {
  const deadline = performance.now() + 5000
  await settle()
  while (!ok(stdout.lastFrame())) {
    if (performance.now() > deadline)
      throw new Error(`no frame ${what}:\n${stdout.lastFrame()}`)
    await after(10)
    await settle()
  }
}

const pr = (
  number: number,
  title: string,
  health: GHItem["health"],
): GHItem => ({
  kind: "pr",
  number,
  title,
  repo: "kud/some-repo",
  url: `https://github.com/kud/some-repo/pull/${number}`,
  health,
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const SETTLING = "a row whose checks are running"
const STILL = "a row nobody is waiting on"

const mount = (
  sections: Section[],
  rowFetcher: (rows: GHItem[]) => Promise<{
    sections: Section[]
    login: string
  } | null>,
) => {
  const stdout = new FakeStdout(120, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({ sections, login: "kud" })}
      rowFetcher={rowFetcher}
      livePollMs={40}
      liveQuietMs={300}
      title="cockpit"
      detailFor={() => null}
    />,
    {
      stdout: stdout as never,
      stdin: stdin as never,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  )
  return { stdout, stdin, instance }
}

/*
 * kud/gh#183. The poll asks about settling rows only, ticks a verdict where it
 * stands, and holds a change of group until the keyboard rests — so the list
 * never reshuffles between two keypresses, and nothing moves silently.
 */
describe("live rows", () => {
  it("asks only about the rows still settling", async () => {
    const asked: string[][] = []
    const { stdout, instance } = mount(
      [
        {
          id: "open",
          label: "Open",
          items: [pr(1, SETTLING, "pending"), pr(2, STILL, "approved")],
        },
      ],
      async (rows) => {
        asked.push(rows.map((r) => r.title))
        return null
      },
    )
    await frameWith(stdout, (f) => f.includes(SETTLING), "with the board")
    while (asked.length === 0) await after(20)
    expect(asked[0]).toEqual([SETTLING])
    instance.unmount()
  })

  it("ticks a verdict in place, without the r apply gate", async () => {
    const { stdout, instance } = mount(
      [
        {
          id: "open",
          label: "Open",
          items: [pr(1, SETTLING, "pending"), pr(2, STILL, "approved")],
        },
      ],
      async () => ({
        sections: [
          {
            id: "open",
            label: "Open",
            items: [pr(1, SETTLING, "approved"), pr(2, STILL, "approved")],
          },
        ],
        login: "kud",
      }),
    )
    await frameWith(
      stdout,
      (f) => f.includes("updated"),
      "with the row updated",
    )
    const frame = stdout.lastFrame()
    expect(frame).not.toContain("r apply")
    // Not narrated as a move: the row did not go anywhere.
    expect(frame).not.toContain("moved")
    expect(frame.indexOf(SETTLING)).toBeLessThan(frame.indexOf(STILL))
    instance.unmount()
  })

  it("holds a change of group while keys are pressed, then lands it with the transit marks", async () => {
    const theirs: Section = {
      id: "theirs",
      label: "Their move",
      items: [pr(1, SETTLING, "pending"), pr(2, STILL, "waiting")],
    }
    const yours: Section = { id: "yours", label: "Your move", items: [] }
    const { stdout, stdin, instance } = mount([theirs, yours], async () => ({
      sections: [
        { ...theirs, items: [pr(2, STILL, "waiting")] },
        { ...yours, items: [pr(1, SETTLING, "approved")] },
      ],
      login: "kud",
    }))
    await frameWith(stdout, (f) => f.includes(SETTLING), "with the board")
    stdin.press("\u001B[B")
    // Someone working the list: a key every 60ms keeps the regroup held.
    const typing = setInterval(() => stdin.press("\u001B[B"), 60)
    await frameWith(
      stdout,
      (f) => f.includes("updated"),
      "with the verdict ticked in place",
    )
    await after(400)
    expect(stdout.lastFrame()).not.toContain("moved")
    clearInterval(typing)
    await frameWith(
      stdout,
      (f) => f.includes("1 moved"),
      "with the regroup narrated",
    )
    instance.unmount()
  })
})
