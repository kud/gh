import { describe, it, expect, vi } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, COLS } from "./inbox.js"
import type { Section, TaskRow } from "./inbox.js"
import type { Rails, Sidebar } from "../components/side-panel.js"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writeCache } from "./cache.js"

// Every shell the inbox spawns lands here instead of on the machine. `o` on a
// rail row runs `open <url>`, and a spec that pressed it against the real zx
// would open a browser tab on every test run.
const shells: string[] = []
// `c` on a rail row pipes the URL into pbcopy through node's own spawn, not
// through zx — so it needs its own stub, or a test run would write to the
// machine's clipboard. What was copied is read off the stub's stdin.
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

vi.mock("zx", () => {
  const tag = (pieces: TemplateStringsArray, ...values: unknown[]) => {
    shells.push(String.raw({ raw: pieces }, ...values))
    return Promise.resolve()
  }
  const $ = (...args: unknown[]) =>
    Array.isArray(args[0]) ? tag(...(args as [TemplateStringsArray])) : $
  return { $ }
})

/*
 * The rail answers a question the tabs cannot: a tab files a row by the stage it
 * is in, and a container has no stage of its own — an epic moves only because its
 * children did. Before the rail, an epic with no live work had nowhere to be
 * drawn at all and fell into the catch-all tab for tickets that had dropped off
 * the board, which is a different thing wearing the same face.
 *
 * Two things are pinned here. That the rail is REACHABLE — it is a second focus
 * region, and a screen with two cursors and no way to tell which one ↵ acts on is
 * worse than one with none. And that it takes its columns out of the list rather
 * than out of the frame.
 */
class FakeStdout extends EventEmitter {
  frames: string[] = []
  constructor(public columns: number, public rows: number) {
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
    const d = this.buffer
    this.buffer = null
    return d
  }
  press = (key: string) => {
    this.buffer = key
    this.emit("readable")
  }
}

const TAB = "\t"
const ESC = String.fromCharCode(27)
const DOWN = ESC + "[B"
const UP = ESC + "[A"

const settle = () => new Promise((r) => setImmediate(r))

const task = (key: string, summary: string): TaskRow => ({
  kind: "task",
  key,
  summary,
  url: `https://example.invalid/${key}`,
  status: "In Development",
  age: "",
  indent: false,
})

const sections: Section[] = [
  {
    id: "in-progress",
    label: "In progress",
    items: [task("PROJ-1", "x".repeat(300))],
  },
]

const sidebar: Sidebar = {
  title: "Initiatives",
  rows: [
    {
      key: "PROJ-900",
      label: "Transfer of earnings adjustments batch",
      live: 3,
      wantsYou: true,
      url: "https://example.invalid/PROJ-900",
    },
    { key: "PROJ-901", label: "Automate the accounting run", live: 0 },
  ],
}

