---
"@kud/gh-ink": minor
---

Stop naming the sides of the repo split

**Breaking**: `isWorkRepo` and `includeWork` are replaced by one `origin` prop,
and `filterByOrigin`'s `keep` argument is now `"matched"` / `"rest"` rather than
`"work"` / `"home"`.

```ts
origin={{ match: isWorkRepo, show: "matched", label: "work" }}
```

The header printed the literal word `work` or `home`, and `filterByOrigin` took
those two strings as its argument. That is one reader's two lives compiled into
a library anyone can install: no other host has those categories, most have
none, and the word appearing in the header was one nobody else would recognise.

The predicate, the side and the word are all the host's now. The package knows
only that there are two sides and which one you asked for; omit `label` and it
shows nothing at all. `origin` omitted entirely means no split, which stays the
ordinary case.
