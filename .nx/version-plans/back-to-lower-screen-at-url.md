---
__default__: patch
---

With the same url on the stack twice, a back through history, `popTo()`, or a native pop of several screens at once on iOS lands on the screen of the history entry it returns to. Before, it could land on the newer screen at that url and leave screens above the one history showed.
