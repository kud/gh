---
"@kud/gh-ink": patch
---

`PIN_MARK` is actually exported now.

0.32.1's changeset said it was, and it wasn't. It was exported from the inbox
module — enough for the invariant test's relative import, which is why nothing
caught it — but never added to the barrel, so it never reached the package's
public surface. The claim was true of the source and false of the package.

Consequence was small and real: a host wanting to render its own legend, or to
assert the same glyph invariant against its own marks, had no way to reach the
constant and would have hardcoded `"+"` instead — which is the duplication the
export existed to prevent.
