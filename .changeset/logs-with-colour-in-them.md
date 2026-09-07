---
"@kud/gh-cockpit": patch
---

Opening a failing check's log works again when the log carries colour, which is most of them.

Drilling into a check returned an error instead of a log:

```
Error: the response contains terminal escape sequences;
pass --allow-escape-sequences to output it anyway
exit code: 1
```

`gh` will not print escape sequences without being told to, which is a sensible default for a CLI whose output might be piped anywhere — and a CI log is written BY programs that colour their own output, so arriving full of them is the normal case rather than an edge. That made this broken for almost every failing check rather than occasionally, and the failure surfaced as a raw `gh` error message inside the log view, where it read as the log itself having gone wrong.

The fetch asks for them now, and the view strips them before drawing. That is not a contradiction: the flag is `gh` declining to decide on our behalf, and stripping is the decision. They cannot reach the frame for a second reason anyway — they are someone else's styling arriving inside a view that does its own, and `processLog` already colours errors, warnings and group headers itself. A `\x1b[2J` in a build log would clear the frame drawn around it.

The pattern covers CSI sequences and OSC strings, the two forms that end with a terminator rather than a fixed length. OSC matters more than it looks: `\x1b]8;;…` hyperlinks are common in modern build tools, and a pattern written only for `\x1b[…` leaves the URL and its BEL behind as visible junk in the middle of a line.

Stripping happens before the split on newlines, and a spec pins that it eats none — swallowing one would merge two log lines and silently shorten the log.
