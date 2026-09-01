---
"@kud/gh-cockpit": minor
---

What a delegated agent is told to do is now the host's to say.

`seedPromptFor` and `portablePromptFor` wrote four templates naming `/k-pr` and
`/k-project`. Those are slash commands this package's author has and nobody else
does, so `a` on a fresh install launched an agent and handed it a command it
would refuse. The failure surfaced inside the agent, in a pane that had just
opened, rather than in the cockpit — so nothing here looked wrong, and the
reader was left to work out that the TUI had seeded the nonsense.

Same class as the repo priority and checkout layout taken out of `gh-ink` in
0.20.0, and missed in the same sweep for the same reason: an opinion in a string
does not read as an opinion. A constant gets audited; a template literal in the
middle of a launcher does not.

The obvious fix was to delete the panel, and it was the wrong size. Twenty lines
of `ai-panel.tsx` were personal out of two hundred and sixty-seven. The rest —
detecting which of `claude`, `opencode` and `codex` are actually on PATH, the
two-step agent-then-placement choice, iTerm pane and tab placement, the notice
that opencode takes no prompt and starts cold — carries no opinion about anyone's
tooling and is the part worth having. Dropping it to remove the templates would
have cost every future reader a working launcher to spare them a bad string.

So `registerPrompts({ seed, portable })`, shaped exactly like
`registerCheckDrills` beside it. Two forms rather than one because they are
addressed to different places: `seed` reaches an agent the cockpit has already
`cd`'d into the checkout, so a repo-relative reference is safe, while `portable`
lands on the clipboard and gets pasted somewhere unknown, where a bare number
resolves against whatever repo the reader happens to be sitting in.

The defaults are the point. Nothing registered means `seed` returns nothing and
the agent opens cold in the right checkout, which is a real feature rather than
a degraded one. `portable` falls back to the row's URL — a link pasted into a
session that is already warm is the habit `y` exists to serve, it is portable by
construction, and an agent handed a URL can fetch the rest itself.

`registerPrompts` is the fourth way a host configures this package, after
`configureInbox`, `registerCheckDrills` and `defineCockpit`'s config object.
That is one too many and the honest consolidation is folding the registries into
the config object that already exists. Not here: this release fixes published
code that misbehaves for everyone but its author, and the tidy is a separate
change with a separate blast radius.
