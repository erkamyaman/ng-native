---
'__default__': patch
---

`<virtual-list>` and `<section-list>` now fire `endReached` when the rows are shorter than the viewport, and again when a page is appended while the list rests at the end, without waiting for a drag.

`viewableItemsChanged` now reports again when the items change: rows that arrive after the first layout, a filter that leaves fewer rows, or new rows in place of as many old ones.
