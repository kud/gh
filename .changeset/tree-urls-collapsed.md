---
"@kud/gh-ink": patch
---

`C` and `O` now reach the children a collapsed row is holding.

`treeUrls` walks the rows drawn under the cursor, and a `show-more` row was
skipped whole — correctly, in that it carries no URL of its own, but the rows it
hides were skipped with it. A tree tall enough to collapse therefore yielded
only the children still on screen.

That made what `C` copies depend on how many children happened to fit, and the
screen gives you no way to notice: past the limit the remaining URLs simply stop
arriving in the clipboard, with nothing anywhere to say so. The walk now
descends into `hidden`; the `show-more` row itself still contributes nothing, so
no blank line reaches the clipboard.
