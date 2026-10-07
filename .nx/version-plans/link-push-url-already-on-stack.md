---
__default__: patch
---

A `nativeRouterLink` to a url that is already on the stack pushes a new screen over it, as `NativeNavigation.push()` does, and Back returns to the page the link was on, where the press popped back to the earlier screen and destroyed everything above it.
