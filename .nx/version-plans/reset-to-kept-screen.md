---
'__default__': patch
---

`NativeNavigation.reset()` to a screen still kept further down the stack now leaves that screen alone on the stack. The screens below it are destroyed too, so back has nowhere to go, as the docs say.
