import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, backdropStyle } from "./inbox.js"
import type { Section, TaskRow } from "./inbox.js"

/*
 * What "behind" means, in two halves.
 *
 * The mechanism used to be `dimColor` alone, and it did not survive contact with
 * a terminal: SGR 2 is a single binary attribute whose meaning is the terminal's
 * to decide, and on iTerm2 it barely moves a 24-bit foreground. Measured on a
 * real frame, a row's escape codes were byte-identical either side of the
 * overlay — the same `38;2;255;135;0` orange — so the list read at full strength
 * behind a panel that was supposed to be in front.
 *
 * So the backdrop replaces colour rather than attenuating it. The half that
 * matters is asserted as a pure function rather than by grepping a frame,
 * because chalk emits colour only when the runner is a TTY: a spec that looked
 * for escape codes would pass wherever the suite is piped, which is a check that
 * cannot fail. The half that IS visible without colour — that a pill stops being
 * drawn — is asserted on the frame.
 */

describe("backdropStyle", () => {
  it("replaces the colour instead of attenuating it", () => {
    const style = backdropStyle({ color: "#FF8700" })
    expect(style.color).toBe("#5a5a68")
  })

  /*
   * Both would be worse than either: leave faint on beside a flat colour and the
   * two planes stop being the values chosen here and become whatever this
   * terminal does with SGR 2 — the exact failure being fixed, one layer along.
   */
  it("drops faint rather than stacking it under the new colour", () => {
    expect(backdropStyle({ color: "#FF8700" }).dimColor).toBe(false)
  })

  /*
   * `dimColor` at the call site is reused as the plane selector: an element that
   * already declared itself furniture says so again here, one step further back.
   * Two planes rather than one, so the list keeps its shape — headers still read
   * as headers — at a contrast that cannot be read.
   */
  it("sends what was already furniture a plane further back", () => {
    expect(backdropStyle({ dimColor: true }).color).toBe("#3a3a46")
    expect(backdropStyle({ dimColor: true }).color).not.toBe(
      backdropStyle({}).color,
    )
  })

  it("drops weight and slant, which are texture at this contrast", () => {
    const style = backdropStyle({ bold: true, italic: true })
    expect(style.bold).toBe(false)
    expect(style.italic).toBe(false)
  })

  /*
   * Shape survives where colour does not. A struck-through title is a row on its
   * way out, and that reads at any contrast — same reasoning that lets the health
   * glyphs lose their hues here without losing their meaning.
   */
  it("leaves strikethrough alone", () => {
    expect(backdropStyle({ strikethrough: true })).not.toHaveProperty(
      "strikethrough",
    )
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

const task = (n: number): TaskRow => ({
  kind: "task",
  key: `ACC-${n}`,
  summary: `ticket summary number ${n} padded out a fair way`,
  url: `https://jira/ACC-${n}`,
  status: "In Development",
  age: "2d",
  depth: 0,
  ticket: `ACC-${n}`,
  pill: "BLOCKED",
})

const SECTIONS: Section[] = [
  {
    id: "open",
    label: "Open",
    items: Array.from({ length: 30 }, (_, n) => task(1201 + n)),
  },
]

describe("a pill behind an overlay", () => {
  /*
   * `Pill` is `@kud/ink-ui`'s and renders that package's `Text`, so it never sees
   * the context and cannot be recoloured with the rest of the row. Harmless while
   * the backdrop merely lost its bold; once the list flattens to one recessive
   * tone a filled pill is the most saturated thing on the screen, behind a panel
   * that is meant to be in front. It is an announcement, and behind a dialog
   * there is nobody to announce to.
   */
  it("is not drawn, while the rows around it still are", async () => {
    const stdout = new FakeStdout(120, 44)
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
    await settle()
    await settle()
    expect(stdout.lastFrame()).toContain("BLOCKED")

    stdin.press("m")
    await settle()
    const frame = stdout.lastFrame()
    instance.unmount()
    instance.cleanup()

    expect(frame).not.toContain("BLOCKED")
    // The backdrop is still a backdrop: the rows did not go with the pill.
    expect(frame).toContain("ticket summary number 1")
  })
})
