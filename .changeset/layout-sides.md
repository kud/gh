---
"@kud/gh-workflow": minor
---

`layoutSides` lays a section out in two levels: the host's own sides first, such as "Mine" and "Others", then the usual whose-move bands inside each. Every non-empty side opens with a counted depth-0 header and its bands follow at depth 1. Header ids are namespaced by section and side, so two "Your move" bands no longer share an identity. `SubgroupHeader` gains an optional `id` for this, and `layoutGHItems` output is unchanged.
