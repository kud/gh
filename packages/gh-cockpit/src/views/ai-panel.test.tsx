import { describe, expect, it } from "vitest"

import { CANDIDATES } from "./ai-panel.js"

/*
 * `acceptsPrompt` is the one flag on the launch table that is NOT uniform, and
 * it reads as an oversight cold — which is exactly what invites the "simplify it
 * to one trailing suffix" edit. `claude [prompt]` and `codex [PROMPT]` take a
 * seeded prompt and stay interactive; opencode's positional is `[project]`, a
 * PATH, so appending a prompt there makes it try to start in a directory named
 * after the sentence, and its message form `opencode run` is headless, throwing
 * away the conversation the handoff exists to open.
 *
 * WHAT THE FLAG DOES NOT MEAN, which cost a round trip to learn. It answers
 * "does the binary take a positional prompt", never "will the prompt mean
 * anything once it arrives". While the seed was a Claude Code slash command
 * those came apart: Codex passed this flag, was handed `/k-pr 733`, and opened
 * on a string it could not resolve — failing inside the agent, minutes later,
 * with nothing in the cockpit looking wrong.
 *
 * The repair was to the SEED, not to this table. It is prose now, so the second
 * question has no teeth and the table can stay general. Narrowing it to one
 * agent — which is what was tried first — would bake one host's vocabulary into
 * a published package, the very mistake `prompts.ts` exists to undo.
 *
 * `id` is the key the assertions hang on, so a rename would make them pass
 * vacuously: prove the ids are still present first.
 */

const idsOf = () => CANDIDATES.map((a) => a.id)
const accepts = (id: string) =>
  CANDIDATES.find((a) => a.id === id)?.acceptsPrompt

describe("CANDIDATES", () => {
  it("still carries the three ids the assertions below hang on", () => {
    expect(idsOf()).toEqual(
      expect.arrayContaining(["claude", "opencode", "codex"]),
    )
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

  /*
   * The guard against the repair that was tried and reverted. A published
   * package offering only the agent its author happens to use is the same defect
   * as shipping that author's slash commands, approached from the other end —
   * and it is tempting precisely when a prompt has gone wrong, because it makes
   * the symptom disappear.
   */
  it("offers every agent it knows how to launch, not just one", () => {
    expect(CANDIDATES.length).toBeGreaterThan(1)
  })
})
