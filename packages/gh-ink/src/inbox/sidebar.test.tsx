import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, COLS } from "./inbox.js"
import type { Section, TaskRow } from "./inbox.js"
import type { Sidebar } from "../components/side-panel.js"

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

const mount = async (withSidebar: boolean, columns = 120) => {
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
    lineWith: (needle: string) =>
      stdout
        .lastFrame()
        .split("\n")
        .find((l) => l.includes(needle)) ?? "",
    press,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("the initiatives rail", () => {
  // A rail you have to remember to ask for is one you never consult, and the
  // roadmap is the half of the picture the tabs cannot show at all.
  it("is open by default wherever a host supplies one", async () => {
    const { frame, stop } = await mount(true)
    expect(frame()).toContain("Initiatives")
    expect(frame()).toContain("PROJ-900")
    stop()
  })

  it("closes on i and comes back on i", async () => {
    const { frame, press, stop } = await mount(true)
    await press("i")
    expect(frame()).not.toContain("PROJ-900")
    await press("i")
    expect(frame()).toContain("PROJ-900")
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
    const { frame, stop } = await mount(true)
    for (const line of frame().split("\n"))
      expect([...line].length).toBeLessThanOrEqual(COLS + 4)
    stop()
  })

  // Same arrow, same orange, same question as the PR rows: does this want me.
  it("marks an initiative that wants you", async () => {
    const { lineWith, stop } = await mount(true)
    expect(lineWith("PROJ-900")).toContain("←")
    expect(lineWith("PROJ-901")).not.toContain("←")
    stop()
  })
})

describe("browsing the rail", () => {
  it("is not focused until you cross into it", async () => {
    const { frame, stop } = await mount(true)
    expect(frame()).not.toContain("● focus")
    stop()
  })

  it("takes focus on tab, and says so in words", async () => {
    const { frame, press, stop } = await mount(true)
    await press(TAB)
    expect(frame()).toContain("● focus")
    stop()
  })

  // The footer has to describe the region the arrows are actually driving.
  // Advertising `m actions` beside a cursor that cannot reach a row names a key
  // that does nothing where you are standing.
  it("swaps the footer for its own keymap while focused", async () => {
    const { frame, press, stop } = await mount(true)
    expect(frame()).toContain("m actions")
    await press(TAB)
    expect(frame()).toContain("back to list")
    expect(frame()).not.toContain("m actions")
    stop()
  })

  it("moves its own cursor with the arrows", async () => {
    const { lineWith, press, stop } = await mount(true)
    await press(TAB)
    expect(lineWith("PROJ-900")).toContain("❯")
    await press(DOWN)
    expect(lineWith("PROJ-901")).toContain("❯")
    expect(lineWith("PROJ-900")).not.toContain("❯")
    await press(UP)
    expect(lineWith("PROJ-900")).toContain("❯")
    stop()
  })

  it("stops at the ends rather than wrapping", async () => {
    const { lineWith, press, stop } = await mount(true)
    await press(TAB)
    await press(UP)
    expect(lineWith("PROJ-900")).toContain("❯")
    await press(DOWN)
    await press(DOWN)
    await press(DOWN)
    expect(lineWith("PROJ-901")).toContain("❯")
    stop()
  })

  it("hands the arrows back on esc", async () => {
    const { frame, press, stop } = await mount(true)
    await press(TAB)
    await press(ESC)
    expect(frame()).not.toContain("● focus")
    expect(frame()).toContain("m actions")
    stop()
  })

  it("hands the arrows back on tab as well", async () => {
    const { frame, press, stop } = await mount(true)
    await press(TAB)
    await press(TAB)
    expect(frame()).not.toContain("● focus")
    stop()
  })

  // Focus left behind on a hidden rail is the one state where nothing on screen
  // says which region ↵ would act on.
  it("cannot be left focused on a rail that has been closed", async () => {
    const { frame, press, stop } = await mount(true)
    await press(TAB)
    await press("i")
    expect(frame()).not.toContain("● focus")
    expect(frame()).toContain("m actions")
    stop()
  })
})
