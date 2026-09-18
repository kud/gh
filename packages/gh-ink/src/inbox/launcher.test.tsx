import { describe, it, expect } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render } from "ink"
import { App } from "./inbox.js"
import type { GHItem, Section } from "./inbox.js"
import type { ExtensionTarget, InboxExtension } from "./extension.js"

// The launcher (Ctrl+K): what a typed ticket key becomes, and in what order.
//
// Mounted for real rather than asserted against a hand-built row list, because
// the subject is the DERIVATION — that the browse screen turns the query into
// rows itself, draws its own two first, and appends what an extension's
// `commands` returns after them. The seam has no producer in the fleet yet; this
// stub is what keeps the append path honest until one exists, and pins the
// ordering as a tested fact rather than a convention.

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

const CTRL_K = "\u000b"
const ESC = "\u001b"

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

const SECTIONS: Section[] = [
  { id: "open", label: "Open", items: [pr(1, "a row to stand on")] },
]

// A generic key shape — the host's own would be narrower.
const KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/
const JIRA_BASE = "https://example.atlassian.net/browse"

const settle = () => new Promise((resolve) => setImmediate(resolve))
const type = async (stdin: FakeStdin, text: string) => {
  for (const ch of text) {
    stdin.press(ch)
    await settle()
  }
  await settle()
}

const mount = (props: {
  extensions?: InboxExtension[]
  jiraBase?: string
  jiraSetupHint?: string
}) => {
  const stdout = new FakeStdout(120, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
      jiraKeyRe={KEY_RE}
      {...props}
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

// Claims `task` rows the way a host's ticket extension does, and never mounts.
const ticketDrill: InboxExtension = {
  id: "ticket",
  title: "Ticket",
  key: "T",
  scope: "item",
  drills: ["task"],
  body: (onExit) => {
    onExit()
    return null
  },
}

describe("launcher", () => {
  it("opens on Ctrl+K with the placeholder, and closes again on esc", async () => {
    const { stdout, stdin, done } = mount({ jiraBase: JIRA_BASE })
    await settle()
    await settle()
    expect(stdout.lastFrame()).not.toContain("ticket key…")

    stdin.press(CTRL_K)
    await settle()
    expect(stdout.lastFrame()).toContain("ticket key…")

    stdin.press(ESC)
    await settle()
    await settle()
    done()
    expect(stdout.lastFrame()).not.toContain("ticket key…")
  })

  it("turns a typed key into open-here and open-in-Jira, in that order", async () => {
    const { stdout, stdin, done } = mount({
      jiraBase: JIRA_BASE,
      extensions: [ticketDrill],
    })
    await settle()
    await settle()
    stdin.press(CTRL_K)
    await settle()
    await type(stdin, "shop-12")
    const frame = stdout.lastFrame()
    done()

    const here = frame.indexOf("Open SHOP-12 here")
    const jira = frame.indexOf("Open SHOP-12 in Jira")
    expect(here).toBeGreaterThan(-1)
    expect(jira).toBeGreaterThan(here)
    // The cursor starts on the first row, so ⏎ is the 90 % case.
    expect(frame).toMatch(/❯ Open SHOP-12 here/)
  })

  it("offers no open-here row when nothing drills task rows", async () => {
    const { stdout, stdin, done } = mount({ jiraBase: JIRA_BASE })
    await settle()
    await settle()
    stdin.press(CTRL_K)
    await settle()
    await type(stdin, "SHOP-12")
    const frame = stdout.lastFrame()
    done()
    expect(frame).not.toContain("Open SHOP-12 here")
    expect(frame).toContain("Open SHOP-12 in Jira")
  })

  it("appends an extension's commands after the host rows, keyed by extension", async () => {
    let seen: ExtensionTarget | undefined
    const contributor: InboxExtension = {
      id: "contrib",
      title: "Contributor",
      key: "z",
      body: () => null,
      commands: (target) => {
        seen = target
        return target.ticketKey
          ? [
              {
                id: "log",
                title: `Log time on ${target.ticketKey}`,
                run: () => {},
              },
            ]
          : []
      },
    }
    const { stdout, stdin, done } = mount({
      jiraBase: JIRA_BASE,
      extensions: [ticketDrill, contributor],
    })
    await settle()
    await settle()
    stdin.press(CTRL_K)
    await settle()
    await type(stdin, "shop-12")
    const frame = stdout.lastFrame()
    done()

    expect(seen?.query).toBe("shop-12")
    expect(seen?.ticketKey).toBe("SHOP-12")
    const jira = frame.indexOf("Open SHOP-12 in Jira")
    const log = frame.indexOf("Log time on SHOP-12")
    expect(log).toBeGreaterThan(jira)
  })

  it("says so, in one line, when the key matches nothing or Jira is not configured", async () => {
    const miss = mount({ jiraBase: JIRA_BASE })
    await settle()
    await settle()
    miss.stdin.press(CTRL_K)
    await settle()
    await type(miss.stdin, "nope")
    const missed = miss.stdout.lastFrame()
    miss.done()
    expect(missed).toContain('no ticket matches "nope"')
    expect(missed).not.toMatch(/Open \S+ (here|in Jira)/)

    const bare = mount({ jiraSetupHint: "jira config" })
    await settle()
    await settle()
    bare.stdin.press(CTRL_K)
    await settle()
    const unconfigured = bare.stdout.lastFrame()
    bare.done()
    expect(unconfigured).toContain("Jira not configured · jira config")
  })
})
