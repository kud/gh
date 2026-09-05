// @kud/gh-workflow — the workflow half of a GitHub inbox, with no surface
// attached. Everything here is a total function over plain data, so a terminal
// renderer, a browser and a server route all consume it alike.
//
// The hard rule this package exists to keep: nothing in here may import a
// renderer, a transport or the filesystem. `imports.test.ts` asserts it against
// the BUILT output rather than the source, because in-workspace every forbidden
// dependency is installed and an accidental import simply succeeds.
export * from "./core.js"
export * from "./map.js"
export * from "./config.js"
