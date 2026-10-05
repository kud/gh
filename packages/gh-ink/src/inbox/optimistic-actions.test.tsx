import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, LEAVING_HOLD_MS, countedSections, workCount } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"

/*
 * Every row action but merge goes through the patch layer the Jira move
 * introduced: the row leaves on the keypress wearing `◌`, the patch outvotes
 * any fetch until one agrees, a refusal keeps the row where the action put it
 * with the failure line, and `w` asks the server where it really is.
 *
 * One `describe` per action, each pinning the same four beats, because the
 * actions reach the layer by different doors — a confirm submenu for the two
 * closes, a bare key for dropping your review request — and a door that
 * bypassed the layer would pass every test written against another one.
 */

// Every mutation parks here until the spec answers it.
const requests = vi.hoisted(
  () =>
    [] as Array<{
      cmd: string
      resolve: () => void
      reject: (e: Error) => void
    }>,
)

const PARKED = ["gh pr close", "gh issue close", "gh pr edit"]

vi.mock("zx", () => {
  const run = (pieces: TemplateStringsArray, ...values: unknown[]) => {
    const cmd = String.raw({ raw: pieces }, ...values)
    if (!PARKED.some((p) => cmd.startsWith(p)))
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
  // The last frame with anything in it: Ink answers a no-op update with an
  // empty write rather than a repeated frame.
  lastFrame = () => this.frames.findLast((f) => f.trim().length > 0) ?? ""
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
const advance = async (ms: number) => {
  await flush()
  await vi.advanceTimersByTimeAsync(ms)
  await flush()
}

const row = (
  kind: "pr" | "issue",
  number: number,
  title: string,
  extra: Partial<GHItem> = {},
): GHItem => ({
  kind,
  number,
  title,
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/${
    kind === "pr" ? "pull" : "issues"
  }/${number}`,
  health: "none",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
  ...extra,
})

const DOWN = "\u001B[B"
const UP = "\u001B[A"

type Case = {
  name: string
  verb: string
  /** The row the action is taken on, first in its tab so the cursor starts there. */
  target: GHItem
  /** What sends the request, with the cursor on `target`. */
  act: (press: (key: string) => Promise<void>) => Promise<void>
  command: string
}

// The last row of a PR or issue menu is its close group, and a confirm
// submenu opens with the cursor on Cancel, one row below the verb.
const confirmLast = async (press: (key: string) => Promise<void>) => {
  await press("m")
  for (let i = 0; i < 30; i++) await press(DOWN)
  await press("\r")
  await press(UP)
  await press("\r")
}

const CASES: Case[] = [
  {
    name: "closing a PR",
    verb: "close",
    target: row("pr", 412, "acme pr being closed"),
    act: confirmLast,
    command: "gh pr close 412 --repo acme/api-gateway",
  },
  {
    name: "closing an issue",
    verb: "close",
    target: row("issue", 413, "acme issue being closed"),
    act: confirmLast,
    command: "gh issue close 413 --repo acme/api-gateway",
  },
  {
    name: "removing yourself as reviewer",
    verb: "remove you from",
    target: row("pr", 414, "acme review request dropped", {
      standing: "queued",
    } as Partial<GHItem>),
    act: (press) => press("x"),
    command: "gh pr edit 414 --repo acme/api-gateway --remove-reviewer kud",
  },
]

const BYSTANDER = row("issue", 398, "acme bystander stays put")
const ELSEWHERE = row("issue", 399, "acme other tab row")

const boardWith = (target: GHItem | null): Section[] => [
  {
    id: "mine",
    label: "Mine",
    items: target ? [target, BYSTANDER] : [BYSTANDER],
  },
  { id: "theirs", label: "Theirs", items: [ELSEWHERE] },
]

const mount = async (answers: Section[][]) => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  let fetches = 0
  const instance = render(
    <App
      fetcher={async () => {
        const sections = answers[Math.min(fetches, answers.length - 1)]!
        fetches += 1
        return { sections, login: "kud" }
      }}
      title="board"
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
    tabs: () =>
      stdout
        .lastFrame()
        .split("\n")
        .find((l) => l.includes("Mine") && l.includes("Theirs")) ?? "",
    lineOf: (text: string) =>
      stdout
        .lastFrame()
        .split("\n")
        .find((l) => l.includes(text)) ?? "",
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe.each(CASES)("$name", ({ verb, target, act, command }) => {
  beforeEach(() => {
    requests.length = 0
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("takes the row off at once, ◌ while the request is out, and drops its pill", async () => {
    const t = await mount([boardWith(target)])
    expect(t.tabs()).toMatch(/Mine\D*2/)
    await act(t.press)

    expect(requests.map((r) => r.cmd)).toEqual([command])
    // Still standing for its farewell, and saying the server has not answered.
    expect(t.lineOf(target.title)).toContain("◌")
    // The tab it left stops counting it now, not when the farewell ends.
    expect(t.tabs()).toMatch(/Mine\D*1/)

    requests[0]!.resolve()
    await flush()
    expect(t.lineOf(target.title)).not.toContain("◌")
    await advance(LEAVING_HOLD_MS + 100)
    expect(t.lineOf(target.title)).toBe("")
    expect(t.lineOf(BYSTANDER.title)).not.toBe("")
    t.stop()
  })

  it("holds against a stale refetch, and clears on one that agrees", async () => {
    // First paint, the action's own refresh (stale), the truth, then stale
    // again — which only shows behind `r` once the patch is spent.
    const t = await mount([
      boardWith(target),
      boardWith(target),
      boardWith(null),
      boardWith(target),
    ])
    await act(t.press)
    requests[0]!.resolve()
    await advance(1600)
    expect(t.fetches()).toBe(2)
    await advance(LEAVING_HOLD_MS)
    expect(t.lineOf(target.title)).toBe("")
    expect(t.stdout.lastFrame()).not.toContain("r apply")

    await t.press("r")
    expect(t.fetches()).toBe(3)
    expect(t.stdout.lastFrame()).not.toContain("r apply")

    await t.press("r")
    expect(t.fetches()).toBe(4)
    expect(t.stdout.lastFrame()).toContain("r apply")
    t.stop()
  })

  it("keeps a refused row off the board, says why, and w restores it", async () => {
    const t = await mount([boardWith(target)])
    await act(t.press)
    requests[0]!.reject(new Error("acme says no"))
    await flush()

    expect(t.stdout.lastFrame()).toContain(
      `✗ Couldn't ${verb} #${target.number}: acme says no  w restore`,
    )
    await advance(LEAVING_HOLD_MS + 100)
    expect(t.lineOf(target.title)).toBe("")
    expect(t.tabs()).toMatch(/Mine\D*1/)
    const fetched = t.fetches()

    await t.press("w")
    // Restore asks the server rather than replaying the list it remembered.
    expect(t.fetches()).toBe(fetched + 1)
    expect(t.stdout.lastFrame()).not.toContain("Couldn't")
    expect(t.lineOf(target.title)).not.toBe("")
    expect(t.lineOf(target.title)).not.toContain("◌")
    expect(t.tabs()).toMatch(/Mine\D*2/)
    t.stop()
  })
})

