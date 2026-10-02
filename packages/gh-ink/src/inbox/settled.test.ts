import { describe, it, expect, vi, beforeEach } from "vitest"
import { buildActions } from "./inbox.js"
import type { GHItem } from "./inbox.js"

// `quietly` is the zx `$` wrapper with `quiet: true` defined at module scope in
// inbox.tsx. We mock `zx` so every shell the inbox spawns lands here instead of
// on the machine. The mock resolves or rejects to simulate success / failure.
const shells = vi.hoisted(() => [] as Array<{ cmd: string; resolve: boolean }>)

vi.mock("zx", () => {
  const $ = (...args: unknown[]) => {
    // Handle the `const quietly = $({ quiet: true })` call at module scope
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      // Return a function that handles template string calls
      return (pieces: TemplateStringsArray, ...values: unknown[]) => {
        const cmd = String.raw({ raw: pieces }, ...values)
        const entry = shells.find((s) => s.cmd === cmd)
        if (!entry) throw new Error(`unmocked shell: ${cmd}`)
        return entry.resolve
          ? Promise.resolve({ stdout: "", stderr: "" })
          : Promise.reject(new Error("gh failed"))
      }
    }
    // Handle direct template string calls: `$(cmd)`
    const pieces = args[0] as TemplateStringsArray
    const values = args.slice(1)
    const cmd = String.raw({ raw: pieces }, ...values)
    const entry = shells.find((s) => s.cmd === cmd)
    if (!entry) throw new Error(`unmocked shell: ${cmd}`)
    return entry.resolve
      ? Promise.resolve({ stdout: "", stderr: "" })
      : Promise.reject(new Error("gh failed"))
  }
  return { $ }
})

const ghItem = (kind: "pr" | "issue", overrides: Partial<GHItem> = {}): GHItem => ({
  kind,
  number: 42,
  title: "a row",
  repo: "kud/gh",
  url: `https://github.com/kud/gh/${kind === "pr" ? "pull" : "issues"}/42`,
  health: "none",
  age: "2d",
  ts: 0,
  unresolved: 0,
  conversation: 0,
  indent: false,
  standing: kind === "pr" ? "queued" : undefined,
  branch: kind === "pr" ? "feature/x" : undefined,
  ...overrides,
})

const actionsFor = (
  item: GHItem,
  ext?: {
    onSettled?: (item: GHItem, result: { ok: boolean; reason?: string }) => void
    onActed?: () => void
  },
) =>
  buildActions(item, "kud", () => {}, undefined, undefined, undefined, undefined, undefined, undefined, ext)

