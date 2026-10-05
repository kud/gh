---
"@kud/gh-ink": patch
"@kud/gh-cockpit": patch
"@kud/gh-pr-health": patch
"@kud/gh-pr-comments": patch
"@kud/gh-webhook-replay": patch
---

Built against `@kud/ink-ui` 0.37.0. A launcher lookup that fails (a `gh` error, a 502) used to draw as an extra red row, `✗ couldn't look up acme/api-gateway#2926 · <reason>`, with the cursor sitting on it so Enter could retry. It was a row only because the palette's message line had a single muted ink, and a failure dressed as a selectable row read as something to open. The failure now takes the message line in the palette's error tone, behind its `✗`, where every other launcher verdict already lands; the input keeps the query as typed and Enter still asks again. The `@kud/ink-ui` peer range moves to `>=0.37.0 <1`, because an older palette has no error tone and no way to retry from the message line.
