---
'__default__': patch
---

A bound style in `em`, `[style.width]="'2em'"`, is now measured against the font size in scope, as one in a stylesheet is, and follows that font size when it changes. It used to reach native as the text `'2em'`, which native drops. So `<ng-icon size="2em" />` is now twice the font size around it, where it was drawn at `1em`.
