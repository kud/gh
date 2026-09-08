---
"@kud/gh-cockpit": patch
---

The PR header's summary line gets a hierarchy: bold orange size, plain file count, dim provenance.

```
#1496 · acme/api-gateway
Title: keep the turn arrow clearing on a bot comment
+412 -38 · 12 files · fix/turn-arrow → main · kud · opened 3d ago
▔▔▔▔▔▔▔▔   ▔▔▔▔▔▔▔▔   ─────────────────────────────────────────
bold orange  plain      dim
```

The line shipped with the size undimmed and everything else dim, which was nominally a hierarchy and did not read as one: default white against dim grey is a small step across five characters with nothing framing it. Five facts of two different kinds in one flat run, and flatness — not hue — was the fault.

**One colour across both numbers, never one per sign.** The original ruling here was "deliberately uncoloured", and the trap it named is still real: colour `+412` and `-38` differently and a colourblind reader gets a near-identical pair of hues, leaving the signs as the only channel carrying anything — noise added, nothing taken away. Nothing here asks hue to separate the two numbers. They share one colour, so that failure is structurally impossible rather than merely avoided. What the colour does instead is separate the answer from the provenance, which hue is good at.

It separates on **luminance**, which survives every deficiency type, with bold weight and leftmost position as two further non-colour channels. Same `#FF8700` as the `#number` two lines above, so the header reads as one identity block — this PR, this big.

**No magnitude banding.** A hue that changes at 400 lines is a traffic light nobody asked for: it needs a legend and puts a boundary between 399 and 401. The digits already say the size exactly; what they lacked was pre-attentive weight, not precision.

`summaryOf` now returns the file count as its own cell rather than joined into `rest` — a tier cannot be expressed inside one string. The draft marker consequently leads the dim run and follows the file count on screen, still ahead of every fact it qualifies, and keeps the health vocabulary's muted `~`: one glyph, one colour, across screens is worth more than one line's emphasis.

Known weak spot, stated rather than solved: `#FF8700` on a light terminal is about 2.3:1 and the hue goes quiet. Bold, position and the dim/undimmed split all survive the inversion, so the hierarchy holds in a softer form. If a light background ever becomes real the fix is a darker orange, not a new scheme.
