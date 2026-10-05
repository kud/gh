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

## Inbox extensions

A host contributes verbs and screens to the inbox through `InboxExtension`:

| Field       | What                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| `key`       | The keypress that opens it, matched after the inbox's own bindings, so an extension never shadows them.     |
| `scope`     | `"item"` acts on the selected row and earns a place in its action menu; `"global"` does not.                |
| `menuGroup` | `"act"` (does something to the row) or `"open"` (opens something); absent or `"other"` joins the quiet end. |
| `hint`      | Short footer label. The action menu capitalises it for the row ("submit" → "Submit"); the legend keeps `title`. |
| `icon`      | Nerd-font glyph for the menu row, as a `"\uF4FA"` escape. Shown only in nerd icon mode (see below).         |
| `body`      | `(onExit, target) => ReactNode` — rendered inside the inbox frame; claims header/footer via `useChrome`.    |

Nerd-font icons render only when the host calls `setIconMode("nerd")` from
`@kud/ink-ui` before the first render. In the default text mode the menu's icon
column is dropped entirely — no stand-in, nothing to align — so a terminal
without a Nerd Font loses nothing but decoration. The built-ins use these
codepoints; sibling host verbs should match them rather than invent neighbours:

| Verb                          | Codepoint |
| ----------------------------- | --------- |
| Submit / Resubmit              | U+F4FA / U+F46A |
| Land                           | U+F419    |
| Open PR / in browser / ticket  | U+F440 / U+F465 / U+F41B |
| Switch here / tab / pane       | U+EBCB / U+EAE4 / U+EB56 |
| Copy URL / repo / branch       | U+F44C / U+F401 / U+F418 |
| Unsubscribe / Mute / Remove reviewer | U+F478 / U+F466 / U+F468 |
| Close PR / and delete / issue  | U+F4DC / U+F48E / U+F41D |

## Development

```sh
npm run typecheck
npm run test
npm run build
```

## Licence

MIT © Erwann Mest
