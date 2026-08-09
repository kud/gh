// @kud/gh — surface-agnostic GitHub core. Per-concern domain modules over the
// `gh` CLI. Every export is UI-agnostic: it shells out to `gh` and returns plain
// data, so a CLI, an Ink dashboard, or an MCP server all consume it alike.
//
// Transport policy — two ways to reach GitHub through `gh`, chosen per need:
//   • `gh <cmd> --json` (porcelain) for single-resource reads, branch→PR/repo
//     resolution, and workflow actions (merge/rerun/re-request) — simpler, and
//     gh already encapsulates the resolution and merge-method/branch logic.
//   • `gh api` GraphQL/REST (ghGraphql/ghRest) when the query must be shaped or
//     optimised — aggregations, precise nested selections, or operations with no
//     porcelain equivalent (review-thread resolve/reply, webhook delivery replay).
// The deciding test is "is there a query to optimise?": yes → gh api; no →
// porcelain.
export * from "./gh.js"
export * from "./inbox.js"
export * from "./pr.js"
export * from "./pr-comments.js"
export * from "./health.js"
export * from "./actions.js"
export * from "./webhook.js"
