---
"@kud/gh-cockpit": minor
---

Initial release

A configurable GitHub cockpit for the terminal: your PRs, reviews and issues in
one Ink TUI, banded by whose move it is rather than merely grouped by repo.

A library rather than a CLI — you write the thin entry point, because which
searches are tabs, which repos rank first and what a check drills into are not
portable decisions.

- `defineCockpit` — typed config, so a wrong tab or standing fails at build
  rather than rendering an empty tab.
- `parseArgs` — `--here` (scopes the query server-side via `repo:`), plus
  `--include` / `--exclude` glob filtering and positional named filters.
- `registerCheckDrills` — CI drill-ins are host-supplied. GitHub Actions is built
  in; anything else opens in a browser unless you register a viewer.
- `@kud/gh-cockpit/extensions` — bundled extensions behind their own entry point,
  since each one claims a keybinding and should be opted into.