describe("the ◌ on a PR row", () => {
  beforeEach(() => {
    requests.length = 0
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("takes the health cell and gives it back when GitHub answers", async () => {
    const pr = row("pr", 420, "acme pr with health", { health: "approved" })
    const t = await mount([boardWith(pr)])
    const healthy = t.lineOf(pr.title)
    expect(healthy).toContain("✓")
    expect(healthy).not.toContain("◌")
    await confirmLast(t.press)
    // One cell, one occupant: the title does not move to make room for it.
    const pending = t.lineOf(pr.title)
    expect(pending).toContain("◌")
    expect(pending.indexOf(pr.title)).toBe(healthy.indexOf(pr.title))
    requests[0]!.resolve()
    await flush()
    expect(t.lineOf(pr.title)).not.toContain("◌")
    t.stop()
  })
})

describe("countedSections", () => {
  const a = row("pr", 1, "a")
  const b = row("pr", 2, "b")
  const c = row("issue", 3, "c")
  const sections: Section[] = [
    { id: "left", label: "Left", items: [a, b] },
    { id: "right", label: "Right", items: [c, a] },
  ]
  const counts = (out: Section[]) => out.map(workCount)

  it("counts everything when nothing has left", () => {
    expect(counts(countedSections(sections))).toEqual([2, 2])
    expect(countedSections(sections, new Map())).toBe(sections)
  })

  it("stops counting a removed row everywhere", () => {
    expect(counts(countedSections(sections, new Map([[a.url, null]])))).toEqual(
      [1, 1],
    )
  })

  it("counts a moved row only where it went", () => {
    expect(
      counts(countedSections(sections, new Map([[a.url, "right"]]))),
    ).toEqual([1, 2])
  })

  it("keeps counting a row moved to a tab the host did not send", () => {
    expect(
      counts(countedSections(sections, new Map([[b.url, "nowhere"]]))),
    ).toEqual([2, 2])
  })
})
