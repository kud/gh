import type { GHItem } from "./lib.js"

// What the cockpit does after the viewer answers a decision from a drill.
//
// Supplied by the host, because the follow-through is a private vocabulary.
// The drill posts the answer as a comment and then calls `answered` — typically
// to clear the host's own decision label, whatever it is called. The package
// must not know the label's name: naming it here would compile one host's
// convention into a published library, the same defect `registerPrompts` and
// `registerCheckDrills` exist to undo — a prompt dialect in one case, a CI
// system in the other.
//
// Registered exactly like those two, and for the same reason: what a host
// knows about its own workflow cannot be guessed from here. Nothing registered
// means the answer is posted and nothing follows, which is the correct answer
// for a reader whose labelling this process knows nothing about.

/**
 * What the hook is told: the item's identity and labels, which is what a label
 * is cleared by. Not the full row — the issue drill holds only a subset of one,
 * and a hook that needs more is better off asking GitHub than trusting a row
 * cached before the answer was posted.
 */
export type DecisionTarget = Pick<
  GHItem,
  "repo" | "number" | "url" | "labels"
> & {
  kind: "pr" | "issue"
}

export type DecisionHooks = {
  /** Called after an answer posted from a drill view. */
  answered?: (target: DecisionTarget) => void | Promise<void>
}

let registered: DecisionHooks = {}

/** Supply the host's decision follow-through. Call once, before rendering. */
export const registerDecisionHooks = (hooks: DecisionHooks): void => {
  registered = hooks
}

export const decisionHooks = (): DecisionHooks => registered
