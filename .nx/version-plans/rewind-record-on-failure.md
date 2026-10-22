---
__default__: patch
---

A plain Router.navigate() or navigateByUrl() to a url further down a native stack that fails, or that another navigation cancels, after taking screens off no longer leaves its pending rewind of the history behind.

No later navigation was found to act on that leftover record, since a rewind only applies to the navigation that made it, so the history and the stack behave as before.
