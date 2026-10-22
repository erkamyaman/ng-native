---
'__default__': patch
---

On Android, a dashed or dotted border with rounded corners from a stylesheet stays dashed when an element's inline style, a `[style]` binding or a value bound from a token gives its sides a new width or colour that all four sides still agree on.

Android draws a rounded border dashed only from the unsided `borderWidth` and `borderColor`, and only when every side equals them. The engine worked those out from the stylesheet before the element's own style was merged in, so the sides it committed no longer matched them and Android filled each side in solid. They are now worked out from the props the view is committed with, and sent as `null` when the sides stop agreeing. A width bound from a token for the whole border, `borderWidth: var(--w)`, is also no longer replaced by the stylesheet's side width on iOS and Android.
