import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render, Box, Text } from "ink"
import { Page } from "@kud/ink-ui"
import { ActionMenu } from "./inbox.js"
import type { GHItem } from "./inbox.js"

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

const pr = (number: number, title: string): GHItem => ({
  kind: "pr",
  number,
  title,
  repo: "kud/some-repo",
  url: `https://github.com/kud/some-repo/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const stripAnsi = (line: string) => line.replace(ANSI, "")

const settle = () => new Promise((resolve) => setImmediate(resolve))

const actions = [
  { label: "Open in browser", hint: "o", run: () => {} },
  { label: "Request review", hint: "r", run: () => {} },
  { label: "Copy link", hint: "c", run: () => {} },
]

const menuItem = pr(1201, "test PR")

describe("ActionMenu in flow under a full-height board", () => {
  it("keeps its natural height and does not collapse rows", async () => {
    const stdout = new FakeStdout(100, 30)
    const stdin = new FakeStdin()
    const instance = render(
      <Page title="cockpit" width={100} height={30} hints={[["M", "actions"]]}>
        <Box flexDirection="column" height={26}>
          {Array.from({ length: 26 }, (_, n) => (
            <Text key={n} wrap="truncate-end">
              {`#${
                1200 + n
              }  kud/some-repo  Review Status browser row ${n} padded out a long long way to the right edge`}
            </Text>
          ))}
        </Box>
        <ActionMenu item={menuItem} actions={actions} cursor={0} />
      </Page>,
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

    const frame = stdout.lastFrame()
    instance.unmount()
    instance.cleanup()

    const lines = frame.split("\n").map(stripAnsi)

    // The Page border draws one set of corners too; the menu's box is the LAST
    // `╭` and the FIRST `╰` after it.
    const top = lines.findLastIndex((line) => line.includes("╭"))
    const bottom = lines.findIndex((line, i) => i > top && line.includes("╰"))
    const menuLines = lines.slice(top, bottom + 1)

    // Title row appears
    expect(menuLines.some((line) => line.includes("#1201"))).toBe(true)

    // Every action label appears on its own line
    for (const action of actions) {
      expect(menuLines.some((line) => line.includes(action.label))).toBe(true)
    }

    // Both rules appear (top and bottom of the menu) - menu uses 32 dashes on inner lines
    // Exclude border lines (first and last) which have long dash sequences
    const innerLines = menuLines.slice(1, -1)
    const ruleLines = innerLines.filter((line) => line.includes("─".repeat(32)))
    expect(ruleLines.length).toBe(2)

    // No stale glyph fragments (e.g. "cew" from "Copy link" overwriting "Request review")
    for (const line of menuLines) {
      expect(line).not.toMatch(/cew/)
    }
  })
})
