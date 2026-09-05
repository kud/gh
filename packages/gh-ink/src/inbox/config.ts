/*
 * Host configuration moved to @kud/gh-workflow — it was always pure mechanism,
 * and the web surface needs the same registry. This file stays as the address
 * gh-ink's own modules already import.
 *
 * Named, not `export *`, and the distinction is not stylistic. A star re-export
 * of an EXTERNAL package is the exact shape that shipped 17 undefined exports
 * from gh-cockpit once already: `tsc --noEmit` resolves it perfectly and tsup's
 * DTS build cannot, so it passes every local check and fails in the build. It
 * did exactly that here too, one commit ago.
 *
 * Types are starred below because type-only re-exports are erased before
 * esbuild sees them, so they never hit the degradation.
 */
export {
  configureInbox,
  inboxConfig,
  resetInboxConfig,
  profileOf,
  checkoutDirs,
} from "@kud/gh-workflow"

export type { InboxConfig, RepoProfile } from "@kud/gh-workflow"
