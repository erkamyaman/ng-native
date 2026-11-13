---
__default__: patch
---

With `@ng-native/web-compat`, a library's stylesheet now places and sizes a drawing's shapes as Chrome does, so Taiga UI's loader draws its ring and spins. `r`, `cx`, `cy`, `rx`, `ry`, `x` and `y` win over the attribute of the same name on the shapes that have each, a rule's `stroke-linecap` and `stroke-linejoin` are drawn, a `stroke-dasharray` of one length can come from a token, and `@keyframes` animate a shape's dash and paint. `stroke: inherit` takes the paint of what the shape is in, where it reached native as no colour. Each frame of a dash running round a shape only paints, as a spinner turning does.

A token made by `calc()` from a token in `em` or a viewport unit, such as `--thickness: calc(var(--diameter) / 12)` with `--diameter: 1.5em`, is now worked out at the font size of the element that uses it, as in a browser, where it set nothing before. A `max()` with a length under a token in `em`, such as `max(var(--thickness), 1.5px)`, keeps its floor.
