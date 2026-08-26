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
export { PrView } from "./views/pr-view.js"
export { IssueView } from "./views/issue-view.js"
export * from "./lib.js"
