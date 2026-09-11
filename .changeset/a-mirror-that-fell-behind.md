---
"@kud/gh-workflow": patch
---

`PillVariant` now includes `group`, as `@kud/ink-ui`'s has since 0.25.0.

The soft-fill changeset said `pillVariant` accepted the new `group` variant; only
ink-ui's union did. `@kud/gh-workflow` mirrors that union structurally so it
carries no renderer dependency, and the mirror had not moved — so a host typing
its pill from ink-ui could not assign a `group` pill to a `TaskRow`, while every
package here typechecked. The mirror's comment now says to extend it in the same
commit ink-ui's pin moves.
