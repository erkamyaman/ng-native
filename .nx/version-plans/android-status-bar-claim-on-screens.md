---
'__default__': patch
---

On Android, the app's `StatusBar` claim stays on after a push or a pop. A screen with its own `statusBarStyle` or `statusBarHidden` no longer leaves white icons, or a shown bar, on every screen after it: the stack outlet now puts the claim's style and visibility on each screen that has none of its own, and `StatusBar` has a new `forScreens` signal for it.
