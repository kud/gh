#!/usr/bin/env node
// Builds the web demo of one CLI in this workspace with cli-shot: a replay page
// and one asciicast per screen, written to packages/<name>/demo/ and served
// under kud.io/projects/<name>/demo.
//
//   node scripts/demo-build.mjs gh-pr-health
//
// A script rather than a one-line package.json entry because of build order:
// the CLI imports its siblings' dist/, and a fresh checkout — which is what a
// Vercel build is — has none, so they are built first, in the same order the
// root `build` script keeps for the same reason.
import { execFileSync } from "node:child_process"
import { existsSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const name = process.argv[2]
const pkg = join(root, "packages", name ?? "")
if (!name || !existsSync(join(pkg, "package.json"))) {
  console.error("usage: node scripts/demo-build.mjs <package directory name>")
  process.exit(2)
}

const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit" })

for (const ws of ["@kud/gh", "@kud/gh-workflow", "@kud/gh-ink", `@kud/${name}`])
  run("npm", ["run", "build", "-w", ws])

const out = join(pkg, "demo")
rmSync(out, { recursive: true, force: true })
// --settle 1200, not the default 350: a recording ends once the screen has
// held still that long, and on a loaded machine a CLI's pause between its
// loading frame and its data can outlast 350 ms — the cast then ends on
// "Fetching…" and the demo shows a page that never loads. It did exactly that
// to another CLI's first demo build.
run(
  "npx",
  [
    "--no-install",
    "cli-shot",
    "--out",
    out,
    "--format",
    "web",
    "--settle",
    "1200",
    "--title",
    name,
    "--base",
    `/projects/${name}/demo/`,
    "--",
    "node",
    join(pkg, "dist", "index.js"),
  ],
  pkg,
)
