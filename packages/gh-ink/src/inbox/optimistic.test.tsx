import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, FAILURE_NOTICE_MS } from "./inbox.js"
import type {
  JiraAvailableTransition,
  Section,
  TabForStatus,
  TaskRow,
} from "./inbox.js"
import { OVERRIDE_HOLD_MS } from "./overrides.js"

/*
 * A move is taken optimistically: the row goes to its new tab the moment it is
 * chosen, wearing `◌` until Jira answers, and the patch is laid over every fetch
 * until one agrees with it. These pin that end to end, through a mounted inbox,
 * because each half of the promise lives in a different place — the patch in
 * App, the marker in the row, the failure line in the footer, `w` in the keys —
 * and a unit test of any one of them passes while the screen lies.
 */

// Every `jira issue move` parks here until the spec answers it, so a spec can
// look at the screen while the request is still in flight.
const requests = vi.hoisted(
  () =>
    [] as Array<{
      cmd: string
      resolve: () => void
      reject: (e: Error) => void
    }>,
)

vi.mock("zx", () => {
  const run = (pieces: TemplateStringsArray, ...values: unknown[]) => {
    const cmd = String.raw({ raw: pieces }, ...values)
    if (!cmd.startsWith("jira issue move"))
      return Promise.resolve({ stdout: "", stderr: "" })
    return new Promise((resolve, reject) =>
      requests.push({
        cmd,
        resolve: () => resolve({ stdout: "", stderr: "" }),
        reject,
      }),
    )
  }
  const $ = (...args: unknown[]) =>
    args.length === 1 && typeof args[0] === "object" && !Array.isArray(args[0])
      ? run
      : run(args[0] as TemplateStringsArray, ...args.slice(1))
  return { $ }
})

class FakeStdout extends EventEmitter {
  frames: string[] = []
  columns = 120
  rows = 44
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
  press = (key: string) => {
    this.buffer = key
    this.emit("readable")
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))
const flush = async () => {
  for (let i = 0; i < 4; i++) await settle()
}
// Same shape as transit.test's: flush first so effects have stamped, then move
// the clock, then flush again for the renders the expiry scheduled.
const advance = async (ms: number) => {
  await flush()
  await vi.advanceTimersByTimeAsync(ms)
  await flush()
}

const ticket = (key: string, status: string): TaskRow => ({
  kind: "task",
  key,
  ticket: key,
  summary: `${key} summary`,
  url: `https://acme.example/browse/${key}`,
  status,
  age: "2d",
})

const MOVING = "SHOP-1234"
const STAYING = "SHOP-1235"
const OTHER = "SHOP-1236"

const before: Section[] = [
  {
    id: "todo",
    label: "To do",
    items: [ticket(MOVING, "To Do"), ticket(STAYING, "To Do")],
  },
  { id: "review", label: "Review", items: [ticket(OTHER, "In Review")] },
]
const moved: Section[] = [
  { id: "todo", label: "To do", items: [ticket(STAYING, "To Do")] },
  {
    id: "review",
    label: "Review",
    items: [ticket(OTHER, "In Review"), ticket(MOVING, "In Review")],
  },
]

const transitions: JiraAvailableTransition[] = [
  { id: "31", name: "Send to review", to: { name: "In Review" } },
]
const tabForStatus: TabForStatus = (to) =>
  to.name === "In Review" ? "review" : to.name === "To Do" ? "todo" : null

