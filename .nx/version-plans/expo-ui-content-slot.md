---
__default__: patch
---

A `<ui-section>` and a `<ui-labeled-content>` now show their content, which SwiftUI drew none of.

`@expo/ui`'s `SectionView` and `LabeledContentView` draw only what is in a slot named `content`, which `@expo/ui`'s own React components wrap their children in. The typed components projected their children directly, so a form's sections showed their titles and no rows, and a labelled row no value. Both now wrap their content in that slot.
