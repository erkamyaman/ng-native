---
'__default__': patch
---

A push into a tab nobody has opened now resolves `false` and shows nothing when a guard on the tab's first screen redirects to another tab. Before, it resolved `true` and showed the page anyway, with nothing under it.
