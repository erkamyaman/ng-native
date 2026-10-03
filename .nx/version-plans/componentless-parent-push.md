---
__default__: patch
---

A push from a page under a route with no component of its own, a `loadChildren` wrapper or a group of routes, keeps that page on the stack beneath the new screen, where it destroyed it and the push acted as a replace. Back from there returns to the page as it was, where a group at path `''` came back as a page at `''` beside it.
