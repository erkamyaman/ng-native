---
'__default__': patch
---

`dark:` applies to the view that has the `dark` class as well as to everything inside it, with both Tailwind presets. A root view an app puts `dark` on itself kept its light `dark:bg-zinc-950` and only its children turned dark. The variant is now Tailwind's own class-based form, `&:where(.dark, .dark *)`, at the same specificity as on the web: a `dark:` utility still wins over the plain one it follows, and a rule an app writes after the utilities can now override it, as in a browser.
