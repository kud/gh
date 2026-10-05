import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  buildActions,
  cachedJiraMoves,
  invalidateJiraMoves,
  openJiraMoves,
  orderJiraMoves,
} from "./inbox.js"
import type {
  Action,
  JiraAvailableTransition,
  JiraTransition,
  TaskRow,
} from "./inbox.js"

// `quietly` is the zx `$` wrapper with `quiet: true` defined at module scope in
// inbox.tsx — same mock as settled.test.ts, so every `jira issue move` lands
// here instead of on the machine.
const shells = vi.hoisted(() => [] as Array<{ cmd: string; resolve: boolean }>)

vi.mock("zx", () => {
  const $ = (...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      return (pieces: TemplateStringsArray, ...values: unknown[]) => {
        const cmd = String.raw({ raw: pieces }, ...values)
        const entry = shells.find((s) => s.cmd === cmd)
        if (!entry) throw new Error(`unmocked shell: ${cmd}`)
        return entry.resolve
          ? Promise.resolve({ stdout: "", stderr: "" })
          : Promise.reject(new Error("jira failed"))
      }
    }
    const pieces = args[0] as TemplateStringsArray
    const values = args.slice(1)
    const cmd = String.raw({ raw: pieces }, ...values)
    const entry = shells.find((s) => s.cmd === cmd)
    if (!entry) throw new Error(`unmocked shell: ${cmd}`)
    return entry.resolve
      ? Promise.resolve({ stdout: "", stderr: "" })
      : Promise.reject(new Error("jira failed"))
  }
  return { $ }
})

const task = (ticket: string, status = "In Progress"): TaskRow => ({
  kind: "task",
  key: ticket,
  ticket,
  summary: "a ticket",
  url: `https://example.com/browse/${ticket}`,
  status,
  age: "2d",
  indent: false,
})

const live = (name: string, id = name): JiraAvailableTransition => ({
  id,
  name,
  to: { name },
})

const configured: JiraTransition[] = [
  { label: "Start", transition: "Start Progress" },
  { label: "Finish", transition: "Done", resolutions: ["Done"] },
]

const labelsOf = (actions: Action[]): string[] => actions.map((a) => a.label)

const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise((r) => setImmediate(r))

// A controllable stand-in for the browse screen's menu: captures every open,
// answers whether the menu is still up.
const menuDouble = () => {
  const opened: Action[][] = []
  let up = true
  return {
    opened,
    setUp: (v: boolean) => {
      up = v
    },
    open: (actions: Action[]) => {
      opened.push(actions)
    },
    isOpen: () => up,
  }
}

const opener = (
  ticket: string,
  fetch: (t: string) => Promise<JiraAvailableTransition[]>,
  menu: ReturnType<typeof menuDouble>,
  over: {
    status?: string
    configured?: JiraTransition[]
    onActed?: () => void
  } = {},
) => {
  const flashes: string[] = []
  let acted = 0
  openJiraMoves({
    ticket,
    status: over.status ?? "In Progress",
    fetch,
    configured: over.configured ?? configured,
    open: menu.open,
    isOpen: menu.isOpen,
    showFlash: (msg) => flashes.push(msg),
    onActed: over.onActed ?? (() => acted++),
  })
  return { flashes, acted: () => acted }
}

describe("orderJiraMoves", () => {
  it("puts known transitions first in the static list's order, with its labels and resolutions", () => {
    const ordered = orderJiraMoves(
      [live("Done", "21"), live("Start Progress", "11")],
      configured,
    )
    expect(ordered).toEqual([
      {
        label: "Start",
        transition: "Start Progress",
        to: { name: "Start Progress" },
      },
      {
        label: "Finish",
        transition: "Done",
        resolutions: ["Done"],
        to: { name: "Done" },
      },
    ])
  })

  it("filters out configured entries the workflow does not offer", () => {
    const ordered = orderJiraMoves([live("Done", "21")], configured)
    expect(ordered).toEqual([
      {
        label: "Finish",
        transition: "Done",
        resolutions: ["Done"],
        to: { name: "Done" },
      },
    ])
  })

  it("appends unknown transitions alphabetically, labelled by name", () => {
    const ordered = orderJiraMoves(
      [live("On Hold", "31"), live("Done", "21"), live("Blocked", "41")],
      configured,
    )
    expect(ordered).toEqual([
      {
        label: "Finish",
        transition: "Done",
        resolutions: ["Done"],
        to: { name: "Done" },
      },
      { label: "Blocked", transition: "Blocked", to: { name: "Blocked" } },
      { label: "On Hold", transition: "On Hold", to: { name: "On Hold" } },
    ])
  })

  it("orders everything alphabetically without a static list", () => {
    expect(orderJiraMoves([live("Done"), live("Blocked")])).toEqual([
      { label: "Blocked", transition: "Blocked", to: { name: "Blocked" } },
      { label: "Done", transition: "Done", to: { name: "Done" } },
    ])
  })
})

