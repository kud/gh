import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"

/*
 * The published export surface, tested against the BUILT dist rather than the
 * source — because the whole failure mode lives in the gap between them.
 *
 * `export * from "@kud/gh-ink"` in lib.ts typechecked, resolved from source
 * inside the workspace, and shipped 17 of ~26 exports to anybody who installed
 * it. esbuild cannot put a star re-export of an external package into ESM's
 * static export list, so tsup emitted a runtime __reExport shim instead and the
 * names never reached the module's exports. The .d.ts kept the star, so every
 * consumer's tsc agreed the symbols were there. `App` was `undefined`.
 *
 * Nothing in a source-level test can see that: import the source and the star
 * works. So this reads dist/index.js, which is the artefact users get.
 *
 * It does NOT need `npm pack` or an install into a temp dir, which was the first
 * instinct. The degradation is in the emitted module's own export list, not in
 * how @kud/gh-ink resolves, so it is visible from anywhere — verified by
 * reproducing the 17-export result directly off the workspace dist. Keeping it
 * offline and synchronous is what lets it run on every commit.
 */
const here = dirname(fileURLToPath(import.meta.url))
const distEntry = join(here, "..", "dist", "index.js")

describe("published export surface", () => {
  // A missing dist must FAIL rather than skip. This test's entire value is that
  // it runs against build output, and a version that quietly passes when there
  // is none would be green exactly when it has checked nothing — the shape CI
  // would keep green while the artefact broke again.
  it("has a built dist to test against", () => {
    expect(
      existsSync(distEntry),
      `dist/index.js missing — run \`npm run build\` first (CI builds before testing)`,
    ).toBe(true)
  })

  it("re-exports every value @kud/gh-ink exports", async () => {
    const [cockpit, ink] = await Promise.all([
      import(distEntry),
      import("@kud/gh-ink"),
    ])

    // Compared against gh-ink's own keys, never a hardcoded list. A copy would
    // drift the moment gh-ink gained an export, and drift silently in the same
    // direction as the bug: the list would agree with a surface that had
    // already stopped being complete.
    const missing = Object.keys(ink)
      .filter((k) => !(k in cockpit))
      .sort()

    expect(missing).toEqual([])
  })

  // The four that were actually undefined in 0.2.2, named so a regression says
  // which contract broke rather than printing a diff of sixty strings. App is
  // the one that fails loudest and latest — as a React component it survives
  // import and blows up at render with "Element type is invalid".
  it("resolves the entry points a host renders through", async () => {
    const cockpit = await import(distEntry)
    for (const name of ["App", "configureInbox", "layoutGHItems", "whoseMove"])
      expect(typeof cockpit[name], `${name} is not callable`).not.toBe(
        "undefined",
      )
  })
})
