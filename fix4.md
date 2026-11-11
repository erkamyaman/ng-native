> Stacked on #FIX3 (stack: #FIX1 → #FIX2 → #FIX3).

## What changed and why

Under Angular Native, Angular's `getDOM()` is null: no browser platform boots, so nothing sets a DOM adapter. Anything in `@angular/platform-browser` that reaches for it throws. `Meta.addTag()`, `updateTag()` for a new tag and `removeTag()` all fail, and so does code that calls them as the app starts. Found trying Taiga UI: `provideTaiga()`'s font scaling uses `Meta`. `Title.setTitle()` didn't throw, but it only wrote a plain property that no `<title>` held.

- `provideWebCompat()` now sets a `WebCompatDomAdapter` as Angular's root DOM adapter once an app that asked for it is up (in its environment initializer, after the global document exists). It does this only where none is set, so an adapter the app set itself, or a browser platform's, is left alone.
- The adapter keeps no state. It reads the global `document` (the newest app's) each time.
  - Real: events (`dispatchEvent`, `onAndCancel`), `remove`, `createElement`, `createHtmlDocument` (a document that is never drawn), `isElementNode`, `getGlobalEventTarget`, `getBaseHref` (the path of the first `<base href>` in the head), `getUserAgent`.
  - As Angular's server adapter does where these don't exist: `isShadowRoot` is false and `getCookie` is null.
- Angular takes an adapter once (`_DOM ??= adapter`) and has no way to unset it, so the adapter stays after the last app. The docs list it next to the window's listening as what teardown leaves behind. It holds nothing from an app that has gone.
- The app's document gains `title`: the first HTML `<title>`, with ASCII whitespace collapsed. Setting it writes that title, or a new one in the head. This is what `Title` reads and sets.
- `@angular/platform-browser` is added as a devDependency of web-compat for the tests.
- The web host (`@ng-native/web`) doesn't use web-compat, and installing needs the native `Engine`, so nothing changes there.

## How this was tested

- New `packages/web-compat/src/dom-adapter.test.ts`: `Meta` add, get, update and remove in `document.head`, including from a provider's initializer; `Title` set and get, with a `<title>` in the head, ASCII-only whitespace handling, an SVG `<title>` ignored, and a script-written title; each adapter method; `getBaseHref` read fresh after `<base>` changes; two apps up at once, teardown, and a next app.
- `dom-adapter-own.test.ts`: an adapter the app set itself is kept, and `Meta` uses it.
- With the fix reverted, all 6 main tests fail (null adapter, or `getTitle()` returning `undefined`). 18 mutations of the fix are all killed; two equivalent ones survive (the guard duplicates Angular's `??=`, and the install order around setting the document makes no difference).
- `@ng-native/web-compat` lint, typecheck, build and test (1242 tests); documentation, integration-tests and material-example lint, typecheck and test; `@ng-native/web:test` (229); the full integration suite (8615 passed, 0 failed); `pnpm format:check`.
- Web Platform Tests: `document.title-01`, `-03` and `-08` pass more and are recorded; `DOMParser-parseFromString-xml-parsererror`'s subtest names now include the real `document.title` and are recorded.

## Checklist

- [x] Tests added or updated
- [x] Docs updated (`apps/documentation`, package README, or both), following [docs/README.md](../docs/README.md)
- [x] A version plan in `.nx/version-plans/`, if someone using the packages would notice the change
- [x] `pnpm lint typecheck test` is green locally
- [x] Respects the rules in [ARCHITECTURE.md](../docs/ARCHITECTURE.md)
