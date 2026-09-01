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

## Cockpit compiles against the workspace, so build order is load-bearing

`packages/gh-cockpit` resolves `@kud/gh-ink` to the **sibling in this repo**, not
to a published copy: it pins the exact version the workspace carries, changesets
bumps both in lockstep on every release, and npm therefore links
`node_modules/@kud/gh-ink` straight at `packages/gh-ink`. The same holds for
`@kud/gh` and for the three thin CLIs. Only `@kud/ink-ui` still nests — three
packages pin `0.8.0` against `gh-ink` and `gh-cockpit`'s `0.14.0`, so npm hoists
0.8.0 and gives those two their own copy.

The good half: **a change to `gh-ink`'s exported types is consumable by cockpit
in the same commit.** Nothing waits for a publish.

The cost: cockpit's build needs `gh-ink/dist` to already exist, and
`workspaces: ["packages/*"]` expands ALPHABETICALLY — `gh-cockpit` before
`gh-ink`. So the root `build` script builds `@kud/gh` and `@kud/gh-ink`
explicitly first, then sweeps `--workspaces`. Keep that prelude when you touch
the script, and extend it if a new package acquires dependents.

> [!IMPORTANT]
> This is invisible locally and fatal in CI. A previous build leaves
> `packages/*/dist` on disk, so any order works on your machine; a fresh
> checkout has none, and cockpit fails with `Cannot find module '@kud/gh-ink'`
> or a burst of `has no exported member` errors from `lib.js`. To reproduce
> what CI sees, delete every `dist/` first. This was red on `main` from
> 2026-08-28 to 2026-09-01, taking the release train down with it, and every
> local check passed throughout.

Both halves of this changed with the lockfile sync in `dc6cab3`: cockpit used to
pin a `gh-ink` the workspace did not carry, which is what made npm nest a
registry copy and hid the ordering problem. **When a lockfile falls behind the
package.json versions, expect this to come back** — the entry to check is
whether `node_modules/@kud/gh-ink` in `package-lock.json` says `link: true`.

## Gates

`npm run build` · `npm run typecheck` · `npm test`. That is the whole of CI
(`.github/workflows/ci.yml`) and there is no linter. Build first — packages
consume each other's `dist`, so a stale build makes typecheck lie, and in the
right order for the reason above.

Several of the Ink tests mount a real terminal and wait on real timers
(`transit.test.tsx`, `merged.test.tsx`, `leaving.test.tsx`), which is deliberate
— the thing under test is the gap between state being set and a frame carrying
it. They are correspondingly sensitive to a loaded runner: one tab-marker
assertion has failed once on GitHub's hardware and passed on re-run. Re-run
before believing a lone failure there; believe a second one.

## Changesets

Every behaviour change gets one, and it lands as **its own commit** after the
commit it describes:

```
🐛 fix(health): stop treating cancelled checks as failures
📝 docs(changeset): add cancelled-is-not-failed changeset
```

The body is prose, not a bullet — what was wrong, what it cost, and what now
happens instead. Read `.changeset/*.md` for the register before writing one.
