---
__default__: patch
---

A shorthand set in an element's inline style or bound on it (`padding`, `margin`, `inset`, `gap`, `border-width`, `border-color` or `border-radius`, or an axis form such as `padding-inline` or `paddingHorizontal`) now wins over a stylesheet's longhand on each side or corner it covers, as it does in a browser.

Before, `[style.padding.px]="10"` on an element whose class set `padding-top: 4px` kept a top padding of 4, since Yoga and React Native read the more specific side first; the same held for a logical side such as `margin-inline-start`. The covered longhand is now committed with the shorthand's value, so a transition on it eases to that value, and it takes the stylesheet's value again once the shorthand is removed. A longhand the stylesheet marks `!important`, and a longhand the element sets itself beside the shorthand, still win over it.
