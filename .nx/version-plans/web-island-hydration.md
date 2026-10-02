---
__default__: patch
---

An island now renders in an Angular app that hydrates server-rendered markup with `provideClientHydration()`, as an Analog app does by default, rather than staying empty with `TypeError: hasAttribute is not a function`. The element an island is mounted into is marked `ngSkipHydration`, so the island renders from scratch while the page around it hydrates as before.
