// What a delegated session is told to do — supplied by the host, because a
// prompt is a private vocabulary.
//
// These were four hardcoded templates naming `/k-pr` and `/k-project`: slash
// commands that exist for this package's author and for nobody else who
// installs it. Anyone else pressing `a` got an agent launched with a command it
// would refuse, and the failure surfaced inside the agent rather than here, so
// nothing in the cockpit looked wrong. Same class as the repo-priority and
// checkout-layout opinions removed in 0.20.0 of gh-ink, and missed for the same
// reason — it hid in a string rather than a constant.
//
// The launcher around them is generic: PATH detection, the two-step
// agent-then-placement choice, iTerm pane and tab placement, the cold-start
// notice. Twenty lines were personal out of two hundred and sixty that are not,
// so the fix is to lift those twenty out rather than drop the feature.
//
// Registered exactly like check drills, and for the same reason: what a host
// knows about its own tooling cannot be guessed from here. Nothing registered
// means the agent starts cold, which is the correct answer for a reader whose
// command vocabulary this process knows nothing about.

export type PromptContext = {
  kind: "pr" | "issue"
  number: number
  /** `owner/name` of the repo the row belongs to. */
  repo: string
  url: string
  /**
   * Readonly, matching `GHItem` — a prompt form reads the row's labels to word
   * itself and has no business reordering the array it was handed.
   */
  labels?: readonly string[]
}

export type PromptForms = {
  /**
   * For an agent the cockpit launches itself. It has already `cd`'d into the
   * checkout, so a repo-relative reference is safe here.
   */
  seed?: (ctx: PromptContext) => string | undefined
  /**
   * For the clipboard, addressed to a session whose working directory we do not
   * control. Every reference has to be repo-qualified or a URL — a bare number
   * resolves against whatever repo the reader happens to be sitting in.
   */
  portable?: (ctx: PromptContext) => string | undefined
}

let registered: PromptForms = {}

/** Supply the host's prompt forms. Call once, before rendering. */
export const registerPrompts = (forms: PromptForms): void => {
  registered = forms
}

/**
 * What a delegated agent is told when the host has registered nothing — prose
 * carrying a URL, and deliberately no command vocabulary at all.
 *
 * The registry above exists because four hardcoded `/k-pr` templates once
 * shipped inside this package. Lifting them out fixed WHO supplies the prompt
 * and left a subtler version standing: whoever supplies it writes it in some
 * dialect, and the launcher hands that same string to every agent. A slash
 * command is the sharpest case — Codex accepts a positional argument perfectly
 * well and cannot resolve `/k-pr 733` — but the trap is general. Any prompt
 * phrased in one agent's idiom fails in another's, and it fails INSIDE the
 * agent, minutes later, where nothing in the cockpit looks wrong.
 *
 * Prose sidesteps the whole class. Every agent worth launching can read a
 * sentence and fetch a URL, so the seed stops being a thing that must be matched
 * to a vocabulary and becomes a thing that simply works — which is what lets
 * CANDIDATES stay general rather than being narrowed to whichever agent the
 * host's dialect happened to suit.
 *
 * The default rather than the only option: a host with a genuine vocabulary can
 * still register `seed`, and takes on the matching problem knowingly when it
 * does. Silence used to mean a cold start, which was correct while the fallback
 * would have had to invent a command. It no longer has to.
 */
export const DEFAULT_SEED = (ctx: PromptContext): string =>
  ctx.kind === "pr"
    ? `Review the pull request at ${ctx.url}. Its branch is already checked out here.`
    : `Work on the issue at ${ctx.url}. Its repository is already checked out here.`

export const seedPromptFor = (ctx: PromptContext): string | undefined =>
  registered.seed?.(ctx) ?? DEFAULT_SEED(ctx)

// Falls back to the row's URL rather than to nothing. Pasting a bare link into a
// session that is already warm is the habit this key exists to save, it is
// portable by construction, and an agent given a URL can fetch the rest itself.
export const portablePromptFor = (ctx: PromptContext): string =>
  registered.portable?.(ctx) ?? ctx.url
