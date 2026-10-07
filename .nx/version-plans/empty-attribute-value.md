---
'__default__': patch
---

An attribute selector with an empty value matches what it does in a browser.

`[data-x^=""]`, `[data-x$=""]`, `[data-x*=""]` and `[data-x~=""]` matched every element with a `data-x`, and `[data-x~=""]` matched one whose `data-x` was empty. They match nothing, as Selectors 4 says. `[data-x=""]` and `[data-x|=""]` are unchanged.
