# @kud/gh-ink

Controlled [Ink](https://github.com/vadimdemedes/ink) components for rendering
GitHub PR domain objects in the terminal. Presentation-first: data comes in as
props (the consuming surface owns the fetch), mutations run against
[`@kud/gh`](../gh). Built on [`@kud/ink-ui`](https://github.com/kud/ink-ui).

Consumed by the standalone `gh-pr-*` CLIs **and** by cockpit — one component, many
surfaces.

## Install

```sh
npm install @kud/gh-ink @kud/gh
```

`ink` and `react` are peer dependencies.

## Exports

| Export                                          | What                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CommentsPanel` (`CommentsPanelProps`)          | Selectable review-thread + conversation panel — resolve (`x`), reply (`r`), show/hide resolved (`R`).                     |
| `healthDisplay` / `healthGlyph` / `healthColor` | Map a `@kud/gh` `Health` token → glyph + `@kud/ink-ui` colour. Glyph distinguishes (colourblind-safe); colour reinforces. |
| `healthLegend`                                  | Ordered `[Health, label]` pairs for a help legend.                                                                        |
| `renderMarkdown`                                | GitHub-flavoured markdown → styled terminal lines.                                                                        |

## Design

Every component is controlled — the parent owns loading and passes `data` in — so
the same panel drops into a full-screen CLI or a single pane of a dashboard. The
core (`@kud/gh`) decides the semantic token; this layer maps it to a colour. Same
seam as `@kud/jenkins` → `@kud/jenkins-ink`.

## Development

```sh
npm run typecheck
npm run test
npm run build
```

## Licence

MIT © Erwann Mest
