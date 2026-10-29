import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render, Text } from "ink"
import {
  App,
  MERGED_HOLD_MS,
  PROMPT_GUARD_MS,
  SUCCESS_NOTICE_MS,
} from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"
import type { ExtensionTarget, InboxExtension } from "./extension.js"

// A verb that runs ON the row: the list stays up, the row says what is
// happening, and the verb's own view is one ↵ away rather than in the way.
// Mounted for real, because the subject is the wiring between the shell that
// holds the activities, the list that draws and routes them, and the root that
// owns `q`.

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
  repo: "acme/api-gateway",
  url: `https://github.com/acme/api-gateway/pull/${number}`,
  health: "waiting",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
})

const FIRST = pr(2902, "Upgrade frontend dependencies")
const SECTIONS: Section[] = [
  {
    id: "open",
    label: "Open",
    items: [FIRST, pr(2911, "Retry webhook deliveries")],
  },
]

const settle = () => new Promise((resolve) => setImmediate(resolve))
const after = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const mount = (extensions: InboxExtension[]) => {
  const stdout = new FakeStdout(120, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
      extensions={extensions}
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

// A verb whose run the test drives by hand: `run` records the target, and the
// test then says what the row should show.
const rowVerb = (id: string, key: string) => {
  const calls = {
    run: 0,
    body: 0,
    target: undefined as ExtensionTarget | undefined,
  }
  const ext: InboxExtension = {
    id,
    title: id,
    key,
    scope: "item",
    run: (target) => {
      calls.run += 1
      calls.target = target
    },
    body: (onExit) => {
      calls.body += 1
      return <BodyMark onExit={onExit} id={id} />
    },
  }
  return { ext, calls }
}

const BodyMark = ({ id }: { onExit: () => void; id: string }) => {
  return <Text>{`${id} step view`}</Text>
}

const load = async (extensions: InboxExtension[]) => {
  const app = mount(extensions)
  await settle()
  await settle()
  return app
}

describe("row activity", () => {
  it("runs on the row instead of mounting the body, and the list stays up", async () => {
    const land = rowVerb("land", "L")
    const app = await load([land.ext])
    app.stdin.press("L")
    await settle()
    expect(land.calls.run).toBe(1)
    expect(land.calls.body).toBe(0)
    expect(land.calls.target?.item).toMatchObject({ number: 2902 })

    land.calls.target!.activity!.set(FIRST.url, {
      glyph: "spin",
      trailing: { text: "landing…", tone: "muted" },
    })
    await settle()
    const frame = app.stdout.lastFrame()
    expect(frame).toContain("landing…")
    expect(frame).toContain("Retry webhook deliveries")
    app.done()
  })

  it("asks on the row, ignores stray keys, and confirms on the word", async () => {
    const land = rowVerb("land", "L")
    const app = await load([land.ext])
    app.stdin.press("L")
    await settle()
    let confirmed = 0
    let cancelled = 0
    land.calls.target!.activity!.set(FIRST.url, {
      prompt: {
        text: "Land #2902",
        word: "y",
        onConfirm: () => (confirmed += 1),
        onCancel: () => (cancelled += 1),
      },
    })
    await settle()
    expect(app.stdout.lastFrame()).toContain("Land #2902 · y to confirm")

    // Inside the guard: even the right key is dropped.
    app.stdin.press("y")
    await settle()
    expect(confirmed).toBe(0)

    await after(PROMPT_GUARD_MS + 20)
    app.stdin.press("j")
    await settle()
    expect(cancelled).toBe(0)
    expect(app.stdout.lastFrame()).toContain("y to confirm")

    app.stdin.press("y")
    await settle()
    expect(confirmed).toBe(1)
    app.done()
  })

  it("takes a typed word with backspace, and esc cancels", async () => {
    const submit = rowVerb("submit", "S")
    const app = await load([submit.ext])
    app.stdin.press("S")
    await settle()
    let confirmed = 0
    let cancelled = 0
    submit.calls.target!.activity!.set(FIRST.url, {
      prompt: {
        text: "Submit #2902",
        word: "send",
        onConfirm: () => (confirmed += 1),
        onCancel: () => (cancelled += 1),
      },
    })
    await after(PROMPT_GUARD_MS + 20)
    for (const key of ["s", "e", "x", "n"]) {
      app.stdin.press(key)
      await settle()
    }
    // `x` was ignored, so this spelled `sen`.
    expect(app.stdout.lastFrame()).toContain("type send ↵ sen")
    app.stdin.press("\r")
    await settle()
    expect(confirmed).toBe(0)
    app.stdin.press("\x7f")
    await settle()
    expect(app.stdout.lastFrame()).toContain("type send ↵ se")
    app.stdin.press("\x1b")
    await after(30)
    expect(cancelled).toBe(1)
    app.done()
  })

  it("refuses a second verb on a running row", async () => {
    const land = rowVerb("land", "L")
    const submit = rowVerb("submit", "S")
    const app = await load([land.ext, submit.ext])
    app.stdin.press("L")
    await settle()
    land.calls.target!.activity!.set(FIRST.url, { glyph: "spin" })
    await settle()
    app.stdin.press("S")
    await settle()
    expect(submit.calls.run).toBe(0)
    expect(submit.calls.body).toBe(0)
    expect(app.stdout.lastFrame()).toContain("This row is busy")
    app.done()
  })

  it("opens the running verb's own view on ↵", async () => {
    const land = rowVerb("land", "L")
    const app = await load([land.ext])
    app.stdin.press("L")
    await settle()
    land.calls.target!.activity!.set(FIRST.url, { glyph: "spin" })
    await settle()
    app.stdin.press("\r")
    await settle()
    expect(land.calls.body).toBeGreaterThan(0)
    expect(app.stdout.lastFrame()).toContain("land step view")
    app.done()
  })

  it("plays the merged hold and drops the row when the verb merged it", async () => {
    const land = rowVerb("land", "L")
    const app = await load([land.ext])
    app.stdin.press("L")
    await settle()
    land.calls.target!.activity!.merged(FIRST.url)
    await settle()
    expect(app.stdout.lastFrame()).toContain("merged")
    await after(MERGED_HOLD_MS + 100)
    expect(app.stdout.lastFrame()).not.toContain(
      "Upgrade frontend dependencies",
    )
    app.done()
  })

  it("lets a notice stand for its hold, then gives the row back", async () => {
    const submit = rowVerb("submit", "S")
    const app = await load([submit.ext])
    app.stdin.press("S")
    await settle()
    submit.calls.target!.activity!.set(FIRST.url, {
      trailing: { text: "submitted", tone: "success" },
    })
    await settle()
    expect(app.stdout.lastFrame()).toContain("submitted")
    await after(SUCCESS_NOTICE_MS + 100)
    expect(app.stdout.lastFrame()).not.toContain("submitted")
    app.done()
  })

  it("keeps a failure until esc on the row dismisses it", async () => {
    const land = rowVerb("land", "L")
    const app = await load([land.ext])
    app.stdin.press("L")
    await settle()
    land.calls.target!.activity!.set(FIRST.url, {
      glyph: "failed",
      trailing: { text: "landed · ticket stuck", tone: "error" },
    })
    await settle()
    expect(app.stdout.lastFrame()).toContain("landed · ticket stuck")
    app.stdin.press("\x1b")
    await after(30)
    expect(app.stdout.lastFrame()).not.toContain("ticket stuck")
    app.done()
  })

  it("holds the first q while a run is in flight, and lets the second go", async () => {
    const land = rowVerb("land", "L")
    const app = await load([land.ext])
    app.stdin.press("L")
    await settle()
    land.calls.target!.activity!.set(FIRST.url, { glyph: "spin" })
    await after(30)
    app.stdin.press("q")
    await settle()
    expect(app.stdout.lastFrame()).toContain("q again to quit anyway")
    app.stdin.press("q")
    await after(50)
    // Ink clears the frame as it unmounts.
    expect(app.stdout.lastFrame()).toBe("")
    app.done()
  })
})
