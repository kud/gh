import { describe, it, expect, vi } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { AnyItem, GHItem, Section } from "./inbox.js"

// What `c` wrote to the clipboard, read off a stubbed pbcopy rather than the
// machine's — the same stub repo-header.test.tsx and sidebar.test.tsx use.
// Without it the first `c` spawned the runner's real pbcopy: missing on
// GitHub's Linux hardware, so the write raised an uncaught EPIPE and failed
// the suite on 2026-11-10. Guarding `clipboard()` against that instead broke
// those two files' stubs, which carry no `on`; the test owes the stub, not
// the code.
const copied: string[] = []
vi.mock("node:child_process", async (orig) => {
  const actual = await orig<typeof import("node:child_process")>()
  return {
    ...actual,
    spawn: (cmd: string, ...rest: unknown[]) =>
      cmd === "pbcopy"
        ? {
            stdin: {
              write: (text: string) => {
                copied.push(text)
              },
              end: () => {},
            },
          }
        : (actual.spawn as (...a: unknown[]) => unknown)(cmd, ...rest),
  }
})

/*
 * THE MULTI-SELECT, driven by real keypresses on a mounted inbox. Read back off
 * the frame — the footer's count, the flash, the `●` in the gutter — because
 * what is pinned is what the reader sees, not the state behind it. The pure
 * decisions underneath are in multi-select.test.ts.
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
const SHIFT_DOWN = ESC + "[1;2B"
const DOWN = ESC + "[B"
const RIGHT = ESC + "[C"

const pr = (n: number, repo = "acme/api"): GHItem => ({
  kind: "pr",
  number: n,
  title: `pull request ${n}`,
  repo,
  url: `https://github.com/${repo}/pull/${n}`,
  health: "none",
  age: "2d",
  ts: n,
  unresolved: 0,
  conversation: 0,
})

const header = (repo: string): AnyItem =>
  ({ kind: "repo-header", repo, age: "" }) as AnyItem

const five = (): AnyItem[] => [pr(1), pr(2), pr(3), pr(4), pr(5)]

const mount = async (before: Section[], after: Section[] = before) => {
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
  // Waits on what the screen says rather than on a guess at how long it
  // takes: a refresh resolves on its own schedule, the way transit.test.tsx
  // waits for it. The deadline only bounds a failure.
  const until = async (ok: (frame: string) => boolean, what: string) => {
    const deadline = performance.now() + 5000
    while (!ok(stdout.lastFrame())) {
      if (performance.now() > deadline)
        throw new Error(`no frame ${what}:\n${stdout.lastFrame()}`)
      await new Promise((r) => setTimeout(r, 20))
    }
  }
  return {
    frame: () => stdout.lastFrame(),
    press,
    until,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

const selectedCount = (frame: string): number | null => {
  const m = frame.match(/(\d+)\s+selected/)
  return m ? Number(m[1]) : null
}

describe("multi-select", () => {
  it("takes a range on ⇧↓ and copies one link per selected row", async () => {
    const { frame, press, stop } = await mount([
      { id: "open", label: "Open", items: five() },
    ])
    await press(SHIFT_DOWN)
    await press(SHIFT_DOWN)
    await press(SHIFT_DOWN)
    expect(selectedCount(frame())).toBe(4)
    expect(frame()).toContain("●")
    copied.length = 0
    await press("c")
    expect(frame()).toContain("Copied 4 links")
    expect(copied).toEqual([
      [1, 2, 3, 4]
        .map((n) => `https://github.com/acme/api/pull/${n}`)
        .join("\n"),
    ])
    stop()
  })

  it("keeps the selection while plain arrows move the cursor", async () => {
    const { frame, press, stop } = await mount([
      { id: "open", label: "Open", items: five() },
    ])
    await press(SHIFT_DOWN)
    await press(DOWN)
    await press(DOWN)
    expect(selectedCount(frame())).toBe(2)
    stop()
  })

  it("clears on esc", async () => {
    const { frame, press, stop } = await mount([
      { id: "open", label: "Open", items: five() },
    ])
    await press(SHIFT_DOWN)
    expect(selectedCount(frame())).toBe(2)
    await press(ESC)
    expect(selectedCount(frame())).toBeNull()
    stop()
  })

  it("clears when the tab changes", async () => {
    const { frame, press, stop } = await mount([
      { id: "open", label: "Open", items: five() },
      { id: "mine", label: "Mine", items: [pr(9)] },
    ])
    await press(SHIFT_DOWN)
    expect(selectedCount(frame())).toBe(2)
    await press(RIGHT)
    await press(ESC + "[D")
    expect(selectedCount(frame())).toBeNull()
    stop()
  })

  it("toggles one row on space", async () => {
    const { frame, press, stop } = await mount([
      { id: "open", label: "Open", items: five() },
    ])
    await press(" ")
    expect(selectedCount(frame())).toBe(1)
    await press(" ")
    expect(selectedCount(frame())).toBeNull()
    stop()
  })

  it("never counts a header the range runs across", async () => {
    const { frame, press, stop } = await mount([
      {
        id: "open",
        label: "Open",
        items: [pr(1), header("acme/web"), pr(2, "acme/web")],
      },
    ])
    await press(SHIFT_DOWN)
    await press(SHIFT_DOWN)
    expect(selectedCount(frame())).toBe(2)
    stop()
  })

  // The count is the rows still on the board. A row a refresh moves out of
  // the tab stays drawn for its departure hold, so the reader sees it go, but
  // it stops counting at once and no batch verb reaches it. (A row that merely
  // drops out of a fetch is held by `reconcile` and is still on the board.)
  it("keeps the count right when a refresh moves a selected row away", async () => {
    const { frame, press, until, stop } = await mount(
      [
        { id: "open", label: "Open", items: five() },
        { id: "mine", label: "Mine", items: [pr(9)] },
      ],
      [
        { id: "open", label: "Open", items: [pr(1), pr(3), pr(4), pr(5)] },
        { id: "mine", label: "Mine", items: [pr(9), pr(2)] },
      ],
    )
    await press(SHIFT_DOWN)
    await press(SHIFT_DOWN)
    expect(selectedCount(frame())).toBe(3)
    await press("r") // fetch, held at the gate
    await until((f) => f.includes("r apply"), "waiting behind r")
    await press("r") // apply
    await until((f) => !f.includes("r apply"), "with r applied")
    expect(selectedCount(frame())).toBe(2)
    stop()
  })
})
