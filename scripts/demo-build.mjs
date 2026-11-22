#!/usr/bin/env node
// Builds the web demo of one CLI in this workspace with cli-shot: a replay page
// and one asciicast per screen, written to packages/<name>/demo/ and served
// under kud.io/projects/<name>/demo.
//
//   node scripts/demo-build.mjs gh-pr-health
//
// cli-shot is fetched from git and built here rather than installed as a
// dependency, and that is not a preference. `--format web` is on cli-shot's
// main but not yet on npm, and the repository commits no dist/ and has no
// `prepare` script — so a `github:` devDependency or `npx github:…` installs a
// package whose bin points at a file that does not exist. Once a release
// carrying `--format web` is on npm, this collapses to a devDependency on
// @kud/cli-shot and a one-line script, and this file should go.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const name = process.argv[2]
const pkg = join(root, "packages", name ?? "")
if (!name || !existsSync(join(pkg, "package.json"))) {
  console.error("usage: node scripts/demo-build.mjs <package directory name>")
  process.exit(2)
}

const REPO = "https://github.com/kud/cli-shot"
const REF = process.env.CLI_SHOT_REF ?? "main"

const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit" })

// The CLI and everything it imports, in dependency order — the same prelude
// the root `build` script keeps, for the same reason: a fresh checkout has no
// dist/ anywhere, and a sibling built before its dependency fails.
for (const ws of ["@kud/gh", "@kud/gh-workflow", "@kud/gh-ink", `@kud/${name}`])
  run("npm", ["run", "build", "-w", ws])

// Keyed by ref so switching branches never reuses a stale build. Not under
// node_modules/.cache, the usual home for this: TypeScript treats anything
// below a node_modules directory as an external package, and cli-shot's own
// declaration build then fails with a bare "Error parsing" on its index.ts.
const cache = join(root, ".cache", "cli-shot", REF.replace(/\W+/g, "-"))
const bin = join(cache, "dist", "cli.js")
if (!existsSync(bin)) {
  rmSync(cache, { recursive: true, force: true })
  mkdirSync(dirname(cache), { recursive: true })
  run("git", ["clone", "--quiet", "--depth", "1", "--branch", REF, REPO, cache])
  run("npm", ["ci", "--no-audit", "--no-fund"], cache)
  run("npm", ["run", "build"], cache)
}

const out = join(pkg, "demo")
rmSync(out, { recursive: true, force: true })
run("node", [
  bin,
  "--out",
  out,
  "--format",
  "web",
  "--title",
  name,
  "--base",
  `/projects/${name}/demo/`,
  "--",
  "node",
  join(pkg, "dist", "index.js"),
])
