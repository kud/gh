import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { colors } from "@kud/ink-ui"
import {
  App,
  SELECTION_BG,
  selectionBackground,
  taskKeyStyle,
} from "./inbox.js"
import type { Section, TaskRow } from "./inbox.js"

/*
 * How the row under the cursor says so: a recessed wash across the full row,
 * the ❯ in the gutter, and the title's bold — never the title's hue. The key
 * wore the accent until 2026-10-05, which read as selection turning the title
 * orange; the band carries the cursor now.
 *
 * The wash itself is asserted as a pure decision rather than by grepping a
 * frame, because chalk emits colour only for a TTY: a spec that looked for the
 * tint would pass wherever the suite is piped, which is a check that cannot
 * fail. The half that IS visible without colour — that the ❯ and the headline
 * survive the hue's removal — is asserted on the frame.
 */

describe("selectionBackground", () => {
  it("washes the active row", () => {
    expect(selectionBackground(true, false)).toBe(SELECTION_BG)
  })

  it("washes nothing on an inactive row", () => {
    expect(selectionBackground(false, false)).toBeUndefined()
  })

  /*
   * A lit band under a dialog would read as something to act on while the
   * dialog owns the keys, so the backdrop takes the wash with everything else.
   */
  it("washes nothing behind an overlay", () => {
    expect(selectionBackground(true, true)).toBeUndefined()
  })

  /*
   * The wash is a recessed track, not a second accent: darker than the ground
   * rather than lighter (the raised reading is the overlay's), and never the
   * orange the title just stopped wearing — or selection would still turn the
   * row orange, one layer along.
   */
  it("is a recessed wash, never the accent", () => {
    expect(SELECTION_BG).toBe("#16161f")
    expect(SELECTION_BG).not.toBe(colors.accent)
  })
})

describe("taskKeyStyle", () => {
  /*
   * Exact equality on purpose: the accent on every row, like the PR number, and
   * bold only under the cursor, so a stray prop breaks the shape.
   */
  it("wears the accent on every row and bold only when active", () => {
    expect(taskKeyStyle(true)).toEqual({ color: colors.accent, bold: true })
    expect(taskKeyStyle(false)).toEqual({ color: colors.accent, bold: false })
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
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read = () => null
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

const task = (): TaskRow => ({
  kind: "task",
  key: "PROJ-1",
  summary: "Stand up the new subdomain",
  url: "https://example.invalid/PROJ-1",
  status: "open",
  age: "",
  indent: false,
})

const mount = async (item: TaskRow) => {
  const sections: Section[] = [{ id: "today", label: "Today", items: [item] }]
  const stdout = new FakeStdout(120, 30)
  const instance = render(
    <App fetcher={async () => ({ sections, login: "kud" })} title="test" />,
    {
      stdout: stdout as never,
      stdin: new FakeStdin() as never,
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
  return frame
}

describe("the selected task row on screen", () => {
  // The cursor starts on the only row, so this is the active headline: ❯,
  // key and summary all present, with the hue gone from the first.
  it("still carries the non-colour signals after the hue went", async () => {
    const frame = await mount(task())
    expect(frame).toContain("❯")
    expect(frame).toContain("PROJ-1")
    expect(frame).toContain("Stand up the new subdomain")
  })
})
