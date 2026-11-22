import { describe, it, expect } from "vitest"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  shellQuote,
  isSafeBranchName,
  checkoutCmdFor,
  switchCmd,
  fetchAndSwitchCmd,
} from "./shell.js"

// Branch names git accepts (each passes `git check-ref-format --branch`) that
// used to run a command when typed into the owner's shell bare.
const HOSTILE = [
  "x;touch${IFS}PWNED",
  'a"b`touch${IFS}PWNED`',
  "$(touch${IFS}PWNED)",
  "x|touch${IFS}PWNED",
  "x&&touch${IFS}PWNED",
  "it's{a}branch",
]

// Runs `line` in a real POSIX shell inside an empty directory, with git, gh and
// cd replaced by functions that print their arguments NUL-separated instead of
// acting. Returns each command's argv and whatever the directory holds after.
const runStubbed = (line: string) => {
  const dir = mkdtempSync(join(tmpdir(), "gh-ink-shell-"))
  const prelude = [
    `git() { printf 'git'; printf '\\0%s' "$@"; printf '\\n'; }`,
    `gh() { printf 'gh'; printf '\\0%s' "$@"; printf '\\n'; }`,
    `cd() { printf 'cd'; printf '\\0%s' "$@"; printf '\\n'; }`,
    `ls() { :; }`,
  ].join("\n")
  const r = spawnSync("sh", ["-c", `${prelude}\n${line}`], {
    cwd: dir,
    encoding: "utf8",
  })
  const calls = r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\0"))
  return { calls, files: readdirSync(dir) }
}

describe("shellQuote", () => {
  it.each(HOSTILE)("hands %j to the shell as exactly one argument", (b) => {
    const r = spawnSync("sh", ["-c", `printf '%s\\0' ${shellQuote(b)}`], {
      encoding: "utf8",
      cwd: mkdtempSync(join(tmpdir(), "gh-ink-q-")),
    })
    expect(r.stdout.split("\0").slice(0, -1)).toEqual([b])
  })
})

describe("isSafeBranchName", () => {
  it("agrees with git check-ref-format --branch", () => {
    const names = [
      ...HOSTILE,
      "main",
      "feat/thing",
      "dependabot/npm_and_yarn/zx-8.1.0",
      "a..b",
      "a b",
      "a~b",
      "a^b",
      "a:b",
      "a?b",
      "a*b",
      "a[b",
      "a\\b",
      "a\nb",
      "trailing/",
      "/leading",
      "a//b",
      "x.lock",
      "a/.hidden",
      "dot.",
      "a@{b",
      "",
    ]
    const git = spawnSync("git", ["--version"])
    if (git.status !== 0) return
    for (const name of names) {
      const ok =
        spawnSync("git", ["check-ref-format", "--branch", name]).status === 0
      expect([name, isSafeBranchName(name)]).toEqual([name, ok])
    }
  })

  it("refuses a leading dash, which git accepts but an option parser would not", () => {
    expect(isSafeBranchName("-x")).toBe(false)
    expect(isSafeBranchName("--upload-pack=x")).toBe(false)
  })

  // Not in the agreement list: inside a repository `--branch` reads a bare `@`
  // as HEAD and prints the current branch, so git's answer depends on the cwd.
  it("refuses a bare @, which is a revision alias and not a name", () => {
    expect(isSafeBranchName("@")).toBe(false)
  })
})

describe("switchCmd", () => {
  it.each(HOSTILE)("switches to %j and runs nothing else", (b) => {
    const { calls, files } = runStubbed(switchCmd(b))
    expect(calls).toEqual([["git", "switch", "--", b]])
    expect(files).toEqual([])
  })

  it("throws on a value that is not a branch rather than typing it", () => {
    expect(() => switchCmd("a\ntouch PWNED")).toThrow()
    expect(() => switchCmd("-c")).toThrow()
    expect(() => switchCmd("")).toThrow()
  })
})

describe("checkoutCmdFor", () => {
  it.each(HOSTILE)(
    "lands in the checkout and switches to %j, nothing more",
    (b) => {
      const line = checkoutCmdFor({ kind: "local", path: "/src/my repo" }, b)
      const { calls, files } = runStubbed(line)
      expect(calls).toEqual([
        ["cd", "/src/my repo"],
        ["git", "fetch", "origin", "--", b],
        ["git", "switch", "--", b],
      ])
      expect(files).toEqual([])
    },
  )

  it("quotes the clone base, slug and directory of a fresh clone", () => {
    const { calls } = runStubbed(
      checkoutCmdFor(
        {
          kind: "clone",
          cloneBase: "/src/$(x)",
          repoFull: "o/r",
          repoName: "r",
        },
        "",
      ),
    )
    expect(calls).toEqual([
      ["cd", "/src/$(x)"],
      ["gh", "repo", "clone", "o/r"],
      ["cd", "r"],
    ])
  })

  it("quotes the fork's clone URL and upstream", () => {
    const { calls } = runStubbed(
      checkoutCmdFor(
        {
          kind: "fork-clone",
          cloneBase: "/src",
          login: "me",
          forkName: "r",
          repoFull: "o/r",
        },
        "main",
      ),
    )
    expect(calls).toEqual([
      ["cd", "/src"],
      ["git", "clone", "git@github.com:me/r.git"],
      ["cd", "r"],
      ["git", "remote", "add", "upstream", "git@github.com:o/r.git"],
      ["git", "fetch", "origin", "--", "main"],
      ["git", "switch", "--", "main"],
    ])
  })

  it("keeps the fork-new directory lookup live", () => {
    const line = checkoutCmdFor(
      { kind: "fork-new", cloneBase: "/src", repoFull: "o/r" },
      "",
    )
    expect(line).toContain(`cd "$(ls -td -- */ | head -1)"`)
    expect(line).toContain(`gh repo fork 'o/r' --clone`)
  })

  it("throws on a branch that is not a branch", () => {
    expect(() => fetchAndSwitchCmd("a\nb")).toThrow()
    expect(() =>
      checkoutCmdFor({ kind: "local", path: "/x" }, "--orphan"),
    ).toThrow()
  })
})
