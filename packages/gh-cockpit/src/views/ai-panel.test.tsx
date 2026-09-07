import { describe, expect, it } from "vitest"

import { CANDIDATES } from "./ai-panel.js"

/*
 * WHAT MAY SIT IN THE LAUNCH TABLE.
 *
 * This used to guard an `acceptsPrompt` flag across three agents, on the
 * reasoning that a seeded prompt is not a uniform trailing argument: `claude
 * [prompt]` and `codex [PROMPT]` take one, while opencode's positional is a
 * PATH so appending a prompt made it try to start in a directory called
 * "/k-pr 42".
 *
 * All true, and aimed at the wrong question. Taking an argument is not
 * understanding one. The seed comes from the HOST (`registerPrompts`) and is
 * written in the host's own vocabulary — ambre seeds `/k-pr 733`, a Claude Code
 * slash command — so Codex passed the flag, was handed the prompt, and opened on
 * a string it could not resolve. opencode at least declared its limitation on
 * screen; Codex failed silently, inside the agent, minutes later.
 *
 * So the flag is gone and the table holds only agents that understand the seed.
 * What is pinned here is that invariant, because it cannot be read off the type:
 * nothing about `{ id, label, cmd }` says "and this one speaks the host's
 * language", and the next person to add a row will be looking at a binary that
 * takes a positional argument and thinking that settles it.
 */

describe("CANDIDATES", () => {
  it("offers Claude Code, whose vocabulary the seed prompt is written in", () => {
    expect(CANDIDATES.map((a) => a.id)).toContain("claude")
  })

  /*
   * The guard rail, and it is deliberately blunt.
   *
   * A second entry is not forbidden in principle — it is forbidden until someone
   * has answered "does this agent understand what the host seeds?", which is a
   * question about a prompt registry rather than about a binary. Failing here is
   * the prompt to go and answer it, and to read the note above CANDIDATES on why
   * the general fix (a host-registered agent table) was ruled out rather than
   * forgotten.
   */
  it("holds only agents that understand the host's seed", () => {
    expect(CANDIDATES).toHaveLength(1)
  })

  it("carries no flag claiming an agent merely accepts an argument", () => {
    // `acceptsPrompt` modelled the wrong question and its absence is the fix, so
    // its return would be a regression rather than an addition.
    for (const agent of CANDIDATES)
      expect(Object.keys(agent)).toEqual(["id", "label", "cmd"])
  })
})
