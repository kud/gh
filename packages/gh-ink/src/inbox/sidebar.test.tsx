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
 * What is pinned here is that it costs nothing until asked for, and that when it
 * is open the list gives up the columns rather than overflowing them.
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
  return {
    stdout,
    stdin,
    stop: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("the initiatives rail", () => {
  it("stays shut until asked for, so it costs nothing by default", async () => {
    const { stdout, stop } = await mount(true)
    expect(stdout.lastFrame()).not.toContain("PROJ-900")
    stop()
  })

  it("opens on i", async () => {
    const { stdout, stdin, stop } = await mount(true)
    stdin.press("i")
    await settle()
    await settle()
    const frame = stdout.lastFrame()
    expect(frame).toContain("PROJ-900")
    expect(frame).toContain("Transfer of earnings")
    stop()
  })

  it("closes again on i", async () => {
    const { stdout, stdin, stop } = await mount(true)
    stdin.press("i")
    await settle()
    await settle()
    stdin.press("i")
    await settle()
    await settle()
    expect(stdout.lastFrame()).not.toContain("PROJ-900")
    stop()
  })

  // A key that visibly does nothing reads as a broken feature rather than as a
  // surface that does not have the feature.
  it("does not advertise or answer i on a host with no rail", async () => {
    const { stdout, stdin, stop } = await mount(false)
    const before = stdout.lastFrame()
    expect(before).not.toContain("Initiatives")
    stdin.press("i")
    await settle()
    await settle()
    expect(stdout.lastFrame()).not.toContain("Initiatives")
    stop()
  })

  // The whole reason the width is threaded down to the rows. A budget that does
  // not know the rail is there overflows by exactly the rail, and the frame is
  // sized to fill the terminal — so it scrolls the panel rather than clipping.
  it("takes its columns out of the list, not out of the frame", async () => {
    const { stdout, stdin, stop } = await mount(true)
    stdin.press("i")
    await settle()
    await settle()
    for (const line of stdout.lastFrame().split("\n"))
      expect([...line].length).toBeLessThanOrEqual(COLS + 4)
    stop()
  })

  // Same arrow, same orange, same question as the PR rows: does this want me.
  it("marks an initiative that wants you", async () => {
    const { stdout, stdin, stop } = await mount(true)
    stdin.press("i")
    await settle()
    await settle()
    const railLine = stdout
      .lastFrame()
      .split("\n")
      .find((l) => l.includes("PROJ-900"))
    expect(railLine).toContain("←")
    expect(
      stdout
        .lastFrame()
        .split("\n")
        .find((l) => l.includes("PROJ-901")),
    ).not.toContain("←")
    stop()
  })
})
