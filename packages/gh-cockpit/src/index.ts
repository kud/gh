export { defineCockpit } from "./config.js"
export type {
  CockpitConfig,
  TabSpec,
  TabSearch,
} from "./config.js"
export { parseArgs, hasPatterns, type CockpitArgs } from "./args.js"
export {
  registerCheckDrills,
  checkDrillFor,
  type CheckDrill,
  type CheckDrillContext,
} from "./views/check-drill.js"
export { detailFor } from "./views/detail.js"
// A host registering its own CheckDrill renders inside the cockpit's frame, so it
// needs the same chrome the built-in drills use — without this the only way to
// match them is to reimplement the border, title and footer by eye.
export { DrillView } from "./views/drill-view.js"
export { PrView } from "./views/pr-view.js"
export { IssueView } from "./views/issue-view.js"
export * from "./lib.js"
