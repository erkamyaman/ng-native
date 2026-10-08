---
'__default__': patch
---

A `@media` inside another `@media` applies where both hold, and `:not()` around a list with an ancestor test in it excludes each alternative, so Tailwind's stacked `md:max-lg:` and `not-dark:` variants work.

The inner `@media` was refused as an at-rule a style rule cannot hold, so `md:max-lg:` and `md:motion-reduce:` were dropped at every width. `.x:not(:where(.dark, .dark *))` excluded only an element that was dark and inside something dark, so `not-dark:` with Tailwind's class-based dark mode still applied in dark mode. It now excludes an element that is dark or inside something dark, as Selectors 4 says.
