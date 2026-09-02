import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { moveCursor, treeUrls, App } from "./inbox.js"
import type { AnyItem, GHItem, Section } from "./inbox.js"

// The repo fence used to be scenery: moveCursor stepped over it, firstSelectable
// started past it, and every key arm returned early on it. It is a row now — you
// can stand on it, open the checkout behind it, and take every URL under it in
// one keystroke.
//
// Two halves worth pinning separately. Which rows the cursor may occupy is pure
// and testable on its own; whether the fence still LOOKS like a fence is not,
// and is the whole of what was asked for ("do not change the display"), so it is
// asserted against a real frame.

const pr = (number: number, repo: string, indent = false): GHItem => ({
  kind: "pr",
  number,
  title: `pull request number ${number}`,
  repo,
  url: `https://github.com/${repo}/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent,
})

const fence = (repo: string): AnyItem => ({
  kind: "repo-header",
  repo,
  age: "",
  indent: false,
})

const band: AnyItem = {
  kind: "subgroup-header",
  label: "Your move",
  age: "",
  indent: false,
}

//  0 band · 1 fence(ambre) · 2 #1 · 3 #2 · 4 fence(gh) · 5 #3
const ROWS: AnyItem[] = [
  band,
  fence("kud/ambre"),
  pr(1, "kud/ambre"),
  pr(2, "kud/ambre"),
  fence("kud/gh"),
  pr(3, "kud/gh"),
]

describe("moveCursor over a repo fence", () => {
  it("stops on a repo-header", () => {
    expect(moveCursor(ROWS, 2, -1)).toBe(1)
    expect(moveCursor(ROWS, 3, 1)).toBe(4)
  })

  // A band label names an arrangement of rows, not a thing with anything behind
  // it — every key would be inert there, so the keystroke would buy nothing.
  it("still steps over a subgroup-header", () => {
    expect(moveCursor(ROWS, 1, -1)).toBe(1)
  })

  // The reason the fence is not skipped in one direction only: ↓ then ↑ has to
  // land where it started, or the list reads as drifting under you.
  it("is its own inverse in both directions", () => {
    for (let i = 1; i < ROWS.length - 1; i++) {
      const down = moveCursor(ROWS, i, 1)
      expect(moveCursor(ROWS, down, -1)).toBe(i)
    }
  })
})

describe("treeUrls over a repo fence", () => {
  it("takes the whole group and stops at the next fence", () => {
    expect(treeUrls(ROWS, 1)).toEqual([
      "https://github.com/kud/ambre/pull/1",
      "https://github.com/kud/ambre/pull/2",
    ])
    expect(treeUrls(ROWS, 4)).toEqual(["https://github.com/kud/gh/pull/3"])
  })

  // A collapsed row is not a gap in the group, it IS the rest of it. Walking
  // past one would make what `C` copies depend on how tall the group happened to
  // be drawn — a difference the screen gives you no way to notice.
  it("includes the rows a show-more is holding", () => {
    const collapsed: AnyItem[] = [
      fence("kud/ambre"),
      pr(1, "kud/ambre"),
      { kind: "show-more", hidden: [pr(9, "kud/ambre", true)], indent: true },
    ]
    expect(treeUrls(collapsed, 0)).toEqual([
      "https://github.com/kud/ambre/pull/1",
      "https://github.com/kud/ambre/pull/9",
    ])
  })

  it("gives nothing for a fence that owns no rows", () => {
    expect(treeUrls([fence("kud/ambre")], 0)).toEqual([])
  })
})

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
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const UP = `${String.fromCharCode(27)}[A`

const SECTIONS: Section[] = [
  {
    id: "open",
    label: "Open",
    items: [fence("kud/ambre"), pr(1, "kud/ambre"), pr(2, "kud/ambre")],
  },
]

const fenceLine = (frame: string): string =>
  frame
    .split("\n")
    .map((l) => l.replace(ANSI, ""))
    .find((l) => l.includes("── kud/ambre")) ?? ""

describe("the fence on screen", () => {
  const mount = () => {
    const stdout = new FakeStdout(120, 30)
    const stdin = new FakeStdin()
    const instance = render(
      <App fetcher={async () => ({ sections: SECTIONS, login: "kud" })} />,
      {
        stdout: stdout as never,
        stdin: stdin as never,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
      },
    )
    return {
      stdout,
      stdin,
      done: () => {
        instance.unmount()
        instance.cleanup()
      },
    }
  }

  // The constraint the whole change was given: unselected, the fence draws
  // exactly what it has always drawn. The cursor takes the two spaces the fence
  // already reserved, so this also pins that nothing shifted sideways.
  it("is unchanged while the cursor is elsewhere", async () => {
    const { stdout, done } = mount()
    await settle()
    await settle()
    const line = fenceLine(stdout.lastFrame())
    done()
    expect(line).toMatch(/^│ {3}── kud\/ambre ─+ *│$/)
  })

  it("wears the same cursor every other row wears, in the same column", async () => {
    const { stdout, stdin, done } = mount()
    await settle()
    await settle()
    stdin.press(UP)
    await settle()
    const line = fenceLine(stdout.lastFrame())
    done()
    expect(line).toMatch(/^│ ❯ ── kud\/ambre ─+ *│$/)
  })

  // A selectable row that advertises nothing is a row nobody presses — and on a
  // fence the fixed strip was actively wrong, offering `m` (which opens nothing
  // there) over the two keys that do.
  it("re-labels the footer for what a fence can actually do", async () => {
    const { stdout, stdin, done } = mount()
    await settle()
    await settle()
    const onRow = stdout.lastFrame().replace(ANSI, "")
    stdin.press(UP)
    await settle()
    const onFence = stdout.lastFrame().replace(ANSI, "")
    done()
    expect(onRow).toContain("actions")
    expect(onFence).toContain("open repo")
    expect(onFence).toContain("copy group")
    expect(onFence).not.toContain("actions")
  })
})
