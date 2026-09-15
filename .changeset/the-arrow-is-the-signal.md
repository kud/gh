---
"@kud/gh": minor
"@kud/gh-cockpit": minor
---

The PR summary line draws `→ base` only when the base is not the repo's default branch, and draws it a tier brighter than the provenance around it. The arrow's presence is now the signal.

A pull request onto `develop`, or onto a stacked base, read identically to an ordinary one in every other cell on that line — which made it exactly the fact you can be wrong about and never notice. The line exists to answer "what IS this pull request" before you start reading CI results, and it was silent on the one thing that changes the answer.

Suppression alone would not have done it. Presence cannot fire from inside the dim tier: `→ develop` wedged between two branch-shaped tokens, in a run already littered with `·`, at identical luminance, gives the eye no reason to stop — and this module's own header defines dim as "provenance you look at deliberately or not at all". So `base` comes back as its own cell and is drawn at the plain tier while the head branch stays dim. Two channels, presence and luminance, both already in this screen's vocabulary, and no hue spent: there is no "notable" colour token, a PR onto `develop` on a repo with a develop flow is entirely correct rather than wrong, and colour is the one channel a colourblind reader cannot use alone.

Why suppress rather than always draw it brighter: the draft marker's own rationale says a cell that is usually empty teaches you to skip past it. A cell that is usually **identical** teaches the same skip, faster. `→ main` on every pull request is the most efficient way there is to train a reader out of looking at that cell, so by the time it says `develop` they stopped weeks ago. Always-shown-and-dim was not the neutral option — it manufactured the blindness.

`@kud/gh` gains `fetchDefaultBranch`, a `gh repo view --json defaultBranchRef` call in its own module. It is a second call rather than a field on the health projection because `gh pr view --json` has no default-branch field at all — checked against the live field list on gh 2.100.0 — and because it is a per-repo fact that caches on a different key from anything per-PR. Cockpit keys it by repo through the drill cache, so the answer paints from disk immediately, revalidates behind it, and a repo that renames its default heals itself on the next drill-in. The call is mounted beside the health fetch and adds no wall clock.

It **throws** on a failed lookup rather than resolving `undefined`, and the distinction is load-bearing. `undefined` already means _draw the base_, so against a caller that revalidates on every mount a swallowed failure would redraw a cell that had been correctly suppressed — one network blip flickering `→ main` back onto a pull request it had been absent from. Answered-with-no-default and did-not-answer are now different outcomes.

The line was deliberately **not** given a new overflow ladder. It still has the one rung it has always had — the head branch goes, everything else stays — which remains right now that `→ base` appears only when it is notable. That the ladder is one step at all, so a narrow enough terminal wraps a line the module claims never wraps, is true today with no suppression anywhere near it, and is tracked separately.
