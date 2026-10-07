---
__default__: patch
---

A `nativeRouterLink` to a url that is already on the stack pushes a new screen over it, as `NativeNavigation.push()` does, and Back returns to the page the link was on, where the press popped back to the earlier screen and destroyed everything above it. A link whose `[extras]` set `replaceUrl: true` replaces the screen as the `replace` attribute does, rather than leaving the replaced screen mounted under one its history entry no longer leads back to.
