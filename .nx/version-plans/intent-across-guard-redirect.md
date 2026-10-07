---
__default__: patch
---

`NativeNavigation.reset()`, `replace()` and `present()` to a page whose guard redirects, by returning a `UrlTree`, do to the page it redirects to what they were asked to do. A reset to a page whose guard sends a signed-out user to `/login` left the old stack under the sign-in page, a replace pushed it over the screen it was meant to replace, and a presentation pushed it instead of presenting it.
