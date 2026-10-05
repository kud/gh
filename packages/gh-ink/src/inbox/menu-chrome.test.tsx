import { describe, expect, it, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import React, { useEffect } from "react"
import { render } from "ink"
import { setIconMode } from "@kud/ink-ui"
import {
  ActionMenu,
  buildActions,
  isMenuGap,
  menuRowsOf,
  menuTone,
  useActionMenu,
} from "./inbox.js"
import type { Action, GHItem } from "./inbox.js"
import type { InboxExtension } from "./extension.js"

// The redesigned action menu: nerd-font icon column, error tone confined to
// the close rows, blank rows the cursor steps over, a confirm sub-menu that
// starts on Cancel, and a width fixed from the longest row.

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

const pr: GHItem = {
  kind: "pr",
  number: 42,
  title: "a row with a title long enough to matter",
  repo: "acme/widget-store",
  url: "https://github.com/acme/widget-store/pull/42",
  health: "none",
  standing: "queued",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
  branch: "fix/a-row",
}

const extensions: InboxExtension[] = [
  {
    id: "submit",
    title: "Resubmit",
    key: "S",
    hint: "submit",
    scope: "item",
    menuGroup: "act",
    body: () => null,
  },
]

const prActions = (): Action[] =>
  buildActions(
    pr,
    "kud",
    () => {},
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    () => true,
    {
      extensions,
      onOpenExt: () => {},
    },
  )

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (line: string) => line.replace(ANSI, "")

const settle = () => new Promise((resolve) => setImmediate(resolve))

// `setIconMode` is a process-global singleton: every nerd-mode test hands it
// back, or the text-mode assertions in the next file over start failing.
afterEach(() => setIconMode("text"))

const isNerdGlyph = (c: string) => {
  const cp = c.codePointAt(0) ?? 0
  return cp >= 0xe000 && cp <= 0xf8ff
}

// A live menu, driven by direct `handleKey` calls rather than stdin bytes:
// faking arrow keys through Ink's parser drops about one press in thirteen
// (its 20ms pending-escape flush races the next press), which is Ink's timing
// to own, not this menu's logic. What is pinned here is what the menu does
// with the keys once they arrive — the delivery path is covered by the
// app-level specs that press real letters.
const mountMenu = async (actions: Action[]) => {
  const stdout = new FakeStdout(120, 30)
  const stdin = new FakeStdin()
  const probe: {
    key?: (key: {
      upArrow?: boolean
      downArrow?: boolean
      return?: boolean
      escape?: boolean
    }) => boolean
    state?: () => { cursor: number; rows: number }
  } = {}
  const Host = () => {
    const menu = useActionMenu()
    const ref = React.useRef(menu)
    ref.current = menu
    useEffect(() => {
      ref.current.open(actions)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    probe.key = (key) => ref.current.handleKey(key)
    probe.state = () => ({
      cursor: ref.current.cursor,
      rows: ref.current.actions?.length ?? -1,
    })
    if (!menu.actions) return null
    return <ActionMenu item={pr} actions={menu.actions} cursor={menu.cursor} />
  }
  const instance = render(<Host />, {
    stdout: stdout as never,
    stdin: stdin as never,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  })
  await settle()
  await settle()
  const press = async (key: {
    upArrow?: boolean
    downArrow?: boolean
    return?: boolean
    escape?: boolean
  }) => {
    probe.key!(key)
    await settle()
    await settle()
  }
  return {
    press,
    down: () => press({ downArrow: true }),
    up: () => press({ upArrow: true }),
    state: () => probe.state!(),
    lines: () => stripAnsi(stdout.lastFrame()).split("\n"),
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

// The menu's own border, not the inbox frame's: the LAST `╭` on screen.
const menuTop = (lines: string[]) => lines.findLastIndex((l) => l.includes("╭"))
const cursorLine = (lines: string[]) =>
  lines.find((l) => l.includes("❯")) ?? ""

describe("menu icons", () => {
  // The cursor starts on the first row, never on "Open in browser", so both
  // assertions read that row's own line: what stands between the row's start
  // and its label — a glyph, or nothing but air.
  const browserLine = (lines: string[]) =>
    lines.find((l) => l.includes("Open in browser")) ?? ""

  it("shows the glyph column in nerd mode", async () => {
    setIconMode("nerd")
    const t = await mountMenu(prActions())
    const lines = t.lines()
    t.done()

    expect([...lines.join("\n")].some(isNerdGlyph)).toBe(true)
    expect([...browserLine(lines)].some(isNerdGlyph)).toBe(true)
  })

  it("drops the icon column completely in text mode", async () => {
    const t = await mountMenu(prActions())
    const lines = t.lines()
    t.done()

    expect([...lines.join("\n")].some(isNerdGlyph)).toBe(false)
    const prefix = browserLine(lines).split("Open in browser")[0] ?? ""
    expect(prefix.replace("│", "").trim()).toBe("")
  })
})

describe("menu tone", () => {
  it("confines the error tone to the close rows, never Cancel", () => {
    const errored = prActions()
      .flatMap((a) => [a, ...(a.subActions ?? [])])
      .filter((a) => menuTone(a) === "error")
      .map((a) => a.label)
      .sort()
    expect(errored).toEqual(
      ["Close #42", "Close #42 and delete fix/a-row", "Close PR", "Close PR and delete branch"].sort(),
    )
  })

  it("leaves everything else untoned, Cancel included", () => {
    const errored = new Set([
      "Close PR",
      "Close PR and delete branch",
      "Close #42",
      "Close #42 and delete fix/a-row",
    ])
    const plain = prActions().flatMap((a) => [a, ...(a.subActions ?? [])])
    // Cancel is the assertion that matters here: it shares the confirm group
    // and must still come back untoned.
    expect(plain.some((a) => a.label === "Cancel")).toBe(true)
    for (const action of plain)
      if (!errored.has(action.label))
        expect(menuTone(action), action.label).toBeUndefined()
  })
})

describe("menu cursor and width", () => {
  it("steps over the blank rows between groups", async () => {
    const t = await mountMenu(prActions())
    // Act has one row (Submit); one ↓ must clear the blank and land on Open.
    await t.down()
    const line = cursorLine(t.lines())
    t.done()

    expect(t.state().cursor).toBe(2)
    expect(line).toContain("Open PR")
    expect(line.trim()).not.toBe("")
  })

  it("starts a close confirm on Cancel", async () => {
    const t = await mountMenu(prActions())
    // Eleven downs to Close PR: 0 Submit, then 2 Open PR, 3 browser, 5 s, 6 j,
    // 7 p, 9 c, 10 r, 11 b, 13 u, 14 x, 16 Close PR — every blank stepped over.
    for (let i = 0; i < 11; i += 1) await t.down()
    expect(t.state().cursor).toBe(16)
    expect(cursorLine(t.lines())).toContain("Close PR")
    await t.press({ return: true })
    const lines = t.lines()
    t.done()

    expect(lines.some((l) => l.includes("Close #42?"))).toBe(true)
    expect(cursorLine(lines)).toContain("Cancel")
  })

  it("holds the same width as the cursor moves", async () => {
    const t = await mountMenu(prActions())
    const atTop = t.lines()[menuTop(t.lines())]!.length
    // Down to the bottom row and back up: every one of these is a real cursor
    // move, so every frame is a real render — never a no-op update, which Ink
    // answers with an empty write rather than a repeated frame.
    for (let i = 0; i < 12; i += 1) await t.down()
    expect(t.state().cursor).toBe(17)
    const atBottom = t.lines()[menuTop(t.lines())]!.length
    await t.up()
    const after = t.lines()[menuTop(t.lines())]!.length
    t.done()

    expect(atTop).toBe(atBottom)
    expect(atBottom).toBe(after)
  })

  // Stepping off either end used to index past the rows and throw inside the
  // state updater, taking the whole inbox down with it.
  it("holds at both ends rather than stepping off them", async () => {
    const t = await mountMenu(prActions())
    await t.up()
    expect(t.state().cursor).toBe(0)
    for (let i = 0; i < 30; i += 1) await t.down()
    expect(t.state().cursor).toBe(17)
    expect(cursorLine(t.lines())).toContain("Close PR and delete branch")
    t.done()
  })

  it("clamps a short menu to the 40-column floor", async () => {
    const t = await mountMenu(prActions())
    const top = t.lines()[menuTop(t.lines())]!
    t.done()

    // Longest content row is far shorter than 40; the floor holds the frame.
    expect(top.length).toBe(40)
  })
})

describe("menu gaps", () => {
  it("separates every neighbouring group exactly once", () => {
    // Read off the real layout: groups change exactly five times over the six
    // bands, so five blank rows, no two adjacent.
    const laid = menuRowsOf(prActions())
    const gaps = laid.filter((r) => isMenuGap(r)).length
    expect(gaps).toBe(5)
    const idx = laid.map((r) => (isMenuGap(r) ? "_" : "x")).join("")
    expect(idx).not.toMatch(/__/)
  })

  it("draws no gaps inside a confirm sub-menu", async () => {
    const t = await mountMenu(prActions())
    for (let i = 0; i < 11; i += 1) await t.down()
    await t.press({ return: true })
    const lines = t.lines()
    t.done()

    const closeIdx = lines.findIndex((l) => l.includes("Close #42?"))
    const slice = lines.slice(closeIdx + 2, closeIdx + 4)
    expect(slice.some((l) => l.includes("Close #42"))).toBe(true)
    expect(slice.some((l) => l.includes("Cancel"))).toBe(true)
  })
})
