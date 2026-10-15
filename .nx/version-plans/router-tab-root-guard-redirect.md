---
'__default__': patch
---

A push into another tab now resolves `false` and shows nothing when a guard on the way redirects elsewhere: on the first screen of a tab nobody has opened, or on the page a tab covered by another screen was left on. Before, it resolved `true` and showed the page anyway.
