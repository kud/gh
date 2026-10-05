import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventEmitter } from "node:events"
import React from "react"
import { render, Text } from "ink"
import { fetchItemNode } from "@kud/gh"
import { App } from "./inbox.js"
import type { AnyItem, GHItem, Section } from "./inbox.js"
import { LookupMiss, type InboxExtension } from "./extension.js"

// The launcher's lookup: a pasted PR or issue reference, or anything an
// extension's `resolve` claims, opened as a drill whether or not the inbox
// lists it.
//
// Mounted for real, for the same reason launcher.test.tsx is: the subject is
// what the browse screen DERIVES from the query, phase by phase, and the one
// thing a hand-built row list could not show is the launcher staying open
// across an Enter whose answer lands a tick later. Only the network is faked —
// `fetchItemNode` — so the parse, the resolver order, `resolveRef`'s mapping
// and the listed-copy preference all run as shipped.

vi.mock("@kud/gh", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@kud/gh")>()),
  fetchItemNode: vi.fn(),
}))
const fetchNode = vi.mocked(fetchItemNode)

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
const ENTER = "\r"

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
  {
    id: "open",
    label: "Open",
    items: [
      pr(1, "the listed copy"),
      {
        ...pr(3, "a web row"),
        repo: "acme/web",
        url: "https://github.com/acme/web/pull/3",
      },
    ],
  },
]

// What `fetchItemNode` hands back for a real issue: the node, not a row.
const issueNode = (repo: string, number: number) => ({
  __typename: "Issue",
  number,
  title: "Gateway drops the trace header",
  state: "OPEN",
  createdAt: "2026-10-02T09:00:00Z",
  url: `https://github.com/${repo}/issues/${number}`,
  repository: { nameWithOwner: repo },
  author: { login: "kud" },
  comments: { totalCount: 0, nodes: [] },
  labels: { nodes: [] },
})

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))
const settleMany = async (n = 4) => {
  for (let i = 0; i < n; i++) await settle()
}
const type = async (stdin: FakeStdin, text: string) => {
  for (const ch of text) {
    stdin.press(ch)
    await settle()
  }
  await settle()
}

// The detail a host would mount, reduced to the fields this file asserts:
// which item reached the drill, of which kind, and whether it carries the flag.
const detailFor = ({ item, kind }: { item: GHItem; kind: string }) => (
  <Text>
    {`DETAIL ${kind} ${item.repo}#${item.number} · ${item.title} · ${item.notInInbox ? "not in inbox" : "listed"}`}
  </Text>
)

