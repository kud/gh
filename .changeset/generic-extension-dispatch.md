---
"@kud/gh-ink": minor
---

Make `InboxExtension.key` a real binding. `BrowseScreen` now receives the `extensions` array and dispatches on each extension's declared `key`, replacing a hardcoded `input === "J"` arm that could only ever open Jenkins — so a second extension could declare a key and nothing would read it.

`ExtensionTarget` replaces the bare `string` that `body` received. It carries `{ item?: AnyItem; ciJob?: string; login: string }`, so a row-scoped extension gets the selected row (which no string could carry) while Jenkins keeps reading its job name. Both contexts travel together rather than being chosen by inspecting the extension's id, which would make `key` decorative again. `login` rides along because extensions are declared at module scope, before the viewer has been fetched, so a body cannot close over it.

Extensions are matched below every built-in binding, so a declared key cannot shadow navigation, refresh or quit, and above the active-row guard, so a domain-scoped extension still opens on an empty tab.

**Breaking for extension authors:** `body(onExit, target)` now receives `ExtensionTarget | undefined` instead of `string | undefined`. A Jenkins-style extension reads `target?.ciJob` where it previously used `target`.
