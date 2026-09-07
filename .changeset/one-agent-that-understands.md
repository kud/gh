---
"@kud/gh-cockpit": patch
---

The AI launcher offers only agents that understand the prompt it hands them, which today means Claude Code alone.

The launch table carried three agents behind an `acceptsPrompt` flag, and the flag modelled the wrong question. It said whether a binary takes a positional argument at all — `claude [prompt]` and `codex [PROMPT]` do, while opencode's positional is a path, so appending a prompt made it try to start in a directory called `/k-pr 42`. All true, and beside the point: **taking an argument is not understanding one.**

The seed comes from the host via `registerPrompts`, written in the host's own vocabulary. ambre seeds `/k-pr 733` — a Claude Code slash command. So:

```
claude    takes a positional, understands the prompt   → worked
opencode  positional is a PATH, no prompt at all       → started cold, and said so
codex     takes a positional, understands nothing      → opened on a string it could not resolve
```

Codex was the bad one _because_ it passed the flag. opencode's limitation was declared on screen; Codex's failure landed inside the agent, minutes later, with nothing in the cockpit looking wrong — which is the exact failure mode `prompts.ts`' own header was written about, shipped again one layer down. That header generalised **who supplies** the prompt and never addressed that one string was being handed to agents with different command vocabularies.

So the flag is gone and the table holds one row. The invariant that replaces it is stated where the table is, and pinned by a spec that fails the moment a second row appears: **every agent here understands the host's seed.** Adding one means answering that question, not checking whether the binary accepts an argument.

The general fix is a host-registered agent table paired with the prompt forms, since a prompt and the vocabulary it is written in are one fact. Deliberately not built: standing machinery for a package with no installers, serving a divergence that does not exist while the list has one row in it.

**The prompt line is drawn only where it will be used.** It used to render unconditionally and then apologise underneath — `opencode takes no prompt — starts cold` — putting a value and its retraction on screen at the same dim weight, so the line that mattered was the one styled as skippable. A seed that is not going to be sent is simply not drawn, which also covers `Shell (no AI)`, where the old panel showed a prompt it was never going to pass on.

Nothing changes for the copy-prompt path, which was always the half that worked: it addresses a session already warm elsewhere, and `portablePromptFor` is untouched.
