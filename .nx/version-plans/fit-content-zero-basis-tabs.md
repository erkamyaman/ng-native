---
__default__: patch
---

Tabs that are each `flex: 1 1 0%` (Tailwind's `flex-1`) in a row as wide as its content now share the row's width as in Chrome, so tabs of different lengths come out the same width wherever that keeps each word whole, where a `w-fit`, `max-w-max` or `inline-flex` row had each tab at the width of its own text.

A tab whose even share would be narrower than its longest word is held at that word, and the other tabs share what is left, so no word is broken. That applies to an item with a `flex-basis` of `0%` or `0` in any row fitted to its content, including one kept from stretching by `align-self: flex-start` and one stretched across a `width: fit-content` box, where such tabs were the same width even when that was narrower than a word. Chrome under the layout reset keeps the even share and lets the word overflow the tab, so there the widths differ from Chrome's. An item with a `min-width` of its own keeps that minimum, and none is held wider than its row.

An item with a basis of `0%` that does not grow is held at its longest word in such a row, where it was at the width of its text, or 0 wide in a row kept from stretching. One with a basis of `0` points that does not grow stays 0 wide, as in Chrome.

Reading each tab's longest word takes two more commits when such a row is first laid out or what it holds changes. An item's own `min-width: auto` in such a row now holds as in Chrome too, where it had the even share or the width of its text.
