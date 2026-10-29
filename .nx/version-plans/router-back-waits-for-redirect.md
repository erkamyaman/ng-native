---
__default__: patch
---

In `@ng-native/router`, `NativeNavigation.back()` called while a navigation is still running waits past a guard's redirect and goes back once the redirected navigation lands. Before, the redirect dropped the back, and the screen the guard redirected to stayed on top.
