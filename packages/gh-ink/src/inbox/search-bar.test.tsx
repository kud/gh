import { describe, it, expect, afterEach } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { colors, setIconMode } from "@kud/ink-ui"
import { App } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"
import { SEARCH_GLYPH_NERD, searchBarState, searchGlyph } from "./search-bar.js"

/*
 * THE SEARCH BAR'S TWO STATES.
 *
 * A kept filter used to look exactly like a field still taking keys, so
 * nothing on screen said whether the next letter would type or fire a hotkey.
 * The bar now answers that twice: a caret and lit head while typing, dimmed
 * furniture with its own words (`filtered · keys active`) once kept — and a
 * nerd-font magnifier where text mode keeps the `/` the keys contract names.
 *
 * Two levels because a test frame carries no escape codes: the rendered frame
 * pins what is VISIBLE (the head glyph, the caret, the hint words, the match
 * count), while the pure helper pins the COLOUR token choice no frame could
 * show — the same split the design system prescribes for `Pill`.
 */

const pr = (number: number, title: string): GHItem => ({
  kind: "pr",
  number,
  title,
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
  {
    id: "open",
    label: "Open",
    items: [
      pr(1, "fix the parser"),
      pr(2, "fix the lexer"),
      pr(3, "unrelated"),
    ],
  },
]

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
  const press = async (k: string) => {
    stdin.press(k)
    await settle()
    await settle()
    await new Promise((r) => setTimeout(r, 20))
    await settle()
  }
  return {
    press,
    // The bar is the only line that ever counts matches, so it is found by
    // the count rather than by a glyph that differs per icon mode.
    barLine: () =>
      stdout
        .lastFrame()
        .split("\n")
        .find((l) => l.includes("match")) ?? "",
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

// `setIconMode` is a process-global singleton: every nerd-mode test hands it
// back, or the text-mode assertions in the next file over start failing.
afterEach(() => setIconMode("text"))

describe("searchBarState", () => {
  it("draws the nerd magnifier in nerd mode and / elsewhere", () => {
    expect(SEARCH_GLYPH_NERD.codePointAt(0)).toBe(0xf422)
    expect(searchGlyph(true)).toBe("\uF422")
    expect(searchGlyph(false)).toBe("/")
    expect(searchBarState({ typing: true, nerd: true }).glyph).toBe("\uF422")
    expect(searchBarState({ typing: true, nerd: false }).glyph).toBe("/")
  })

  it("lights the head while typing and dims it once kept", () => {
    expect(searchBarState({ typing: true, nerd: false }).glyphColor).toBe(
      colors.info,
    )
    expect(searchBarState({ typing: false, nerd: false }).glyphColor).toBe(
      colors.muted,
    )
  })

  it("shows the caret only while the field owns the keyboard", () => {
    expect(searchBarState({ typing: true, nerd: false }).caret).toBe(true)
    expect(searchBarState({ typing: false, nerd: false }).caret).toBe(false)
  })

  it("words the kept state as a standing filter, not an open field", () => {
    expect(searchBarState({ typing: true, nerd: false }).hints).toBe(
      "↑↓ move · ↵ keep · esc clear",
    )
    expect(searchBarState({ typing: false, nerd: false }).hints).toBe(
      "filtered · keys active · esc clear",
    )
  })
})

describe("the search bar while typing", () => {
  it("shows the caret, the typing hints and the match count", async () => {
    const t = mount()
    await settle()
    await settle()
    await t.press("/")
    for (const ch of "fix") await t.press(ch)
    const bar = t.barLine()
    t.done()
    expect(bar).toContain("/ fix")
    expect(bar).toContain("▏")
    expect(bar).toContain("↑↓ move · ↵ keep · esc clear")
    expect(bar).toContain("2 matches")
  })

  it("draws the nerd magnifier instead of / in nerd mode", async () => {
    setIconMode("nerd")
    const t = mount()
    await settle()
    await settle()
    await t.press("/")
    for (const ch of "fix") await t.press(ch)
    const bar = t.barLine()
    t.done()
    expect(bar).toContain("\uF422")
    expect(bar).not.toContain("/")
    expect(bar).toContain("▏")
    expect(bar).toContain("2 matches")
  })
})

describe("the search bar with a kept filter", () => {
  it("drops the caret and says the keys are active again", async () => {
    const t = mount()
    await settle()
    await settle()
    await t.press("/")
    for (const ch of "fix") await t.press(ch)
    await t.press("\r")
    const bar = t.barLine()
    t.done()
    expect(bar).toContain("/ fix")
    expect(bar).not.toContain("▏")
    expect(bar).toContain("filtered · keys active · esc clear")
    expect(bar).toContain("2 matches")
  })

  it("keeps the nerd magnifier dimmed rather than reverting to /", async () => {
    setIconMode("nerd")
    const t = mount()
    await settle()
    await settle()
    await t.press("/")
    for (const ch of "fix") await t.press(ch)
    await t.press("\r")
    const bar = t.barLine()
    t.done()
    expect(bar).toContain("\uF422")
    expect(bar).not.toContain("/")
    expect(bar).not.toContain("▏")
    expect(bar).toContain("filtered · keys active · esc clear")
    expect(bar).toContain("2 matches")
  })
})
