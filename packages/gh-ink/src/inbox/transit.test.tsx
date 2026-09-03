import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { EventEmitter } from "node:events"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import React from "react"
import { render } from "ink"
import { glyphs } from "@kud/glyphs"
import { App, TAB_MARK, tabLabel, TRANSIT_HOLD_MS } from "./inbox.js"
import type { GHItem, Section, TaskRow } from "./inbox.js"

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
  press = (key: string) => {
    this.buffer = key
    this.emit("readable")
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/*
 * A spec that waits out a 7s hold in real time is not testing the hold, it is
 * racing React's effect flush against a wall clock — and losing about one run
 * in five, in BOTH directions at once: the same failing run spent a hold that
 * should have stood and stood one that should have spent. Under a release
 * workflow that gates publish on the suite, that is one release in five
 * blocked by a test with nothing to say about the release.
 *
 * So these specs own the clock. Only Date and setTimeout are faked, which is
 * exactly what the hold reads and what it schedules. Ink's render loop and
 * React's effect flush ride on setImmediate and microtasks, and freezing
 * those stops the render rather than controlling it — `settle` stays real for
 * that reason. setInterval stays real too: the spark animation and the CI
 * poll are nobody's business here.
 *
 * Not applied to the stamp-file specs. Those wait on an fs.watch event, which
 * arrives on real time and cannot be advanced — faking the clock there would
 * skip the wait without skipping the wait.
 */
const withFakeClock = () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })
}

