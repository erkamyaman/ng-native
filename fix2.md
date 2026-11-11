> Stacked on #FIX1. Review that one first; this branch adds one commit on top, and shrinks to that commit once #FIX1 merges.

## What changed and why

With `@ng-native/web-compat`, `document.getElementsByTagName('head')` and `('html')` returned empty collections, and `getElementsByClassName`, `getElementsByName`, `getElementsByTagNameNS` and `getElementById` never found `<html>` or `<head>`, while `document.head`, `document.documentElement` and `querySelector('head')` did. Found trying Taiga UI: `provideTaiga()` reads `document.getElementsByTagName('head')[0]`, as Angular's `Meta` does, and threw. A theme class on `<html>` (`dark`) was also invisible to `getElementsByClassName`.

The document's lookups walked `everything()`, which yielded the descendants of the head and of the root but never `<html>` or the head themselves, while `querySelectorAll` walked `elements()`, which does. The lookups now walk `elements()` too: `<html>`, then the head and what it holds, then the page. That is Chrome's order, so `getElementsByTagName('*')` and `querySelectorAll('*')` hold the same elements in the same order. A head a script moved into the page is found once, where it is. The lists stay live through the existing change count (classes, insertions, `name`, `id`). An element's own `getElementsBy*` is unchanged and still finds only what is under it.

Chrome's answers on `<html><head><title></head><body>…`: `getElementsByTagName('html'|'HTML'|'head')` each return 1, `[0] === document.head`, and `'*'` gives html, head, title, body, …. `getElementsByClassName('dark')` follows a class added to and removed from `<html>` and `<head>`. A `<meta>` appended to the head appears in a live `getElementsByTagName('meta')`. `getElementById` finds html and head. An element's own lookups never include its ancestors.

Follow-up, not in this diff: `documentElement.children` does not hold the head while the head is kept outside the page, so `documentElement.getElementsByTagName('head')` is still empty where Chrome finds it.

## How this was tested

- New tests in `packages/web-compat/src/live-list.test.ts`: the document's lookups find html and head in page order; the lists follow classes on html and head and what the head holds; an element's own lookups exclude html and head. Expected values are Chrome's, measured in Chromium.
- All three fail without the fix and pass with it. 10 of 10 mutations are killed: each getter switched back to the old walk, the root and head yields dropped, and the head-in-page guard negated or removed.
- Web Platform Tests: the CI `--check` passes. Nine files pass more and are recorded in `expectations.json`: `Document-getElementsByTagName.html` 11/18 → 12/18, `Document-getElementsByTagNameNS.html` 12/14 → 14/14, and `getElementsByClassName-01`/`02`/`03`/`04`/`05`/`09`/`15.htm` 0/1 → 1/1. Nothing regressed.
- web-compat tests 1230/1230; the full integration suite (8615 passed, 0 failed); `tsc --noEmit`; `nx run-many -p @ng-native/web-compat -t lint,typecheck,build,test --skip-nx-cache`; `pnpm format:check`.

## Checklist

- [x] Tests added or updated
- [ ] Docs updated (`apps/documentation`, package README, or both), following [docs/README.md](../docs/README.md): not needed, Supported API already lists the live lookups
- [x] A version plan in `.nx/version-plans/`, if someone using the packages would notice the change
- [x] `pnpm lint typecheck test` is green locally
- [x] Respects the rules in [ARCHITECTURE.md](../docs/ARCHITECTURE.md)
