---
'__default__': patch
---

A template plural on the web host picks its case by the rules of the app's `LOCALE_ID`, as on iOS and Android, where it was counted by the rules of `en-US` whatever the locale: with `LOCALE_ID` `fr`, a count of 0 renders the `one` case.
