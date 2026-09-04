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

export const seedPromptFor = (ctx: PromptContext): string | undefined =>
  registered.seed?.(ctx)

// Falls back to the row's URL rather than to nothing. Pasting a bare link into a
// session that is already warm is the habit this key exists to save, it is
// portable by construction, and an agent given a URL can fetch the rest itself.
export const portablePromptFor = (ctx: PromptContext): string =>
  registered.portable?.(ctx) ?? ctx.url
