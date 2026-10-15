---
'__default__': patch
---

A `nativeRouterLink` to a page of a tab nobody has opened now puts the tab's first screen under the page, as `push()` does, so Back lands on it. The same goes for a link or a `push()` with a relative url, such as `../library/7`. A query written into the link's url, such as `/library/7?from=home`, is now read as a query instead of being encoded into the path.