// Settle, move the clock, settle again — and the FIRST half is the half that
// is easy to leave out. A hold is stamped by an effect reacting to the arrival,
// so advancing before that effect has run moves the clock past a stamp that
// does not exist yet; the effect then stamps Date.now() on the far side of the
// jump and the hold starts over, which reads exactly like a hold that refuses
// to expire. Flush first, then advance. The trailing settles are for the other
// end: expiring a hold sets state that schedules the render the assertion reads.
const advance = async (ms: number) => {
  await settle()
  await settle()
  await vi.advanceTimersByTimeAsync(ms)
  await settle()
  await settle()
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

const STAYS = "a row that sits still throughout"
const MOVES = "a row whose health changed"
const LEAVES = "a row that was closed elsewhere"
const ARRIVES = "a row that opened elsewhere"

const before: Section[] = [
  {
    id: "open",
    label: "Open",
    items: [
      pr(1, STAYS, "approved"),
      pr(2, MOVES, "approved"),
      pr(3, LEAVES, "waiting"),
    ],
  },
]
const after_: Section[] = [
  {
    id: "open",
    label: "Open",
    items: [
      pr(1, STAYS, "approved"),
      pr(2, MOVES, "ci-fail"),
      pr(4, ARRIVES, "waiting"),
    ],
  },
]

// Real timers, like the merge tests beside this: the hold and the frame ticker
// are both live inside a mounted Ink tree, and faking the clock desynchronises
// them from the render loop — a passing test would prove nothing about what a
// person sees.
const mount = async (watchPath?: string) => {
  const stdout = new FakeStdout(120, 44)
  const stdin = new FakeStdin()
  let call = 0
  const instance = render(
    <App
      fetcher={async () => ({
        sections: call++ === 0 ? before : after_,
        login: "kud",
      })}
      title="cockpit"
      watchPath={watchPath}
      watchDebounceMs={50}
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
  await settle()
  await settle()
  return {
    stdout,
    stdin,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("applying a refresh", () => {
  withFakeClock()

  it("opens quiet — a first paint has nothing to have changed from", async () => {
    const { stdout, stop } = await mount()
    const frame = stdout.lastFrame()
    expect(frame).toContain(STAYS)
    expect(frame).not.toContain("NEW")
    stop()
  })

  it("names what is waiting before you apply it", async () => {
    const { stdout, stdin, stop } = await mount()
    stdin.press("r")
    await settle()
    await settle()
    await advance(50)

    const frame = stdout.lastFrame()
    // Counted, not merely announced: "something changed" is what the old
    // indicator said, and it left the keypress a leap of faith.
    expect(frame).toContain("1 new")
    expect(frame).toContain("1 gone")
    expect(frame).toContain("1 moved")
    expect(frame).toContain("r apply")
    // And it has NOT applied. The whole gate.
    expect(frame).toContain(LEAVES)
    expect(frame).not.toContain(ARRIVES)
    stop()
  })

  it("says what it did to each row, in words", async () => {
    const { stdout, stdin, stop } = await mount()
    stdin.press("r")
    await settle()
    await settle()
    await advance(50)
    stdin.press("r")
    await settle()
    await settle()

    const frame = stdout.lastFrame()
    expect(frame).toContain("NEW")
    expect(frame).toContain("GONE")
    expect(frame).toContain("UPDATED")
    // The departing row is still drawn, and still where it was — a row that
    // left by teleporting to the end reads as an arrival.
    expect(frame.indexOf(LEAVES)).toBeGreaterThan(frame.indexOf(MOVES))
    expect(frame).toContain(ARRIVES)
    stop()
  })

  // In a pill, not in trailing text. The marker sits at the end of the row
  // beside the dim age and author cells, so as plain words it read as one more
  // column of metadata — which is the opposite of a marker that has to survive
  // being noticed. Pinned on the caps rather than on the colour: the frame a
  // test renders carries no colour at all, which is also the reader this has to
  // work for.
  it("draws each marker as a pill, not as trailing text", async () => {
    const { stdout, stdin, stop } = await mount()
    stdin.press("r")
    await settle()
    await settle()
    await advance(50)
    stdin.press("r")
    await settle()
    await settle()

    const frame = stdout.lastFrame()
    for (const marker of ["NEW", "GONE", "UPDATED"])
      expect(frame).toContain(
        `${glyphs.plCapLeft}${marker}${glyphs.plCapRight}`,
      )
    stop()
  })

  it("leaves the row that did not move unmarked", async () => {
    const { stdout, stdin, stop } = await mount()
    stdin.press("r")
    await settle()
    await settle()
    await advance(50)
    stdin.press("r")
    await settle()
    await settle()

    // A marker on every row is a marker on none. `age` drifts on every fetch,
    // so a diff that compared it would flag the whole list each time.
    const line = stdout
      .lastFrame()
      .split("\n")
      .find((l) => l.includes(STAYS))
    expect(line).toBeTruthy()
    expect(line).not.toContain("UPDATED")
    expect(line).not.toContain("NEW")
    stop()
  })

  it("settles once the hold is up", async () => {
    const { stdout, stdin, stop } = await mount()
    stdin.press("r")
    await settle()
    await settle()
    await advance(50)
    stdin.press("r")
    await settle()
    await advance(TRANSIT_HOLD_MS + 500)

    const frame = stdout.lastFrame()
    expect(frame).not.toContain("GONE")
    expect(frame).not.toContain(LEAVES)
    // The guard: without it this passes just as well if the hold blanked the
    // list, which is the failure a bare not.toContain cannot see.
    expect(frame).toContain(ARRIVES)
    expect(frame).toContain(STAYS)
    stop()
  })
})

describe("the stamp file", () => {
  /*
   * The load-bearing one. A signal that repainted on arrival would be a poller
   * with better timing — and would undo the gate the tests above exist to
   * protect. It is allowed to fetch; it is not allowed to draw.
   */
  it("fetches on its own but still waits for r", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gh-ink-transit-"))
    const stamp = join(dir, "cockpit-dirty")
    const { stdout, stop } = await mount(stamp)

    writeFileSync(stamp, "1")
    await after(600)
    await settle()

    const frame = stdout.lastFrame()
    expect(frame).toContain("r apply")
    // Refetched, and still showing the list you were reading.
    expect(frame).toContain(LEAVES)
    expect(frame).not.toContain(ARRIVES)
    expect(frame).not.toContain("NEW")
    stop()
  })

  it("costs nothing when no path is wired", async () => {
    const { stdout, stop } = await mount()
    await after(600)
    expect(stdout.lastFrame()).not.toContain("r apply")
    stop()
  })
})

/*
 * The hold is per tab, and its clock starts when that tab is first opened.
 * Both halves are load-bearing and they pull in opposite directions.
 *
 * Without the per-tab part, a refresh whose only news lived in a tab you were
 * not on spent its hold behind your back — you switched over to a list that had
 * already settled and looked exactly like it did before.
 *
 * Without the wall clock, the hold ran only while you stood on the tab, so
 * reading the news and moving on left the markers waiting for you to come back
 * and watch them expire. Arriving is the whole event; the rest is a timer.
 */
const OTHER_STAYS = "a row in the second tab that sits still"
const OTHER_MOVES = "a row in the second tab whose health changed"

const twoTabsBefore: Section[] = [
  { id: "open", label: "Open", items: [pr(1, STAYS, "approved")] },
  {
    id: "review",
    label: "Review",
    items: [pr(5, OTHER_STAYS, "approved"), pr(6, OTHER_MOVES, "approved")],
  },
]
const twoTabsAfter: Section[] = [
  { id: "open", label: "Open", items: [pr(1, STAYS, "approved")] },
  {
    id: "review",
    label: "Review",
    items: [pr(5, OTHER_STAYS, "approved"), pr(6, OTHER_MOVES, "ci-fail")],
  },
]

// What a keyboard actually sends for → and ←, which is what Ink reads as a tab
// switch.
const RIGHT_ARROW = "\u001B[C"
const LEFT_ARROW = "\u001B[D"

const mountTwoTabs = async () => {
  const stdout = new FakeStdout(120, 44)
  const stdin = new FakeStdin()
  let call = 0
  const instance = render(
    <App
      fetcher={async () => ({
        sections: call++ === 0 ? twoTabsBefore : twoTabsAfter,
        login: "kud",
      })}
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
  await settle()
  await settle()
  // Fetch the second list, then apply it — the same two presses a person makes.
  stdin.press("r")
  await settle()
  await settle()
  await advance(50)
  stdin.press("r")
  await settle()
  await settle()
  return {
    stdout,
    stdin,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("a change in a tab you are not on", () => {
  withFakeClock()

  it("keeps its marker until that tab is displayed", async () => {
    const { stdout, stdin, stop } = await mountTwoTabs()
    await advance(TRANSIT_HOLD_MS + 500)

    // The guard: the row is not merely unmarked here, it is not on screen at
    // all — so a passing assertion has to come from the OTHER tab.
    expect(stdout.lastFrame()).not.toContain(OTHER_MOVES)

    stdin.press(RIGHT_ARROW)
    await settle()
    await settle()

    const frame = stdout.lastFrame()
    expect(frame).toContain(OTHER_MOVES)
    expect(frame).toContain("UPDATED")
    stop()
  })

  it("settles once you have actually looked at it", async () => {
    const { stdout, stdin, stop } = await mountTwoTabs()
    stdin.press(RIGHT_ARROW)
    await settle()
    await advance(TRANSIT_HOLD_MS + 500)

    const frame = stdout.lastFrame()
    expect(frame).not.toContain("UPDATED")
    // Still the tab it settled on, not a blanked list.
    expect(frame).toContain(OTHER_MOVES)
    expect(frame).toContain(OTHER_STAYS)
    stop()
  })

  it("keeps counting after you leave — arriving is the whole event", async () => {
    const { stdout, stdin, stop } = await mountTwoTabs()
    // Over to the news, then straight back. A reader who has seen it has no
    // reason to stand there while a timer runs out on their behalf.
    stdin.press(RIGHT_ARROW)
    await settle()
    await settle()
    stdin.press(LEFT_ARROW)
    await settle()
    await settle()
    await advance(TRANSIT_HOLD_MS + 500)

    stdin.press(RIGHT_ARROW)
    await settle()
    await settle()

    const frame = stdout.lastFrame()
    expect(frame).not.toContain("UPDATED")
    // The row is still there — settled, not blanked. Same guard as above.
    expect(frame).toContain(OTHER_MOVES)
    stop()
  })
})

describe("the tab marker", () => {
  withFakeClock()

  // The row markers are the signal; this is the pointer to them. A tab you are
  // not on draws none of its rows, so without a marker on the tab itself the
  // hold keeps its promise to a screen nobody is looking at.
  const tabBar = (frame: string): string =>
    frame
      .split("\n")
      .find((line) => line.includes("Open") && line.includes("Review")) ?? ""

  it("sits on the tab holding news, and nowhere else", async () => {
    const { stdout, stop } = await mountTwoTabs()
    await advance(TRANSIT_HOLD_MS + 500)

    const bar = tabBar(stdout.lastFrame())
    expect(bar).toBeTruthy()
    expect(bar).toContain(`${TAB_MARK} Review`)
    // Not on the tab you are already reading, which has nothing to report.
    expect(bar).not.toContain(`${TAB_MARK} Open`)
    stop()
  })

  it("goes once that tab has been read", async () => {
    const { stdout, stdin, stop } = await mountTwoTabs()
    stdin.press(RIGHT_ARROW)
    await settle()
    await advance(TRANSIT_HOLD_MS + 500)

    const bar = tabBar(stdout.lastFrame())
    expect(bar).toBeTruthy()
    expect(bar).not.toContain(TAB_MARK)
    stop()
  })

  it("reserves its cell on every tab while any tab wears one", () => {
    const marked = new Set(["review"])
    expect(tabLabel("Review", marked, "review")).toBe(`${TAB_MARK} Review`)
    // Same indent on the unmarked tab, so the bar does not shift sideways
    // every time one of them settles.
    expect(tabLabel("Open", marked, "open")).toBe("  Open")
    // And no dead indent at all on a bar with nothing to report.
    expect(tabLabel("Open", new Set(), "open")).toBe("Open")
  })
})

/*
 * The same vocabulary on a task row.
 *
 * `ItemRow`'s task branch returned before ever reaching the transient
 * rendering, so a surface built entirely from task rows — `life`, which is
 * Todoist and Notion — applied a refresh in total silence: the list changed
 * and nothing on screen admitted it. These pin the words, since the glyph
 * animates and the words are what a person actually reads.
 */

const task = (key: string, summary: string, status: string): TaskRow => ({
  kind: "task",
  key,
  summary,
  url: `https://app.todoist.com/app/task/${encodeURIComponent(summary)}`,
  status,
  age: "",
  indent: false,
})

const T_STAYS = "a chore that sits still throughout"
const T_MOVES = "a chore whose priority changed"
const T_LEAVES = "a chore ticked off elsewhere"
const T_ARRIVES = "a chore added elsewhere"

const mountTasks = async () => {
  const stdout = new FakeStdout(120, 44)
  const stdin = new FakeStdin()
  let call = 0
  const instance = render(
    <App
      fetcher={async () => ({
        sections: [
          {
            id: "today",
            label: "Today",
            items:
              call++ === 0
                ? [
                    task("Flat", T_STAYS, "p2"),
                    task("Flat", T_MOVES, "p3"),
                    task("Flat", T_LEAVES, "p4"),
                  ]
                : [
                    task("Flat", T_STAYS, "p2"),
                    task("Flat", T_MOVES, "p1"),
                    task("Flat", T_ARRIVES, "p2"),
                  ],
          },
        ],
        login: "kud",
      })}
      title="life"
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
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("applying a refresh on task rows", () => {
  withFakeClock()

  it("says what it did to each row, in words", async () => {
    const { stdout, stdin, stop } = await mountTasks()
    stdin.press("r")
    await settle()
    await settle()
    await advance(50)
    stdin.press("r")
    await settle()
    await settle()

    const frame = stdout.lastFrame()
    expect(frame).toContain("NEW")
    expect(frame).toContain("GONE")
    expect(frame).toContain("UPDATED")
    expect(frame).toContain(T_ARRIVES)
    stop()
  })

  it("leaves the row that did not move unmarked", async () => {
    const { stdout, stdin, stop } = await mountTasks()
    stdin.press("r")
    await settle()
    await settle()
    await advance(50)
    stdin.press("r")
    await settle()
    await settle()

    const line = stdout
      .lastFrame()
      .split("\n")
      .find((l) => l.includes(T_STAYS))
    expect(line).toBeTruthy()
    expect(line).not.toContain("UPDATED")
    expect(line).not.toContain("NEW")
    stop()
  })
})