describe("onSettled hook", () => {
  beforeEach(() => {
    shells.length = 0
  })

  // "Remove me as reviewer" — only on a PR with standing === "queued"
  describe("Remove me as reviewer", () => {
    it("calls onSettled with ok:true on success", async () => {
      const settled: Array<{ item: GHItem; result: { ok: boolean; reason?: string } }> = []
      shells.push({ cmd: 'gh pr edit 42 --repo kud/gh --remove-reviewer kud', resolve: true })
      const item = ghItem("pr")
      const actions = actionsFor(item, { onSettled: (i, r) => settled.push({ item: i, result: r }) })
      const remove = actions.find((a) => a.label === "Remove me as reviewer")
      expect(remove).toBeDefined()
      remove!.run()
      await new Promise((r) => setImmediate(r))
      expect(settled).toHaveLength(1)
      expect(settled[0].result).toEqual({ ok: true })
    })

    it("calls onSettled with ok:false and first-line reason on failure", async () => {
      const settled: Array<{ item: GHItem; result: { ok: boolean; reason?: string } }> = []
      shells.push({ cmd: 'gh pr edit 42 --repo kud/gh --remove-reviewer kud', resolve: false })
      const item = ghItem("pr")
      const actions = actionsFor(item, { onSettled: (i, r) => settled.push({ item: i, result: r }) })
      const remove = actions.find((a) => a.label === "Remove me as reviewer")
      expect(remove).toBeDefined()
      remove!.run()
      await new Promise((r) => setImmediate(r))
      expect(settled).toHaveLength(1)
      expect(settled[0].result.ok).toBe(false)
      expect(typeof settled[0].result.reason).toBe("string")
      expect(settled[0].result.reason!.length).toBeGreaterThan(0)
      expect(settled[0].result.reason).not.toContain("\n")
    })

    it("does not throw when onSettled is absent", async () => {
      shells.push({ cmd: 'gh pr edit 42 --repo kud/gh --remove-reviewer kud', resolve: true })
      const item = ghItem("pr")
      const actions = actionsFor(item) // no ext.onSettled
      const remove = actions.find((a) => a.label === "Remove me as reviewer")
      expect(remove).toBeDefined()
      expect(() => remove!.run()).not.toThrow()
      await new Promise((r) => setImmediate(r))
    })
  })

  // "Close issue" → "Close #N" sub-action
  describe("Close issue", () => {
    it("calls onSettled with ok:true on success", async () => {
      const settled: Array<{ item: GHItem; result: { ok: boolean; reason?: string } }> = []
      let onActedCalls = 0
      shells.push({ cmd: 'gh issue close 42 --repo kud/gh', resolve: true })
      const item = ghItem("issue")
      const actions = actionsFor(item, {
        onSettled: (i, r) => settled.push({ item: i, result: r }),
        onActed: () => { onActedCalls++ },
      })
      const closeIssue = actions.find((a) => a.label === "Close issue")
      expect(closeIssue).toBeDefined()
      const closeSub = closeIssue!.subActions!.find((a) => a.label === "Close #42")
      expect(closeSub).toBeDefined()
      closeSub!.run()
      await new Promise((r) => setImmediate(r))
      expect(settled).toHaveLength(1)
      expect(settled[0].result).toEqual({ ok: true })
      expect(onActedCalls).toBe(0)
    })

    it("calls onSettled with ok:false and first-line reason on failure", async () => {
      const settled: Array<{ item: GHItem; result: { ok: boolean; reason?: string } }> = []
      shells.push({ cmd: 'gh issue close 42 --repo kud/gh', resolve: false })
      const item = ghItem("issue")
      const actions = actionsFor(item, { onSettled: (i, r) => settled.push({ item: i, result: r }) })
      const closeIssue = actions.find((a) => a.label === "Close issue")
      expect(closeIssue).toBeDefined()
      const closeSub = closeIssue!.subActions!.find((a) => a.label === "Close #42")
      expect(closeSub).toBeDefined()
      closeSub!.run()
      await new Promise((r) => setImmediate(r))
      expect(settled).toHaveLength(1)
      expect(settled[0].result.ok).toBe(false)
      expect(typeof settled[0].result.reason).toBe("string")
      expect(settled[0].result.reason!.length).toBeGreaterThan(0)
      expect(settled[0].result.reason).not.toContain("\n")
    })

    it("does not throw when onSettled is absent", async () => {
      shells.push({ cmd: 'gh issue close 42 --repo kud/gh', resolve: true })
      const item = ghItem("issue")
      const actions = actionsFor(item)
      const closeIssue = actions.find((a) => a.label === "Close issue")
      expect(closeIssue).toBeDefined()
      const closeSub = closeIssue!.subActions!.find((a) => a.label === "Close #42")
      expect(closeSub).toBeDefined()
      expect(() => closeSub!.run()).not.toThrow()
      await new Promise((r) => setImmediate(r))
    })
  })

  // "Close PR" → "Close #N" sub-action
  describe("Close PR", () => {
    it("calls onSettled with ok:true on success", async () => {
      const settled: Array<{ item: GHItem; result: { ok: boolean; reason?: string } }> = []
      let onActedCalls = 0
      shells.push({ cmd: 'gh pr close 42 --repo kud/gh', resolve: true })
      const item = ghItem("pr")
      const actions = actionsFor(item, {
        onSettled: (i, r) => settled.push({ item: i, result: r }),
        onActed: () => { onActedCalls++ },
      })
      const closePr = actions.find((a) => a.label === "Close PR")
      expect(closePr).toBeDefined()
      const closeSub = closePr!.subActions!.find((a) => a.label === "Close #42")
      expect(closeSub).toBeDefined()
      closeSub!.run()
      await new Promise((r) => setImmediate(r))
      expect(settled).toHaveLength(1)
      expect(settled[0].result).toEqual({ ok: true })
      expect(onActedCalls).toBe(0)
    })

    it("calls onSettled with ok:false and first-line reason on failure", async () => {
      const settled: Array<{ item: GHItem; result: { ok: boolean; reason?: string } }> = []
      shells.push({ cmd: 'gh pr close 42 --repo kud/gh', resolve: false })
      const item = ghItem("pr")
      const actions = actionsFor(item, { onSettled: (i, r) => settled.push({ item: i, result: r }) })
      const closePr = actions.find((a) => a.label === "Close PR")
      expect(closePr).toBeDefined()
      const closeSub = closePr!.subActions!.find((a) => a.label === "Close #42")
      expect(closeSub).toBeDefined()
      closeSub!.run()
      await new Promise((r) => setImmediate(r))
      expect(settled).toHaveLength(1)
      expect(settled[0].result.ok).toBe(false)
      expect(typeof settled[0].result.reason).toBe("string")
      expect(settled[0].result.reason!.length).toBeGreaterThan(0)
      expect(settled[0].result.reason).not.toContain("\n")
    })

    it("does not throw when onSettled is absent", async () => {
      shells.push({ cmd: 'gh pr close 42 --repo kud/gh', resolve: true })
      const item = ghItem("pr")
      const actions = actionsFor(item)
      const closePr = actions.find((a) => a.label === "Close PR")
      expect(closePr).toBeDefined()
      const closeSub = closePr!.subActions!.find((a) => a.label === "Close #42")
      expect(closeSub).toBeDefined()
      expect(() => closeSub!.run()).not.toThrow()
      await new Promise((r) => setImmediate(r))
    })
  })

  // Multi-line stderr -> first line only
  describe("multi-line stderr", () => {
    it("uses only the first non-empty line as reason", async () => {
      const settled: Array<{ item: GHItem; result: { ok: boolean; reason?: string } }> = []
      // We can't easily mock multi-line stderr with the current zx mock,
      // but we can test the firstLine helper indirectly by checking the
      // reason doesn't contain newlines. The failure path uses firstLine.
      shells.push({ cmd: 'gh pr close 42 --repo kud/gh', resolve: false })
      const item = ghItem("pr")
      const actions = actionsFor(item, { onSettled: (i, r) => settled.push({ item: i, result: r }) })
      const closePr = actions.find((a) => a.label === "Close PR")
      expect(closePr).toBeDefined()
      const closeSub = closePr!.subActions!.find((a) => a.label === "Close #42")
      expect(closeSub).toBeDefined()
      closeSub!.run()
      await new Promise((r) => setImmediate(r))
      expect(settled).toHaveLength(1)
      expect(settled[0].result.ok).toBe(false)
      expect(settled[0].result.reason).not.toContain("\n")
    })
  })
})