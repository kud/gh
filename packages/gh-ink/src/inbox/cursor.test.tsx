import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, rowKey } from "./inbox.js"
import type { AnyItem, GHItem, Section } from "./inbox.js"

/*
 * WHERE THE CURSOR IS AFTER A REFRESH.
 *
 * The refresh gate means the list never reshuffles under you — it waits for `r`.
 * That guarantee was only half kept: applying reshaped the list while the cursor
 * was held as an INDEX, so `r` silently landed you on whatever had moved into
 * that slot. Worse than not restoring at all, because nothing on screen says you
 * were moved and the next keypress acts on the wrong row.
 *
 * The second bug was narrower and fired every single time. A repo header is
 * selectable on purpose — `↵` opens the repo, `C` copies the group, and the
 * footer advertises both — but the reconciliation stepped the cursor off any
 * header it landed on, a rule written when headers could not be selected. So
 * standing on a repo and pressing `r` moved you onto an issue, always.
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
const ESC = String.fromCharCode(27)
const DOWN = ESC + "[B"
const UP = ESC + "[A"

const pr = (n: number, title: string): GHItem => ({
  kind: "pr",
  number: n,
  title,
  repo: "acme/api",
  url: `https://github.com/acme/api/pull/${n}`,
  health: "none",
  age: "2d",
  ts: n,
  unresolved: 0,
  conversation: 0,
})

const header = (repo: string): AnyItem =>
  ({ kind: "repo-header", repo, age: "" }) as AnyItem

const sectionOf = (items: AnyItem[]): Section[] => [
  { id: "open", label: "Open", items },
]

// The row the cursor is on wears `❯`. Read back off the frame rather than off
// state, because what is pinned here is what the reader can actually see.
const cursorLine = (frame: string) =>
  frame.split("\n").find((l) => l.includes("❯")) ?? ""

const mount = async (before: Section[], after: Section[]) => {
  const stdout = new FakeStdout(120, 40)
  const stdin = new FakeStdin()
  let call = 0
  const instance = render(
    <App
      fetcher={async () => ({
        sections: call++ === 0 ? before : after,
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
  const press = async (k: string) => {
    stdin.press(k)
    await settle()
    await settle()
    await new Promise((r) => setTimeout(r, 40))
    await settle()
  }
  return {
    frame: () => stdout.lastFrame(),
    press,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("rowKey", () => {
  it("identifies a row by what it IS, not where it sits", () => {
    const a = pr(7, "a title")
    // Same row, different position in a reshaped list, and a title that changed
    // under it — still the same row.
    expect(rowKey({ ...a, title: "retitled" })).toBe(rowKey(a))
  })

  it("keeps two rows apart", () => {
    expect(rowKey(pr(7, "x"))).not.toBe(rowKey(pr(8, "x")))
  })

  it("gives a repo header an identity of its own", () => {
    expect(rowKey(header("acme/api"))).toBe("header:acme/api")
    expect(rowKey(header("acme/api"))).not.toBe(rowKey(pr(1, "x")))
  })
})

describe("the cursor across an applied refresh", () => {
  it("stays on the row it was on when rows arrive above it", async () => {
    const target = pr(2, "the row being watched")
    const before = sectionOf([pr(1, "first"), target])
    // Two rows land above it, so its index moves from 1 to 3.
    const after = sectionOf([
      pr(8, "new one"),
      pr(9, "new two"),
      pr(1, "first"),
      target,
    ])

    const { frame, press, stop } = await mount(before, after)
    await press(DOWN)
    expect(cursorLine(frame())).toContain("the row being watched")

    await press("r") // fetch, held at the gate
    await press("r") // apply
    expect(cursorLine(frame())).toContain("the row being watched")
    stop()
  })

  /*
   * The reported bug, and it fired every time rather than sometimes: the
   * reconciliation stepped off any header the cursor landed on.
   */
  it("stays on a repo header instead of stepping onto an issue", async () => {
    const items = [header("acme/api"), pr(1, "an issue under it")]
    // Deliberately unchanged, so nothing but the reconciliation can move it.
    const { frame, press, stop } = await mount(
      sectionOf(items),
      sectionOf(items),
    )

    // The cursor OPENS on the first non-header row — a header is somewhere you
    // can go, not somewhere you get put — so this walks up onto it first.
    await press(UP)
    expect(cursorLine(frame())).toContain("acme/api")

    await press("r")
    await press("r")
    expect(cursorLine(frame())).toContain("acme/api")
    expect(cursorLine(frame())).not.toContain("an issue under it")
    stop()
  })

  /*
   * A row you were standing on that the refresh removed does NOT vanish under
   * the cursor — it keeps its place for the length of its farewell, wearing the
   * departure mark, and the cursor stays with it.
   *
   * Worth pinning as a property rather than an accident, because it is the case
   * that would otherwise justify a jump: "the row is gone, where do we put
   * them?" never has to be answered while the row is still on screen.
   */
  it("stays with a row that is leaving, for as long as it is drawn", async () => {
    const before = sectionOf([pr(1, "first"), pr(2, "about to vanish")])
    const after = sectionOf([pr(1, "first"), pr(3, "took its place")])

    const { frame, press, stop } = await mount(before, after)
    await press(DOWN)
    expect(cursorLine(frame())).toContain("about to vanish")

    await press("r")
    await press("r")
    expect(cursorLine(frame())).toContain("about to vanish")
    stop()
  })
})
