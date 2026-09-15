import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"

/*
 * `q`, `esc` and `backspace` belong to the app, not to a screen.
 *
 * Ink runs every active `useInput` on every key with no order and no
 * propagation, so "who gets esc" is never settled by layering handlers — only by
 * there being ONE claimant. There used to be five for `q` and eight for `esc`,
 * which is why the two properties pinned here could both be wrong at once and
 * neither would show up in a frame anyone was looking at.
 *
 * These are cheap and they are not QA-doc material. What genuinely stays manual
 * is whether the peel FEELS like one level, and anything involving a real
 * terminal being handed to a shell command.
 */

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
/*
 * A lone ESC byte is the prefix of every arrow key, so Ink's input parser has to
 * WAIT before it can call it an escape — two microtask flushes are not a wait.
 * Every key goes through the same delay rather than leaving one press behaving
 * differently from the rest. Same reasoning, and the same 20ms, as the rail's
 * own harness in `sidebar.test.tsx`.
 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")
const ESC = String.fromCharCode(27)

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
    stdout,
    stdin,
    press,
    frame: () => stdout.lastFrame().replace(ANSI, ""),
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

describe("the app's own keys", () => {
  /*
   * THE CASE THE WHOLE `isActive` WIRING EXISTS FOR. Inside a text field `q` is
   * a letter, and an app-level quit binding that does not know the field has
   * focus takes the whole app down mid-search. The root hook stands its keys
   * down while `searchInput` is true; this is what proves the wiring reaches it.
   */
  it("types a q into the search box rather than quitting", async () => {
    const { press, frame, done } = mount()
    await settle()
    await settle()
    await press("/")
    await press("q")
    const after = frame()
    done()
    // Still rendering the list, so the app did not exit under the typist.
    expect(after).toContain("pull request number 1")
  })

  /*
   * ONE ESC PEELS ONE LAYER, innermost first — the property the peel's ordering
   * exists to hold, and the one that was actually broken. The arms used to be
   * written in source order rather than priority order, so with an inner layer
   * open AND a filter set, esc cleared the filter and left the inner layer
   * standing: one press, wrong layer, and the thing you were looking at still on
   * screen.
   */
  it("closes the inner layer first and leaves the search standing", async () => {
    const { press, frame, done } = mount()
    await settle()
    await settle()

    // A search, committed with ↵ so the field hands the keyboard back.
    await press("/")
    await press("p")
    await press("\r")

    // The repo picker over the top of it.
    await press("f")
    const withPicker = frame()

    await press(ESC)
    const after = frame()
    done()

    expect(withPicker).toContain("Filter by repo")
    expect(after).not.toContain("Filter by repo")
    expect(after).toContain("pull request number 1")
  })
})
