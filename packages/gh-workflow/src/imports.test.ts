import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// This package's whole value is that a browser can import it. Nothing in the
// source says so — in the workspace `ink`, `zx` and `node:fs` are all installed,
// so an accidental import compiles, typechecks and passes every other test. The
// failure only appears in a consumer's bundle, which is the worst place to find
// it and the last place anyone looks.
//
// So the rule is asserted against the BUILT output, and it is asserted as a
// rule: an allowlist, not a list of things we happened to think of. A new
// forbidden import fails here rather than in a Next.js build log six weeks from
// now. Same reasoning as gh-cockpit's exports.test.ts, one layer down.

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist")

const ALLOWED = new Set(["@kud/gh/health"])

const jsFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? jsFiles(join(dir, e.name))
      : e.name.endsWith(".js")
        ? [join(dir, e.name)]
        : [],
  )

// Static `import x from "y"` / `export * from "y"`, plus dynamic `import("y")`.
const specifiersOf = (source: string): string[] =>
  [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
    (m) => m[1]!,
  )

describe("@kud/gh-workflow stays pure", () => {
  it("has been built", () => {
    expect(
      existsSync(dist),
      "dist/ is missing — run `npm run build` before this test",
    ).toBe(true)
  })

  it("imports nothing outside the allowlist", () => {
    const offenders = jsFiles(dist).flatMap((file) =>
      specifiersOf(readFileSync(file, "utf8"))
        .filter((s) => !s.startsWith(".") && !ALLOWED.has(s))
        .map((s) => `${file.slice(dist.length + 1)} → ${s}`),
    )
    expect(offenders).toEqual([])
  })

  it("names no renderer, transport or filesystem dependency", () => {
    const forbidden = /^(ink|react|zx|execa|node:|fs$|path$|os$|child_process$)/
    const offenders = jsFiles(dist).flatMap((file) =>
      specifiersOf(readFileSync(file, "utf8"))
        .filter((s) => forbidden.test(s))
        .map((s) => `${file.slice(dist.length + 1)} → ${s}`),
    )
    expect(offenders).toEqual([])
  })

  // Catches the other half: a module-scope read of something only a terminal
  // has. `gh-ink` evaluates `process.stdout.columns` at import time, which is
  // exactly the kind of thing that survives a static check and then throws — or
  // worse, silently yields undefined — in a server route.
  it("imports without touching a terminal", async () => {
    const stdout = process.stdout
    Object.defineProperty(process, "stdout", {
      value: undefined,
      configurable: true,
    })
    try {
      const mod = await import(join(dist, "index.js"))
      expect(typeof mod.whoseMove).toBe("function")
      expect(typeof mod.toGHItem).toBe("function")
    } finally {
      Object.defineProperty(process, "stdout", {
        value: stdout,
        configurable: true,
      })
    }
  })
})
