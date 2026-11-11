## What changed and why

With `@ng-native/web-compat`, a stylesheet selector on the `style` attribute (`[style]`, `[style*=top]`, `:not([style*=top])`) never reacted to a style a library wrote through `element.style` (`style.top = …`, `setProperty`, `removeProperty`, `cssText`) or `setAttribute('style', …)`. web-compat kept the attribute's text only for `getAttribute`, and the engine matched against the view's `style` prop, which is an object. Found while trying Taiga UI: its dropdown host has `:host:not([style*=top]) { visibility: hidden }` and is positioned through `el.style.top`, so on native the dropdown stayed hidden, where Chrome shows it as soon as `top` is written.

- `noteWritten`, the one place the style attribute's text is recorded, now also keeps it on the engine with `keepAttribute`. That restyles the element, and the elements after it or the parent for `+`, `~` and `:has()`, only when a loaded sheet names `style`. A `cloneNode` copy keeps the text it was copied with.
- An empty attribute (left by `cssText = ''` or by removing the last property) still matches `[style]`, and a removed one doesn't, as in Chrome.
- When a script removes every declaration it wrote, the view's `style` prop is removed instead of being left as `{}`, which the matcher read as the attribute still being there.
- Docs (`supported-api.md`) and a `patch` version plan.

Follow-up, listed as a gap: a style set by a template (static `style`, `[style.x]`, `[attr.style]`) is still not part of the attribute's text, unlike Chrome. That needs a hook in the platform adapter and is a separate change.

## How this was tested

- Chrome's behaviour was measured in Chromium for every step: CSSOM writes, `cssText = ''`, `setAttribute` with mixed case, `removeAttribute`, `toggleAttribute`, writes that change nothing, `+` and `:has()`. The new tests in `packages/web-compat/src/style-declaration.test.ts` use Chrome's values.
- 5 tests fail without the fix; 20 of 20 pass with it. 8 of 8 mutations are killed.
- Web Platform Tests: `css/selectors/attribute-selectors/style-attribute-selector.html` goes from 2 to 11 of 11, `css/selectors/invalidation/attribute.html` from 5 to 6 of 6, and `css/cssom/cssstyledeclaration-csstext-setter.window.js` from 8 to 9 of 9, recorded in `expectations.json`.
- web-compat tests 1227 of 1227; the full integration suite (8615 passed, 0 failed); `tsc --noEmit` in `packages/web-compat`; Nx lint, typecheck, build and test with `--skip-nx-cache`; `pnpm format:check`.
- 10k `el.style.top` writes cost the same before and after, within noise (about 6–8 µs per write).

## Checklist

- [x] Tests added or updated
- [x] Docs updated (`apps/documentation`, package README, or both), following [docs/README.md](../docs/README.md)
- [x] A version plan in `.nx/version-plans/`, if someone using the packages would notice the change
- [x] `pnpm lint typecheck test` is green locally
- [x] Respects the rules in [ARCHITECTURE.md](../docs/ARCHITECTURE.md)
