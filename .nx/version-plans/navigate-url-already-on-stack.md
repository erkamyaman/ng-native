---
__default__: patch
---

A plain `Router.navigate()` or `navigateByUrl()` to a url that is already lower on the stack pushes a new screen over it, as `NativeNavigation.push()` and `nativeRouterLink` do, and Back returns to the page it came from. Before, it went back to the earlier screen and destroyed every screen above it, while history kept their entries, so Back then went to entries that had no screen. A navigation with `replaceUrl: true` still goes back to the screen already there.

With the same url on the stack twice, a back through history, `popTo()`, or a native pop of several screens at once on iOS, lands on the screen of the history entry it returns to, where it could land on the newer one and leave screens above the one history showed.
