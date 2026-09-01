import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App, LEAVING_HOLD_MS } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"
import type { ExtensionTarget, InboxExtension } from "./extension.js"

// What a row-scoped extension is handed, and whether it can actually DO anything
// with the list.
//
// It could not, until this. `ExtensionTarget` carried the row and the login and
// nothing to act with, so an extension that hides rows by the host's own rule —
// a mute list, a snooze — wrote its state, exited, and left the row sitting
// there until the next refetch was applied. Indistinguishable, on screen, from
// the keypress having done nothing at all. The built-in verbs never had this
// problem: `x` drops the row before its network call has answered.
//
// Mounted for real rather than asserted against a hand-built target, because the
// subject is the WIRING — that the browse screen passes its own removal and
// flash channels through, and that they still work once the overlay has exited.

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

const SECTIONS: Section[] = [
  {
    id: "open",
    label: "Open",
    items: [pr(1, "first row and the one the cursor starts on"), pr(2, "second row that must survive")],
  },
]

const settle = () => new Promise((resolve) => setImmediate(resolve))
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("ExtensionTarget", () => {
  const mount = (ext: InboxExtension) => {
    const stdout = new FakeStdout(120, 30)
    const stdin = new FakeStdin()
    const instance = render(
      <App
        fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
        extensions={[ext]}
      />,
      {
        stdout: stdout as never,
        stdin: stdin as never,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
      },
    )
    return {
      stdout,
      stdin,
      done: () => {
        instance.unmount()
        instance.cleanup()
      },
    }
  }

  it("hands a row-scoped extension the row, a remover and a flash channel", async () => {
    let seen: ExtensionTarget | undefined
    const spy: InboxExtension = {
      id: "spy",
      title: "Spy",
      key: "z",
      scope: "item",
      body: (onExit, target) => {
        seen = target
        onExit()
        return null
      },
    }
    const { stdin, done } = mount(spy)
    await settle()
    await settle()
    stdin.press("z")
    await settle()
    done()

    expect(seen?.item?.kind).toBe("pr")
    expect((seen?.item as GHItem | undefined)?.number).toBe(1)
    expect(seen?.login).toBe("kud")
    // The two that did not exist before.
    expect(typeof seen?.onRemove).toBe("function")
    expect(typeof seen?.showFlash).toBe("function")
  })

  it("sees the row off, then drops it, when the extension removes it", async () => {
    const muter: InboxExtension = {
      id: "muter",
      title: "Muter",
      key: "z",
      scope: "item",
      body: (onExit, target) => {
        if (target?.item) target.onRemove?.(target.item)
        target?.showFlash?.("✓ Muted #1")
        onExit()
        return null
      },
    }
    const { stdout, stdin, done } = mount(muter)
    await settle()
    await settle()
    expect(stdout.lastFrame()).toContain("first row")

    stdin.press("z")
    await settle()
    await settle()
    const frame = stdout.lastFrame()

    // The row is on its way out, not out: it wears GONE where you can see it
    // first, the same farewell the built-in verbs got when closing stopped
    // teleporting rows off screen. What has not changed is the part this test
    // was written for — no refetch is involved anywhere in it.
    expect(frame).toContain("first row")
    expect(frame).toContain("GONE")
    expect(frame).toContain("Muted #1")

    await after(LEAVING_HOLD_MS + 400)
    const settled = stdout.lastFrame()
    done()

    expect(settled).not.toContain("first row")
    // And only that row: a remover that clears the list would pass the line above.
    expect(settled).toContain("second row that must survive")
  })
})