const mount = (extensions?: InboxExtension[]) => {
  const stdout = new FakeStdout(120, 30)
  const stdin = new FakeStdin()
  const instance = render(
    <App
      fetcher={async () => ({ sections: SECTIONS, login: "kud" })}
      detailFor={detailFor}
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
  const open = async (query: string) => {
    await settleMany(2)
    stdin.press(CTRL_K)
    await settle()
    await type(stdin, query)
  }
  return {
    stdout,
    stdin,
    open,
    frame: () => stdout.lastFrame(),
    done: () => {
      instance.unmount()
      instance.cleanup()
    },
  }
}

beforeEach(() => {
  fetchNode.mockReset()
})

describe("launcher lookup: the rows each phase draws", () => {
  it("offers ↵ opens, then open in browser, while a reference is typed", async () => {
    const app = mount()
    await app.open("acme/api-gateway#2926")
    const frame = app.frame()
    app.done()

    const opens = frame.indexOf("↵ opens acme/api-gateway#2926")
    const browser = frame.indexOf("Open acme/api-gateway#2926 in browser")
    expect(opens).toBeGreaterThan(-1)
    expect(browser).toBeGreaterThan(opens)
    expect(frame).toMatch(/❯ ↵ opens acme\/api-gateway#2926/)
    // Typing is free: nothing is asked of GitHub until Enter.
    expect(fetchNode).not.toHaveBeenCalled()
  })

  it("reads a pasted URL the same way", async () => {
    const app = mount()
    await app.open("https://github.com/acme/api-gateway/pull/2926/files")
    const frame = app.frame()
    app.done()
    expect(frame).toContain("↵ opens acme/api-gateway#2926")
  })

  it("draws one Looking up row while the fetch is out, and stays open", async () => {
    const pending = deferred<unknown>()
    fetchNode.mockReturnValue(pending.promise)
    const app = mount()
    await app.open("acme/api-gateway#2926")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    pending.resolve(null)
    await settleMany()
    app.done()

    expect(frame).toContain("Looking up acme/api-gateway#2926…")
    expect(frame).not.toContain("↵ opens")
    expect(frame).not.toContain("in browser")
    expect(frame).toContain("acme/api-gateway#2926")
    expect(fetchNode).toHaveBeenCalledWith("acme/api-gateway", 2926)
  })

  it("puts a miss in the message slot and keeps the input as typed", async () => {
    fetchNode.mockResolvedValue(null)
    const app = mount()
    await app.open("acme/api-gateway#2926")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()

    expect(frame).toContain('nothing matches "acme/api-gateway#2926"')
    expect(frame).not.toContain("↵ opens")
    expect(frame).not.toContain("DETAIL")
    // Still the launcher, still holding the query.
    expect(frame).toContain("› acme/api-gateway#2926")
  })

  it("draws a failure as its own row, in its own words, and stays open", async () => {
    fetchNode.mockRejectedValue(
      Object.assign(
        new Error("Command failed with exit code 1: gh api graphql -f query=…"),
        {
          stderr: "gh: HTTP 502: Bad Gateway",
        },
      ),
    )
    const app = mount()
    await app.open("acme/api-gateway#2926")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()

    // The reason wraps rather than truncating: it is the only clue to what
    // went wrong, so it is drawn whole even at the cost of a second line.
    expect(frame).toContain(
      "✗ couldn't look up acme/api-gateway#2926 · HTTP 502:",
    )
    expect(frame).toContain("Bad Gateway")
    expect(frame).not.toContain("Command failed")
    expect(frame).not.toContain("DETAIL")

    // Enter on the failure asks again.
    fetchNode.mockResolvedValue(issueNode("acme/api-gateway", 2926))
    app.stdin.press(ENTER)
    await settleMany()
    const retried = app.frame()
    app.done()
    expect(fetchNode).toHaveBeenCalledTimes(2)
    expect(retried).toContain("DETAIL issue acme/api-gateway#2926")
  })

  it("drops a lookup the viewer typed past", async () => {
    const pending = deferred<unknown>()
    fetchNode.mockReturnValue(pending.promise)
    const app = mount()
    await app.open("acme/api-gateway#2926")
    app.stdin.press(ENTER)
    await settleMany()
    await type(app.stdin, "7")
    pending.resolve(issueNode("acme/api-gateway", 2926))
    await settleMany()
    const frame = app.frame()
    app.done()

    expect(frame).not.toContain("DETAIL")
    expect(frame).toContain("↵ opens acme/api-gateway#29267")
  })
})

describe("launcher lookup: what opens", () => {
  it("opens the fetched item with its kind from the node and the not-in-inbox flag", async () => {
    fetchNode.mockResolvedValue(issueNode("acme/api-gateway", 2926))
    const app = mount()
    await app.open("acme/api-gateway#2926")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()

    // Typed as shorthand, which says nothing about PR or issue: the node does.
    expect(frame).toContain(
      "DETAIL issue acme/api-gateway#2926 · Gateway drops the trace header · not in inbox",
    )
    expect(frame).not.toContain("Looking up")
  })

  it("opens the listed copy of a reference the inbox already holds, without fetching", async () => {
    const app = mount()
    await app.open("Acme/API-Gateway#1")
    expect(app.frame()).toContain("↵ opens acme/api-gateway#1")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()

    expect(frame).toContain(
      "DETAIL pr acme/api-gateway#1 · the listed copy · listed",
    )
    expect(fetchNode).not.toHaveBeenCalled()
  })

  it("expands a bare #N against the active row's repo first", async () => {
    const app = mount()
    // The cursor starts on acme/api-gateway#1, which lists a #1.
    await app.open("#1")
    expect(app.frame()).toContain("↵ opens acme/api-gateway#1")
    app.stdin.press(ENTER)
    await settleMany()
    const listed = app.frame()
    app.done()
    expect(listed).toContain("DETAIL pr acme/api-gateway#1 · the listed copy")
    expect(fetchNode).not.toHaveBeenCalled()
  })

  it("then tries the inbox's repos, and still prefers a listed copy of the answer", async () => {
    fetchNode.mockImplementation(async (repo: string, number: number) =>
      repo === "acme/web" && number === 3
        ? {
            ...issueNode("acme/web", 3),
            __typename: "PullRequest",
            url: "https://github.com/acme/web/pull/3",
          }
        : null,
    )
    const app = mount()
    await app.open("#3")
    expect(app.frame()).toContain("↵ opens #3")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()

    expect(fetchNode.mock.calls).toEqual([
      ["acme/api-gateway", 3],
      ["acme/web", 3],
    ])
    expect(frame).toContain("DETAIL pr acme/web#3 · a web row · listed")
  })
})

describe("launcher lookup: who claims the query", () => {
  const ticket = (key: string): AnyItem => ({
    kind: "task",
    key,
    ticket: key,
    summary: "",
    url: `https://tracker.example/browse/${key}`,
    status: "",
    age: "",
  })

  // Claims everything it is shown, so ordering is the only thing deciding.
  const greedy = (id: string, seen: string[]): InboxExtension => ({
    id,
    title: id,
    key: id,
    scope: "item",
    drills: ["task"],
    body: (_exit, target) => (
      <Text>{`BODY ${id} ${(target?.item as { key?: string })?.key}`}</Text>
    ),
    resolve: (input) => async () => {
      seen.push(id)
      if (input.trim() === "SHOP-404")
        throw new LookupMiss(`no ticket ${input.trim()}`)
      return ticket(input.trim())
    },
  })

  it("asks GitHub first, so no extension can shadow a pasted PR", async () => {
    const seen: string[] = []
    fetchNode.mockResolvedValue(issueNode("acme/api-gateway", 2926))
    const app = mount([greedy("first", seen)])
    await app.open("acme/api-gateway#2926")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()
    expect(seen).toEqual([])
    expect(frame).toContain("DETAIL issue acme/api-gateway#2926")
  })

  it("then each extension in declaration order, opening through its drill", async () => {
    const seen: string[] = []
    const app = mount([greedy("first", seen), greedy("second", seen)])
    await app.open("SHOP-1234")
    const typed = app.frame()
    expect(typed).toContain("↵ opens SHOP-1234")
    // An extension's claim has no URL to offer before it resolves.
    expect(typed).not.toContain("in browser")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()
    expect(seen).toEqual(["first"])
    expect(frame).toContain("BODY first SHOP-1234")
  })

  it("reads an extension's LookupMiss as a miss, in the message slot", async () => {
    const app = mount([greedy("first", [])])
    await app.open("SHOP-404")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()
    expect(frame).toContain("no ticket SHOP-404")
    expect(frame).not.toContain("couldn't look up")
  })

  it("opens the listed copy when an extension resolves to a row the inbox holds", async () => {
    const mirror: InboxExtension = {
      id: "mirror",
      title: "Mirror",
      key: "z",
      body: () => null,
      resolve: (input) =>
        input.trim() === "gw-1"
          ? async () => ({ ...pr(1, "a fresh twin") })
          : null,
    }
    const app = mount([mirror])
    await app.open("gw-1")
    app.stdin.press(ENTER)
    await settleMany()
    const frame = app.frame()
    app.done()
    expect(frame).toContain(
      "DETAIL pr acme/api-gateway#1 · the listed copy · listed",
    )
  })

  it("leaves a query nothing claims to the no-match line", async () => {
    const app = mount()
    await app.open("not a ref")
    const frame = app.frame()
    app.done()
    expect(frame).not.toContain("↵ opens")
    expect(frame).toContain("Jira not configured")
  })
})
