---
'__default__': patch
---

`Updates` keeps a downloaded update waiting when a later `check()` fails or finds nothing new: `ready()` stays `true`, `check()` resolves `true` and `apply()` restarts into it, with the failure reported on `error()` only. `error()` is cleared by the next check that succeeds.
