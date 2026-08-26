// Extensions bundled with the cockpit, exported from `@kud/gh-cockpit/extensions`
// rather than the root.
//
// A separate entry point because extensions are a CHOICE, not a default. Rolled
// into the root export they would arrive with every install whether the reader
// wanted them or not, and each one adds a keybinding to a surface where every
// key is already spoken for. Importing one is how you say yes to it.
//
// Both of these are surface-only: they act on the row under the cursor and shell
// out to nothing, so they carry no assumption about what a reader has installed.
// Anything that does — a build server, a ticket tracker, an agent runner —
// belongs in the host that owns it, passed through `extensions` in the config.
export { delegateExtension } from "./delegate.js"
export { copyPromptExtension } from "./copy-prompt.js"
