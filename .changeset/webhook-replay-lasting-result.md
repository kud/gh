---
"@kud/gh-webhook-replay": patch
---

The picker's result vanished before it could be read. After a replay, `gh-webhook-replay` drew its `✓` or `✗` line inside the alternate screen and held it for 1.8 seconds before exiting, and leaving the alternate screen is precisely what discards its contents — so nothing remained in the scrollback to say whether the replay had landed, and a failure was as invisible as a success. The picker now exits as soon as the replay settles and prints the outcome to the normal screen, where it stays: `✓ Webhook replayed on owner/repo` with the hook and its URL and the delivery id on the line below, or `✗` with the error and the hook it was attempted on, and an exit code of 1 for a failure.