const mount = async (opts: {
  answers: Section[][]
  tabForStatus?: TabForStatus
}) => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  let fetches = 0
  const instance = render(
    <App
      fetcher={async () => {
        const sections =
          opts.answers[Math.min(fetches, opts.answers.length - 1)]!
        fetches += 1
        return { sections, login: "kud" }
      }}
      title="board"
      jiraBase="https://acme.example"
      jiraTransitionsFor={async () => transitions}
      tabForStatus={opts.tabForStatus}
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
  await flush()
  const press = async (key: string) => {
    stdin.press(key)
    await flush()
  }
  return {
    stdout,
    press,
    fetches: () => fetches,
    // `t` on the row under the cursor, then ↵ on its only transition.
    moveRow: async () => {
      await press("t")
      await press("\r")
    },
    // The tab strip, the one line that carries both tab labels.
    tabs: () =>
      stdout
        .lastFrame()
        .split("\n")
        .find((l) => l.includes("To do") && l.includes("Review")) ?? "",
    lineOf: (key: string) =>
      stdout
        .lastFrame()
        .split("\n")
        .find((l) => l.includes(key)) ?? "",
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("an optimistic ticket move", () => {
  beforeEach(() => {
    requests.length = 0
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("leaves the tab at once, and its pills say so", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    expect(t.tabs()).toMatch(/To do\D*2/)
    expect(t.tabs()).toMatch(/Review\D*1/)
    await t.moveRow()

    expect(requests.map((r) => r.cmd)).toEqual([
      `jira issue move ${MOVING} Send to review`,
    ])
    // Arrived in Review before anything has answered: the target pill counts it.
    expect(t.tabs()).toMatch(/Review\D*2/)
    // The tab it left still draws it on its way out, as any departure does,
    // but its pill drops now: the count is about what you just did, not about
    // the farewell. It used to wait out the transit hold, seven seconds of a
    // number that disagreed with the keypress.
    expect(t.tabs()).toMatch(/To do\D*1/)
    expect(t.lineOf(MOVING)).not.toBe("")
    await advance(8000)
    expect(t.tabs()).toMatch(/To do\D*1/)
    expect(t.lineOf(MOVING)).toBe("")
    t.stop()
  })

  it("marks the row ◌ until Jira answers", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    await t.moveRow()
    await t.press("\u001B[C") // → to Review
    expect(t.lineOf(MOVING)).toContain("◌")
    requests[0]!.resolve()
    await flush()
    expect(t.lineOf(MOVING)).not.toContain("◌")
    t.stop()
  })

  it("is not optimistic without tabForStatus", async () => {
    const t = await mount({ answers: [before] })
    await t.moveRow()
    expect(t.tabs()).toMatch(/Review\D*1/)
    expect(t.lineOf(MOVING)).not.toContain("◌")
    t.stop()
  })

  it("holds against a stale refetch, and clears on one that agrees", async () => {
    // First paint, then a fetch that predates the move, then the truth.
    const t = await mount({
      answers: [before, before, moved, before],
      tabForStatus,
    })
    await t.moveRow()
    requests[0]!.resolve()
    // The move's own refresh, 1.5s later: Jira's index has not caught up.
    await advance(1600)
    expect(t.fetches()).toBe(2)
    // Still drawn in Review, and nothing waiting behind `r` to undo it.
    await t.press("\u001B[C")
    expect(t.lineOf(MOVING)).not.toBe("")
    expect(t.stdout.lastFrame()).not.toContain("r apply")

    // The agreeing fetch: nothing to apply, the patch is spent.
    await t.press("r")
    expect(t.fetches()).toBe(3)
    expect(t.stdout.lastFrame()).not.toContain("r apply")

    // Proof it is spent: a stale answer now is believed, behind `r` as usual.
    await t.press("r")
    expect(t.fetches()).toBe(4)
    expect(t.stdout.lastFrame()).toContain("r apply")
    t.stop()
  })

  it("believes a stale fetch once the hold is up", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    await t.moveRow()
    requests[0]!.resolve()
    await advance(OVERRIDE_HOLD_MS + 1000)
    await t.press("r")
    expect(t.stdout.lastFrame()).toContain("r apply")
    t.stop()
  })

  it("keeps a failed row where it was put, says why, and w restores it", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    await t.moveRow()
    requests[0]!.reject(new Error("transition not permitted"))
    await flush()

    const frame = t.stdout.lastFrame()
    expect(frame).toContain(
      `✗ Couldn't move ${MOVING}: transition not permitted  w restore`,
    )
    expect(t.tabs()).toMatch(/Review\D*2/)
    const fetched = t.fetches()

    await t.press("w")
    // Restore refetches rather than replaying anything it remembered.
    expect(t.fetches()).toBe(fetched + 1)
    expect(t.stdout.lastFrame()).not.toContain("Couldn't move")
    // Back in To do, which the cursor never left, and arriving there: the
    // filled end of the "in" ramp rather than the empty `◌`.
    expect(t.lineOf(MOVING)).not.toBe("")
    expect(t.lineOf(MOVING)).not.toContain("\u25CC")
    // Review lets go of it the way any tab lets go of a departure.
    // Its hold starts when someone looks at it, as every tab's does.
    await t.press("\u001B[C")
    await advance(8000)
    expect(t.tabs()).toMatch(/Review\D*1/)
    t.stop()
  })

  it("keeps several failures to one line and restores the newest first", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    await t.moveRow()
    requests[0]!.reject(new Error("first refusal"))
    await flush()
    // The departing row still stands at the top of To do, so step past it.
    await t.press("\u001B[B")
    await t.moveRow()
    requests[1]!.reject(new Error("second refusal"))
    await flush()

    expect(t.stdout.lastFrame()).toContain(
      `✗ Couldn't move ${STAYING}: second refusal  +1 more  w restore`,
    )
    await t.press("w")
    expect(t.stdout.lastFrame()).toContain(
      `✗ Couldn't move ${MOVING}: first refusal  w restore`,
    )
    t.stop()
  })

  it("steps the line aside after a while, and the row still waits for w", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    await t.moveRow()
    requests[0]!.reject(new Error("transition not permitted"))
    await advance(FAILURE_NOTICE_MS + 100)
    expect(t.stdout.lastFrame()).not.toContain("Couldn't move")
    expect(t.tabs()).toMatch(/Review\D*2/)
    await t.press("w")
    // Its hold starts when someone looks at it, as every tab's does.
    await t.press("\u001B[C")
    await advance(8000)
    expect(t.tabs()).toMatch(/Review\D*1/)
    t.stop()
  })

  it("lets esc dismiss the line without restoring anything", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    await t.moveRow()
    requests[0]!.reject(new Error("transition not permitted"))
    await flush()
    const fetched = t.fetches()
    await t.press("\u001B")
    await advance(50)
    expect(t.stdout.lastFrame()).not.toContain("Couldn't move")
    expect(t.fetches()).toBe(fetched)
    expect(t.tabs()).toMatch(/Review\D*2/)
    t.stop()
  })

  // `w` is bound only while a failed patch exists, so it costs nothing — and
  // takes nothing from an extension that claims it — the rest of the time.
  it("leaves w alone when nothing has failed", async () => {
    const t = await mount({ answers: [before], tabForStatus })
    const fetched = t.fetches()
    await t.press("w")
    expect(t.fetches()).toBe(fetched)
    t.stop()
  })
})
