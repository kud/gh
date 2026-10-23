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
  rows?: number
  cols?: number
}) => {
  const stdout = new FakeStdout(extra?.cols ?? 120, extra?.rows ?? 30)
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

const MANY: Section[] = [
  { id: "a", label: "Mine", items: Array.from({ length: 60 }, (_, i) => pr(i + 1)) },
  { id: "b", label: "Theirs", items: [pr(100)] },
  { id: "c", label: "Empty", items: [] },
]
const STRIP = async () => ({
  title: "services",
  items: Array.from({ length: 14 }, (_, i) => ({
    key: `service-${i}`,
    state: (i === 3 ? "fail" : "ok") as "fail" | "ok",
  })),
  at: Date.now(),
})
const height = (frame: string) => frame.replace(/\n$/, "").split("\n").length

type Case = {
  name: string
  opts?: Parameters<typeof mount>[0]
  keys?: string[]
  esc?: boolean
}
const cases: Case[] = [
  { name: "board, two rows" },
  { name: "board, many rows", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }) } },
  { name: "board, strip and focus", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }), stripFetcher: STRIP as never, focusLabel: "focus" } },
  { name: "board, unconfigured strip", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }), stripFetcher: async () => null } },
  { name: "empty tab", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }) }, keys: ["\t", "\t"] },
  { name: "filter typing", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }) }, keys: ["/", "x"] },
  { name: "filter kept, no match", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }) }, keys: ["/", "z", "z", "\r"] },
  { name: "help", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }) }, keys: ["?"] },
  { name: "drill", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }), detailFor: () => <StubDrill /> }, keys: ["\r"] },
  { name: "drill, strip and focus", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }), stripFetcher: STRIP as never, focusLabel: "focus", detailFor: () => <StubDrill /> }, keys: ["\r"] },
  { name: "drill, filter kept", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }), detailFor: () => <StubDrill /> }, keys: ["/", "1", "\r", "\r"] },
  { name: "ext body", opts: { fetcher: async () => ({ sections: MANY, login: "kud" }), extensions: [spyExtension(() => <SilentBody />)] }, keys: ["z"] },
  { name: "empty", opts: { fetcher: async () => ({ sections: [], login: "kud" }) } },
  { name: "failed", opts: { fetcher: async () => { throw new Error("boom") } } },
  { name: "loading", opts: { fetcher: () => new Promise(() => {}) as never } },
  { name: "loading, strip and focus", opts: { fetcher: () => new Promise(() => {}) as never, stripFetcher: (() => new Promise(() => {})) as never, focusLabel: "focus" } },
]

// Every state draws a frame exactly the terminal's height: the bottom border on
// the last row, never above it (a band that forgot rows the overlay hides) and
// never past it (Ink clips overflow from the top, eating the header). Covered
// elsewhere: a terminal narrowed after launch — resize-width.test.tsx, which is
// the regression behind the frame width reading `useWindowSize` live instead of
// the module-load `COLS`. Not yet covered: the action menu on a terminal under
// ~30 rows, which outgrows the band it opens in.
describe("frame height across states", () => {
  for (const rows of [24, 30, 50])
    for (const c of cases)
      it(`${c.name} @ ${rows} rows`, async () => {
        const t = await mount({ ...c.opts, rows })
        for (const k of c.keys ?? []) await t.press(k)
        await new Promise((r) => setTimeout(r, 30))
        await t.press("")
        const frame = t.frame()
        t.done()
        const lines = frame.replace(/\n$/, "").split("\n")
        const bottom = lines.findLastIndex((l) => l.includes("╰"))
        expect({ h: height(frame), bottom: bottom + 1 }).toEqual({ h: rows, bottom: rows })
      })
})
