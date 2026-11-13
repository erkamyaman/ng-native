---
__default__: patch
---

With `@ng-native/web-compat`, a library's `mask-image` of an SVG is drawn: the box is the SVG's shapes in its background colour, placed by `mask-size` and `mask-position` where Chrome places it. This is how Taiga UI draws its icons (`tui-icon`, a checkbox's tick, an accordion's chevron, a notification's symbol), which drew nothing before, or a solid square.

A sheet read as a browser reads it keeps `mask-image` of one `url()` or `none`, or a token holding one, with `mask-size`, `mask-position`, `mask-repeat` and the `mask` shorthand of one layer, and the engine hands them to what draws them (`Engine.drawMasks`) instead of sending them to a view. A masked box paints no background of its own, and a `position: static` one is placed as `relative`. A `mask-size` with a token in it is settled against the box as it is laid out, and a length of the viewport in the SVG for the size it is drawn at, as Taiga's icons write their stroke. A mask of a gradient or of more than one layer, a repeated mask, and `mask-composite`, `mask-clip`, `mask-origin` and `mask-mode` are dropped with a warning. The SVG is a `data:` URL's, as Taiga UI's `tuiIconsProvider()` gives one, or fetched from its URL once an app.