describe("openJiraMoves", () => {
  beforeEach(() => {
    shells.length = 0
  })

  it("opens one dim loading row, swapped in place for the ordered moves", async () => {
    const gate = deferred<JiraAvailableTransition[]>()
    const fetch = vi.fn(() => gate.promise)
    const menu = menuDouble()
    opener("SHOP-101", fetch, menu)

    // Lazy: the hook fires on open, and the menu holds one loading row meanwhile.
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith("SHOP-101")
    expect(menu.opened).toHaveLength(1)
    expect(menu.opened[0]).toHaveLength(1)
    expect(menu.opened[0]![0]!.label).toBe("Loading transitions…")
    expect(menu.opened[0]![0]!.tone).toBe("dim")

    gate.resolve([
      live("Done", "21"),
      live("Start Progress", "11"),
      live("Blocked", "41"),
    ])
    await flush()

    expect(menu.opened).toHaveLength(2)
    expect(labelsOf(menu.opened[1]!)).toEqual(["Start", "Finish", "Blocked"])
  })

  it("never falls back to the static list: an error opens one retry row, no moves", async () => {
    const gate = deferred<JiraAvailableTransition[]>()
    const fetch = vi.fn(() => gate.promise)
    const menu = menuDouble()
    opener("SHOP-102", fetch, menu)

    gate.reject(new Error("jira is down"))
    await flush()

    expect(menu.opened).toHaveLength(2)
    const rows = menu.opened[1]!
    expect(rows).toHaveLength(1)
    expect(rows[0]!.tone).toBe("error")
    expect(rows[0]!.label).toMatch(/retry/i)

    // Retry re-calls the hook rather than offering the static list.
    rows[0]!.run()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(menu.opened).toHaveLength(3)
    expect(labelsOf(menu.opened[2]!)).toEqual(["Loading transitions…"])
  })

  it("serves a reopen from cache without calling the hook again", async () => {
    const fetch = vi.fn(async () => [live("Done", "21")])
    const first = menuDouble()
    opener("SHOP-103", fetch, first)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(labelsOf(first.opened.at(-1)!)).toEqual(["Finish"])

    // Reopen from the same status: no loading row, no second fetch.
    const second = menuDouble()
    opener("SHOP-103", fetch, second)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(second.opened).toHaveLength(1)
    expect(labelsOf(second.opened[0]!)).toEqual(["Finish"])
  })

  it("refetches from a different status", async () => {
    const fetch = vi.fn(async () => [live("Done", "21")])
    const first = menuDouble()
    opener("SHOP-104", fetch, first)
    await flush()
    expect(fetch).toHaveBeenCalledTimes(1)

    const second = menuDouble()
    opener("SHOP-104", fetch, second, { status: "In Review" })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(labelsOf(second.opened[0]!)).toEqual(["Loading transitions…"])
  })

  it("invalidates the ticket after a move runs, so the next open re-asks", async () => {
    shells.push({ cmd: "jira issue move SHOP-105 Done", resolve: true })
    const fetch = vi.fn(async () => [live("Done", "21")])
    const first = menuDouble()
    const { flashes } = opener("SHOP-105", fetch, first, { configured: [] })
    await flush()
    expect(cachedJiraMoves("SHOP-105", "In Progress")).toHaveLength(1)

    first.opened
      .at(-1)!
      .find((a) => a.label === "Done")!
      .run()
    await flush()
    expect(flashes).toContain("✓ Moved to Done")
    expect(cachedJiraMoves("SHOP-105", "In Progress")).toBeUndefined()

    const second = menuDouble()
    opener("SHOP-105", fetch, second, { configured: [] })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("executes the workflow's own name, with the resolution step where configured", async () => {
    shells.push({
      cmd: "jira issue move SHOP-106 Done --resolution Done",
      resolve: true,
    })
    const fetch = vi.fn(async () => [live("Done", "21")])
    const menu = menuDouble()
    opener("SHOP-106", fetch, menu)
    await flush()

    const finish = menu.opened.at(-1)!.find((a) => a.label === "Finish")!
    expect(finish.subActions!.map((a) => a.label)).toEqual(["Done"])
    finish.subActions![0]!.run()
    await flush()
    expect(invalidateJiraMoves("SHOP-106")).toBe(false)
  })

  it("drops a late answer when the menu has closed meanwhile", async () => {
    const gate = deferred<JiraAvailableTransition[]>()
    const menu = menuDouble()
    opener("SHOP-107", () => gate.promise, menu)

    menu.setUp(false)
    gate.resolve([live("Done", "21")])
    await flush()

    // Only the loading row ever opened; the late moves open nothing.
    expect(menu.opened).toHaveLength(1)
  })

  it("drops a superseded answer when a newer open is in flight", async () => {
    const first = deferred<JiraAvailableTransition[]>()
    const second = deferred<JiraAvailableTransition[]>()
    const pending = [first.promise, second.promise]
    let n = 0
    const fetch = vi.fn(() => pending[n++]!)
    const menu = menuDouble()
    opener("SHOP-108", fetch, menu)
    opener("SHOP-108", fetch, menu)

    first.resolve([live("Done", "21")])
    await flush()
    // The first answer arrives after the second open superseded it: dropped.
    expect(menu.opened).toHaveLength(2)

    second.resolve([live("Blocked", "41")])
    await flush()
    expect(labelsOf(menu.opened.at(-1)!)).toEqual(["Blocked"])
  })

  it("opens a single row when the workflow offers nothing", async () => {
    const menu = menuDouble()
    opener("SHOP-109", async () => [], menu)
    await flush()
    expect(menu.opened).toHaveLength(2)
    expect(menu.opened[1]).toHaveLength(1)
    expect(menu.opened[1]![0]!.label).toMatch(/no transitions/i)
  })
})

describe("buildActions without the hook", () => {
  beforeEach(() => {
    shells.length = 0
  })

  it("offers exactly today's static list", () => {
    const actions = buildActions(
      task("SHOP-110"),
      "kud",
      () => {},
      undefined,
      undefined,
      configured,
    )
    const move = actions.find((a) => a.label === "Move status")
    expect(move).toBeDefined()
    expect(labelsOf(move!.subActions!)).toEqual(["Start", "Finish"])
    expect(
      move!
        .subActions!.find((a) => a.label === "Finish")!
        .subActions!.map((a) => a.label),
    ).toEqual(["Done"])
  })

  it("executes the static move by name, as before", async () => {
    shells.push({
      cmd: "jira issue move SHOP-111 Done --resolution Done",
      resolve: true,
    })
    const actions = buildActions(
      task("SHOP-111"),
      "kud",
      () => {},
      undefined,
      undefined,
      configured,
    )
    const finish = actions
      .find((a) => a.label === "Move status")!
      .subActions!.find((a) => a.label === "Finish")!
    finish.subActions![0]!.run()
    await flush()
  })
})

describe("buildActions with the hook's opener", () => {
  it("carries no subActions and hands the task to the opener on run", () => {
    const seen: TaskRow[] = []
    const actions = buildActions(
      task("SHOP-112"),
      "kud",
      () => {},
      undefined,
      undefined,
      configured,
      undefined,
      undefined,
      undefined,
      { onOpenMove: (t) => seen.push(t) },
    )
    const move = actions.find((a) => a.label === "Move status")
    expect(move).toBeDefined()
    expect(move!.subActions).toBeUndefined()
    move!.run()
    expect(seen.map((t) => t.ticket)).toEqual(["SHOP-112"])
  })

  it("still shows Move status with a hook but no static list", () => {
    const actions = buildActions(
      task("SHOP-113"),
      "kud",
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { onOpenMove: () => {} },
    )
    expect(actions.some((a) => a.label === "Move status")).toBe(true)
  })

  it("shows no Move status with neither hook nor static list", () => {
    const actions = buildActions(task("SHOP-114"), "kud", () => {})
    expect(actions.some((a) => a.label === "Move status")).toBe(false)
  })
})
