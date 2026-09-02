---
"@kud/gh-ink": patch
---

The inbox had a table that turns a `gh` failure into a sentence a person can act
on — `gh is not authenticated`, `GitHub rate limit spent` — and it was wired
into every action path and none of the fetch paths. So the one failure a brand
new host is most likely to hit, on the very first frame it ever renders, arrived
as zx's raw stderr filling the whole screen.

That is the worst place to spend the raw line. An action failure flashes beside
a list that has already proved `gh` works, so the reader knows the tool is fine
and only this one call went wrong. A fetch failure at startup is the first thing
they have ever seen from the package, and `gh auth login` is overwhelmingly the
thing it needed to tell them.

The fetcher's catch now goes through the same mapper. The raw line still rides
along on the end, so a failure the table does not recognise is no less
diagnosable than before.
