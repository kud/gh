import { describe, expect, it } from "vitest"
import { EventEmitter } from "node:events"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import React from "react"
import { render, Text } from "ink"
import { App } from "./inbox.js"
import { useChrome } from "./extension.js"
import { writeCache } from "./cache.js"
import type { GHItem, Section } from "./inbox.js"
import type { InboxExtension } from "./extension.js"

// The frame, the title row and the footer stay mounted while an overlay — an
// extension body or a drill-in view — is open, and the overlay renders in the
// content area between them. Before this, opening either replaced the whole
// screen: the rounded frame, the `🚀 … N items · @login updated …` title row
// and the footer hints all unmounted with the browse list.
//
// Mounted for real, like overlay.test.tsx: the composition IS the subject —
// which layer unmounts and which stays — so the harness is the same one (ink's
// `render` with a sized fake stdout, not ink-testing-library, whose stdout is
// fixed at 100 columns with no row count and cannot size this frame).
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

const pr = (number: number): GHItem => ({
  kind: "pr",
  number,
  title: `pull request number ${number}`,
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: number,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const SECTIONS: Section[] = [
  { id: "open", label: "Open", items: [pr(1), pr(2)] },
]

const settle = () => new Promise((resolve) => setImmediate(resolve))
// A lone ESC byte is the prefix of every arrow key, so Ink's input parser has
// to WAIT before it can call it an escape — same 20ms as app-keys.test.tsx.
const ESC = String.fromCharCode(27)

// Colour codes would shift every column index below, and whether chalk emits
// them at all depends on the runner rather than on this code.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (line: string) => line.replace(ANSI, "")

// A drill-in view the way the cockpit's read: no frame of its own, only a
// breadcrumb and verbs claimed through `useChrome`.
const StubDrill = () => {
  useChrome({
    scope: "Resubmit · acme/api-gateway#1",
    hints: [["v", "view diff"]],
  })
  return <Text>drill body here</Text>
}

// An extension body that claims nothing: it still renders inside the frame,
// with the shell's own back/quit tail for a footer.
const SilentBody = () => <Text>silent body here</Text>

const spyExtension = (body: InboxExtension["body"]): InboxExtension => ({
  id: "spy",
  title: "Spy",
  key: "z",
  scope: "item",
  body,
})

const mount = async (extra?: {
  extensions?: InboxExtension[]
  detailFor?: () => React.ReactNode
  fetcher?: () => Promise<{ sections: Section[]; login: string }>
  stripFetcher?: () => Promise<null>
  focusLabel?: string
  cacheKey?: string
}) => {
  const stdout = new FakeStdout(120, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      title="cockpit"
      fetcher={extra?.fetcher ?? (async () => ({ sections: SECTIONS, login: "kud" }))}
      extensions={extra?.extensions}
      detailFor={extra?.detailFor as never}
      stripFetcher={extra?.stripFetcher}
      focusLabel={extra?.focusLabel}
      cacheKey={extra?.cacheKey}
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
  const press = async (key: string) => {
    stdin.press(key)
    await settle()
    await settle()
    await settle()
  }
  const pressEsc = async () => {
    stdin.press(ESC)
    await settle()
    await settle()
    await new Promise((r) => setTimeout(r, 20))
    await settle()
  }
  return {
    press,
    pressEsc,
    frame: () => stripAnsi(stdout.lastFrame()),
    firstFrame: () => stripAnsi(stdout.frames[0] ?? ""),
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("persistent chrome", () => {
  it("keeps the header and frame on screen while an extension body is open", async () => {
    const t = await mount({
      extensions: [spyExtension(() => <SilentBody />)],
    })
    await t.press("z")
    const frame = t.frame()
    t.done()

    // The body is up, in the content area …
    expect(frame).toContain("silent body here")
    // … and the chrome never left: the rounded frame, the title row with its
    // count and login, and a footer ending in back and quit.
    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("@kud")
    expect(frame).toMatch(/⌫ back.*q quit/)
    // The browse list itself is gone, not dimmed behind: the second row with
    // it. (The first row's number survives inside the body's own text in the
    // drill test below, which is why this asserts on the second.)
    expect(frame).not.toContain("pull request number 2")
  })

  it("keeps the header and frame on screen while a drill-in view is open", async () => {
    const t = await mount({ detailFor: () => <StubDrill /> })
    await t.press("d")
    const frame = t.frame()
    t.done()

    expect(frame).toContain("drill body here")
    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("@kud")
    expect(frame).toContain("Resubmit · acme/api-gateway#1")
    expect(frame).not.toContain("pull request number 2")
  })

  it("shows the body's breadcrumb and verbs from useChrome", async () => {
    const ClaimingBody = () => {
      useChrome({
        scope: "Resubmit · acme/api-gateway#1",
        hints: [["v", "view diff"]],
      })
      return <Text>claiming body here</Text>
    }
    const t = await mount({
      extensions: [spyExtension(() => <ClaimingBody />)],
    })
    await t.press("z")
    const frame = t.frame()
    t.done()

    // The breadcrumb joins the title row …
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("Resubmit · acme/api-gateway#1")
    // … and the body's verbs join the footer, ahead of the shell's own tail.
    expect(frame).toMatch(/v view diff.*⌫ back.*q quit/)
  })

  it("closes the overlay on esc and hands back to the unchanged browse list", async () => {
    const t = await mount({ detailFor: () => <StubDrill /> })
    await t.press("d")
    expect(t.frame()).toContain("drill body here")

    await t.pressEsc()
    const frame = t.frame()
    t.done()

    expect(frame).not.toContain("drill body here")
    expect(frame).not.toContain("Resubmit · acme/api-gateway#1")
    expect(frame).toContain("pull request number 1")
    expect(frame).toContain("pull request number 2")
  })
})

describe("every other full-screen state", () => {
  // The sweep: help, loading, empty and failed all render inside the same
  // frame and title row as browse — none of them blanks the screen to show
  // itself. The `m` action menu already floated over the list and stays as it
  // is; the explain view, the Ctrl+K launcher and the repo picker float the
  // same way the legend does, pinned by the specs beside this one.

  it("keeps the header and frame behind the help legend", async () => {
    const t = await mount()
    await t.press("?")
    const frame = t.frame()
    t.done()

    expect(frame).toContain("Legend")
    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("@kud")
  })

  it("frames the loading state with the same header", async () => {
    // A fetch that never resolves: the app waits on it indefinitely.
    const t = await mount({ fetcher: () => new Promise(() => {}) as never })
    const frame = t.frame()
    t.done()

    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("Fetching cockpit")
  })

  it("reserves the strip and focus rows out of the loading body, not on top of it", async () => {
    // The services strip and the focus slot each cost two rows above the body.
    // The body used to subtract only the CI line, so with both drawn the cold
    // frame ran four rows past its budget and three past the terminal: Ink
    // cleared and repainted the whole screen on every spinner tick, the
    // terminal scrolled the header off, and it dropped back when the fetch
    // landed. The frame is the same height with or without them.
    const never = () => new Promise(() => {}) as never
    const height = (frame: string) => frame.replace(/\n$/, "").split("\n").length
    const bare = await mount({ fetcher: never })
    const bareFrame = bare.frame()
    bare.done()
    const chromed = await mount({
      fetcher: never,
      stripFetcher: never,
      focusLabel: "focus",
    })
    const frame = chromed.frame()
    chromed.done()

    expect(frame).toContain("status  loading…")
    expect(frame).toContain("focus  loading…")
    expect(height(frame)).toBe(height(bareFrame))
    expect(height(frame)).toBeLessThanOrEqual(30)
  })

  it("draws the loading frame exactly as tall as the board it gives way to", async () => {
    // The body budgeted six rows of chrome, one of them a footer that sits
    // INSIDE the body box. Every list-less frame ran a row short of the board,
    // and the bottom border dropped a row the moment the fetch landed.
    const height = (frame: string) => frame.replace(/\n$/, "").split("\n").length
    const loading = await mount({ fetcher: () => new Promise(() => {}) as never })
    const loadingFrame = loading.frame()
    loading.done()
    const board = await mount()
    const boardFrame = board.frame()
    board.done()

    expect(loadingFrame).toContain("Fetching cockpit")
    expect(boardFrame).toContain("pull request number 1")
    expect(height(loadingFrame)).toBe(height(boardFrame))
  })

  it("paints a cached board on the very first frame, with no loading frame before it", async () => {
    // The cache was read in the mount effect, AFTER the first render, so even
    // a warm launch drew one loading frame and then snapped to the board.
    process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), "gh-ink-first-paint-"))
    try {
      writeCache("first-paint", { sections: SECTIONS, login: "kud" })
      const t = await mount({
        cacheKey: "first-paint",
        fetcher: () => new Promise(() => {}) as never,
      })
      const first = t.firstFrame()
      t.done()

      expect(first).not.toContain("Fetching cockpit")
      expect(first).toContain("pull request number 1")
    } finally {
      delete process.env.XDG_CACHE_HOME
    }
  })

  it("frames the empty state with the same header", async () => {
    const t = await mount({ fetcher: async () => ({ sections: [], login: "kud" }) })
    const frame = t.frame()
    t.done()

    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("Nothing open.")
  })

  it("frames a failed fetch with the same header", async () => {
    const t = await mount({
      fetcher: () => Promise.reject(new Error("no route to GitHub")) as never,
    })
    const frame = t.frame()
    t.done()

    expect(frame).toMatch(/╭/)
    expect(frame).toMatch(/╰/)
    expect(frame).toContain("🚀 Cockpit")
    expect(frame).toContain("Fetch failed")
  })
})
