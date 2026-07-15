// @kud/gh — surface-agnostic GitHub core. Transport primitives (gh CLI) plus
// per-concern domain modules (PR review comments today; health and webhook
// replay next). Every export is UI-agnostic: it shells out to `gh` and returns
// plain data, so a CLI, an Ink dashboard, or an MCP server all consume it alike.
export * from "./gh.js"
export * from "./pr.js"
export * from "./pr-comments.js"
export * from "./health.js"
export * from "./webhook.js"