const mount = async (
  withSidebar: boolean,
  columns = 120,
  cacheKey?: string,
) => {
  const stdout = new FakeStdout(columns, 40)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({
        sections,
        login: "kud",
        ...(withSidebar ? { sidebar } : {}),
      })}
      title="cockpit"
      cacheKey={cacheKey}
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
  // A lone ESC byte is the prefix of every arrow key, so the input parser has to
  // wait a beat before it can call it an escape. Two microtask flushes are not a
  // beat — hence the real delay, which every other key pays for too rather than
  // leaving one press behaving differently from the rest.
  const press = async (k: string) => {
    stdin.press(k)
    await settle()
    await settle()
    await new Promise((r) => setTimeout(r, 20))
    await settle()
  }
  return {
    frame: () => stdout.lastFrame(),
    // The marks sit on the label line, above the key: a rail row is read by
    // name, and the key is what you open.
    rowOf: (key: string) => {
      const lines = stdout.lastFrame().split("\n")
      const at = lines.findIndex((l) => l.includes(key))
      return at > 0 ? lines[at - 1]! : ""
    },
    press,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

// The rail is closed at mount, so every spec about what it LOOKS like has to
// ask for it first. Bundled here rather than repeated, so a spec reads as the
// thing it asserts rather than as a press and then the thing.
const mountOpen = async () => {
  const harness = await mount(true)
  await harness.press("i")
  return harness
}

describe("the initiatives rail", () => {
  // Forty columns out of the list is a real price, and the list is what the
  // cockpit is opened for. The footer carries the key while the rail is away —
  // a closed rail nobody can find is the same as no rail at all.
  it("is closed by default, and says which key brings it in", async () => {
    const { frame, stop } = await mount(true)
    expect(frame()).not.toContain("PROJ-900")
    expect(frame()).toContain("i initiatives")
    stop()
  })

  it("opens on i and goes away again on i", async () => {
    const { frame, press, stop } = await mount(true)
    await press("i")
    expect(frame()).toContain("Initiatives")
    expect(frame()).toContain("PROJ-900")
    await press("i")
    expect(frame()).not.toContain("PROJ-900")
    stop()
  })

  // A key that visibly does nothing reads as a broken feature rather than as a
  // surface that does not have the feature.
  it("does not exist at all on a host with no rail", async () => {
    const { frame, press, stop } = await mount(false)
    expect(frame()).not.toContain("Initiatives")
    await press("i")
    expect(frame()).not.toContain("Initiatives")
    await press(TAB)
    expect(frame()).not.toContain("Initiatives")
    stop()
  })

  // The whole reason the width is threaded down to the rows. A budget that does
  // not know the rail is there overflows by exactly the rail, and the frame is
  // sized to fill the terminal — so it scrolls the panel rather than clipping.
  it("takes its columns out of the list, not out of the frame", async () => {
    const { frame, stop } = await mountOpen()
    for (const line of frame().split("\n"))
      expect([...line].length).toBeLessThanOrEqual(COLS + 4)
    stop()
  })

  // Same arrow, same orange, same question as the PR rows: does this want me.
  it("marks an initiative that wants you", async () => {
    const { rowOf, stop } = await mountOpen()
    expect(rowOf("PROJ-900")).toContain("←")
    expect(rowOf("PROJ-901")).not.toContain("←")
    stop()
  })
})

describe("browsing the rail", () => {
  it("is not focused until you cross into it", async () => {
    const { frame, stop } = await mountOpen()
    expect(frame()).not.toContain("● focus")
    stop()
  })

  it("takes focus on tab, and says so in words", async () => {
    const { frame, press, stop } = await mountOpen()
    await press(TAB)
    expect(frame()).toContain("● focus")
    stop()
  })

  // The footer has to describe the region the arrows are actually driving.
  // Advertising `m actions` beside a cursor that cannot reach a row names a key
  // that does nothing where you are standing.
  it("swaps the footer for its own keymap while focused", async () => {
    const { frame, press, stop } = await mountOpen()
    expect(frame()).toContain("m actions")
    await press(TAB)
    expect(frame()).toContain("back to list")
    expect(frame()).not.toContain("m actions")
    stop()
  })

  it("moves its own cursor with the arrows", async () => {
    const { rowOf, press, stop } = await mountOpen()
    await press(TAB)
    expect(rowOf("PROJ-900")).toContain("❯")
    await press(DOWN)
    expect(rowOf("PROJ-901")).toContain("❯")
    expect(rowOf("PROJ-900")).not.toContain("❯")
    await press(UP)
    expect(rowOf("PROJ-900")).toContain("❯")
    stop()
  })

  it("stops at the ends rather than wrapping", async () => {
    const { rowOf, press, stop } = await mountOpen()
    await press(TAB)
    await press(UP)
    expect(rowOf("PROJ-900")).toContain("❯")
    await press(DOWN)
    await press(DOWN)
    await press(DOWN)
    expect(rowOf("PROJ-901")).toContain("❯")
    stop()
  })

  it("hands the arrows back on esc", async () => {
    const { frame, press, stop } = await mountOpen()
    await press(TAB)
    await press(ESC)
    expect(frame()).not.toContain("● focus")
    expect(frame()).toContain("m actions")
    stop()
  })

  it("hands the arrows back on tab as well", async () => {
    const { frame, press, stop } = await mountOpen()
    await press(TAB)
    await press(TAB)
    expect(frame()).not.toContain("● focus")
    stop()
  })

  // The URL and the key are interpolated into a template each, and both were
  // once lost together (c02824c): `o` ran a bare `open` and flashed "Opened "
  // with nothing after it, and nothing complained. Pinned at both ends.
  it("opens the row's URL in the browser on o, and names the key", async () => {
    const { frame, press, stop } = await mountOpen()
    shells.length = 0
    await press(TAB)
    await press("o")
    expect(shells).toEqual(["open https://example.invalid/PROJ-900"])
    expect(frame()).toContain("↗ Opened PROJ-900")
    stop()
  })

  // The same URL `o` opens, on the same key the list uses for it — a rail row
  // is the list's vocabulary at a different distance, not a second one.
  it("copies the row's URL on c, and names the key", async () => {
    const { frame, press, stop } = await mountOpen()
    copied.length = 0
    await press(TAB)
    await press("c")
    expect(copied).toEqual(["https://example.invalid/PROJ-900"])
    expect(frame()).toContain("✓ Copied URL for PROJ-900")
    stop()
  })

  // Focus left behind on a hidden rail is the one state where nothing on screen
  // says which region ↵ would act on.
  it("cannot be left focused on a rail that has been closed", async () => {
    const { frame, press, stop } = await mountOpen()
    await press(TAB)
    await press("i")
    expect(frame()).not.toContain("● focus")
    expect(frame()).toContain("m actions")
    stop()
  })
})

describe("the rail on a launch painted from the cache", () => {
  // A fresh cache is the launch that never refetches. The rail used to arrive
  // only with a fetch, so on exactly that launch `i` did nothing and the footer
  // did not even offer it — "sometimes I can't see the initiatives".
  it("is there without a fetch", async () => {
    process.env.XDG_CACHE_HOME = mkdtempSync(join(tmpdir(), "gh-ink-rail-"))
    try {
      writeCache("rail", { sections, login: "kud", sidebar })
      // The fetcher would supply a rail too; what is pinned is that the cached
      // paint already has one, so the key works before any fetch answers.
      const { frame, press, stop } = await mount(true, 120, "rail")
      expect(frame()).toContain("i initiatives")
      await press("i")
      expect(frame()).toContain("PROJ-900")
      stop()
    } finally {
      delete process.env.XDG_CACHE_HOME
    }
  })
})

// A separate fixture rather than a change to `sidebar` above: two sections, so
// the cursor and the open key both have a second section to cross INTO.
const stack: Rails = [
  {
    title: "Initiatives",
    rows: [
      {
        key: "PROJ-900",
        label: "Transfer of earnings adjustments batch",
        live: 3,
        url: "https://example.invalid/PROJ-900",
      },
      { key: "PROJ-901", label: "Automate the accounting run", live: 0 },
    ],
  },
  {
    title: "Services",
    rows: [
      {
        key: "SVC-1",
        label: "royalty calculation engine",
        live: 1,
        url: "https://example.invalid/SVC-1",
      },
      { key: "SVC-2", label: "distribution pipeline", live: 0 },
    ],
  },
]

const mountStack = async (sidebarValue: Rails = stack, columns = 120) => {
  const stdout = new FakeStdout(columns, 40)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({
        sections,
        login: "kud",
        sidebar: sidebarValue,
      })}
      title="cockpit"
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
    await new Promise((r) => setTimeout(r, 20))
    await settle()
  }
  return {
    frame: () => stdout.lastFrame(),
    rowOf: (key: string) => {
      const lines = stdout.lastFrame().split("\n")
      const at = lines.findIndex((l) => l.includes(key))
      return at > 0 ? lines[at - 1]! : ""
    },
    press,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("a stack of rails", () => {
  it("names both sections in the footer hint", async () => {
    const { frame, stop } = await mountStack()
    expect(frame()).toContain("i initiatives · services")
    stop()
  })

  it("walks the cursor from the last row of the first section into the first row of the second", async () => {
    const { rowOf, press, stop } = await mountStack()
    await press("i")
    await press(TAB)
    expect(rowOf("PROJ-900")).toContain("❯")
    await press(DOWN)
    expect(rowOf("PROJ-901")).toContain("❯")
    await press(DOWN)
    expect(rowOf("SVC-1")).toContain("❯")
    expect(rowOf("PROJ-901")).not.toContain("❯")
    stop()
  })

  it("opens a row in the SECOND section on o", async () => {
    const { press, frame, stop } = await mountStack()
    shells.length = 0
    await press("i")
    await press(TAB)
    await press(DOWN)
    await press(DOWN)
    await press("o")
    expect(shells).toEqual(["open https://example.invalid/SVC-1"])
    expect(frame()).toContain("↗ Opened SVC-1")
    stop()
  })

  // `[]` is the same claim as leaving `sidebar` out entirely: no rail, no `i`
  // hint, and the key does nothing.
  it("treats an empty stack as no rail at all", async () => {
    const { frame, press, stop } = await mountStack([])
    expect(frame()).not.toContain("Initiatives")
    expect(frame()).not.toContain("i initiatives")
    await press("i")
    expect(frame()).not.toContain("Initiatives")
    stop()
  })
})
