import { describe, expect, it } from "vitest"

import { CANDIDATES } from "./ai-panel.js"

/*
 * `acceptsPrompt` is the one flag on the launch table that is NOT uniform, and
 * it reads as an oversight cold — which is exactly what invites the "simplify
 * it to one trailing suffix" edit. `claude [prompt]` and `codex [PROMPT]` take
 * a seeded prompt and stay interactive; opencode's positional is `[project]`,
 * a PATH, so appending a prompt there makes it try to start in a directory
 * called "/k-pr 42", and its message form `opencode run` is headless, throwing
 * away the conversation the handoff exists to open.
 *
 * ambre's `tests/cockpit-delegate.zsh` used to guard this against the host's
 * own copy of the table. The repoint (kud/gh#33) deleted that file and moved
 * CANDIDATES here, where it is not on the public `index.ts` — so the guard has
 * to live beside it. `id` is the key the assertions hang on, so a rename would
 * make all three pass vacuously: prove the ids are still present first.
 */

const idsOf = () => CANDIDATES.map((a) => a.id)
const accepts = (id: string) => CANDIDATES.find((a) => a.id === id)?.acceptsPrompt

describe("CANDIDATES", () => {
  it("still carries the three ids the assertions below hang on", () => {
    expect(idsOf()).toEqual(expect.arrayContaining(["claude", "opencode", "codex"]))
  })

  it("seeds a prompt into claude, whose positional is the prompt", () => {
    expect(accepts("claude")).toBe(true)
  })

  it("seeds a prompt into codex, whose positional is the prompt", () => {
    expect(accepts("codex")).toBe(true)
  })

  it("refuses to seed a prompt into opencode, whose positional is a path", () => {
    expect(accepts("opencode")).toBeFalsy()
  })
})
