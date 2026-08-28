# @kud/gh — working notes

An npm-workspaces monorepo behind cockpit. Six packages, one direction of flow:

```
@kud/gh          surface-agnostic core — shells out to `gh`, returns plain data
  └ @kud/gh-ink  Ink components, the inbox, and the whose-move bands
      └ @kud/gh-cockpit  the host that assembles sections
@kud/gh-pr-comments · gh-pr-health · gh-webhook-replay   thin CLIs over the core
```

Nothing in the core knows about a terminal. Colour and glyph are the consuming
surface's vocabulary; the core decides only which semantic token applies.

## The comment register is the documentation

Files here carry long rationale comments, and several of them name a specific
regression with its date. That is deliberate and it is the only place the
reasoning lives — there is no design doc behind them. Two consequences:

- **Read the comment above a function before changing the function.** Most of
  the non-obvious code is non-obvious on purpose, and the comment says why the
  obvious version was wrong.
- **Match the register when you add to it, and never trim it as noise.** The
  test the repo applies is whether a competent reader could reintroduce a real
  bug without the comment. Where the answer is yes, the history stays — past
  tense included.

`whoseMove` in `packages/gh-ink/src/inbox/inbox.tsx` is the worked example.

## A change to the health classifiers ripples

`packages/gh/src/health.ts` holds four predicates over a single check —
`isFailCheck`, `isPendingCheck`, `isInconclusiveCheck`, `isPassCheck` — and
`computeHealth`, which collapses a PR to one `Health` token. They partition
GitHub's `CheckConclusionState`, so moving a conclusion between them is never
local:

- `computeHealth`'s precedence ladder turns it into a different token, and
- `YOURS` in `gh-ink`'s inbox turns that token into **Your move** or **Their
  move**, differently depending on which of three standings the row arrived
  from.

So a one-line edit to a predicate changes which band a PR lands in. Pin both
ends when you touch one: `packages/gh/src/health.test.ts` for the token,
`packages/gh-ink/src/inbox/bands.test.ts` for the band.

> [!IMPORTANT]
> `isFailCheck` has a second consumer that is easy to miss: `retrigger` in
> `packages/gh-ink/src/components/health-panel.tsx` finds the run behind the `r`
> key through it. Narrowing the predicate silently narrows the affordance.

## Cockpit does not compile against its workspace siblings

`packages/gh-cockpit` resolves `@kud/gh-ink` to a **published** copy from the
registry, not to the sibling in this repo. Three packages pin
`@kud/ink-ui@0.8.0` while `gh-ink` and `gh-cockpit` pin `0.14.0`, so npm hoists
0.8.0 and nests a registry `gh-ink` under cockpit to satisfy the conflict.

The practical rule: **a change that adds to `gh-ink`'s exported types cannot be
consumed by cockpit in the same commit.** Cockpit's half waits for `gh-ink` to
publish. Typecheck catches it, but only after a clean install — a stale
`node_modules` hides it and shows unrelated `@kud/ink-ui` errors instead. When
the typecheck errors look impossible, run `npm ci` before believing them.

## Gates

`npm run build` · `npm run typecheck` · `npm test`. That is the whole of CI
(`.github/workflows/ci.yml`) and there is no linter. Build first — packages
consume each other's `dist`, so a stale build makes typecheck lie.

## Changesets

Every behaviour change gets one, and it lands as **its own commit** after the
commit it describes:

```
🐛 fix(health): stop treating cancelled checks as failures
📝 docs(changeset): add cancelled-is-not-failed changeset
```

The body is prose, not a bullet — what was wrong, what it cost, and what now
happens instead. Read `.changeset/*.md` for the register before writing one.
