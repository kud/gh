// @kud/gh-ink — controlled Ink components for rendering GitHub PR domain objects.
// Presentation-first: data comes in as props (the consuming surface owns the
// fetch, so it can show counts and share a cache), mutations run against @kud/gh.
// Built on @kud/ink-ui primitives; fed by @kud/gh types. Compose into a full CLI
// or a single pane of a larger dashboard alike.
export {
  CommentsPanel,
  type CommentsPanelProps,
} from "./components/comments-panel.js"
export {
  HealthPanel,
  type HealthPanelProps,
} from "./components/health-panel.js"
export {
  SidePanel,
  SIDEBAR_COLS,
  railCapacity,
  counts,
  type Sidebar,
  type SidebarRow,
} from "./components/side-panel.js"
export { renderMarkdown } from "./lib/markdown.js"
export {
  healthDisplay,
  healthGlyph,
  healthColor,
  healthLegend,
} from "./lib/health-display.js"

// The inbox shell — see ./inbox for what the host supplies.
export * from "./inbox/index.js"
