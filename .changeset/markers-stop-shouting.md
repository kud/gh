---
"@kud/gh-ink": patch
---

Row markers are lower case: `merged`, `gone`.

The capitals were doing a job back when these were bare coloured words competing
with a line of dim metadata for attention. A fill does that job now, and once it
does, shouting on top of it is just shouting. `epic` and `merged` sitting on the
same row in the same register is the point — they are the same KIND of thing, a
word about the row rather than another of its attributes.

One cost, worth naming because it caught two specs: lower case gives up the
uniqueness the capitals had. `merged` and `gone` are ordinary words that turn up
in titles — the merge spec's own fixture is called "the pull request being
merged" — so an assertion on the bare word now matches prose. Anything checking
for a marker matches the pill, caps included, rather than the word.
