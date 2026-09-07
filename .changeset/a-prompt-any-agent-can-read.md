---
"@kud/gh-cockpit": patch
---

The delegated agent is seeded with plain prose carrying the URL, so every agent can be offered again.

`registerPrompts` was introduced because four hardcoded `/k-pr` templates once shipped inside this package: a stranger pressing `a` launched an agent with a command it would refuse, and the failure surfaced inside the agent rather than here. Lifting them out fixed **who supplies** the prompt and left a subtler version standing — whoever supplies it writes it in some dialect, and the launcher hands that one string to whichever agent was chosen.

A slash command is the sharpest case. Codex accepts a positional argument perfectly well and cannot resolve `/k-pr 733`, so it passed every check the code made and opened on a string it could not read — failing minutes later, inside the agent, with nothing in the cockpit looking wrong. opencode at least declared its cold start on screen.

The first repair was to narrow the agent table to the one agent whose vocabulary the seed happened to suit. **That was wrong and is reverted.** A published package offering only the agent its author uses is the same defect as shipping that author's slash commands, approached from the other end — and it is tempting precisely because it makes the symptom disappear. A spec now guards against it.

The right repair is to the seed. `DEFAULT_SEED` is prose — _"Review the pull request at &lt;url&gt;. Its branch is already checked out here."_ — which belongs to no agent's idiom, so there is nothing left to fail to understand and the table can stay general.

That also changes what silence means. An unregistered host used to get a cold start, correct while any fallback would have had to invent a command. It no longer has to, so a fresh install now gets a working handoff rather than an empty one, and a host with a genuine vocabulary can still register `seed` and take on the matching problem knowingly.

`acceptsPrompt` comes back with all three agents, because it was answering an honest question: whether the binary takes a positional prompt at all. opencode's positional is a path, and that is true of every install. What it never answered — whether the prompt means anything once it arrives — is the question prose retires. The distinction is now written where the flag is, since deleting it was the wrong lesson to draw from the bug.

`portablePromptFor` is untouched. The clipboard is pasted by hand into a session that is already open, so the host knows which agent is receiving it; the launcher picks from a list and does not.
