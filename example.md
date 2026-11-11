> Stacked on #FIX4 (stack: #FIX1 → #FIX2 → #FIX3 → #FIX4). Builds on all four web-compat fixes.

## What changed and why

`examples/taiga` is a one-screen account app built from Taiga UI's components, which are written for the browser and render as native views through `@ng-native/web-compat`. It shows what works today:
- text fields, a checkbox and a switch bound with Signal Forms, with a button
- an inline notification, and an alert from `TuiNotificationService` (Taiga 5's concrete alert service)
- a badge, and a dropdown holding a data list
- an accordion
- a dialog from `TuiDialogService`

It runs on plain `provideWebCompat()` and `provideTaiga()`, and each of the four fixes below it is needed: with any one reverted, its tests fail.

The example follows `examples/material`'s layout and tooling: `withWebCompat()` last in the Metro config, `webCompat()` and `ngNative({ inline })` in Vitest, Expo scripts, an `export` target and the same Nx tags.
- Taiga's theme ships as LESS. The compiled `src/theme/taiga-theme.css` is committed with `scripts/build-theme.mjs` (`pnpm theme`), which rebuilds it from the pinned `@taiga-ui/styles` version and refuses if another version is installed.
- Manrope is bundled from `@expo-google-fonts/manrope` and registered with `loadFonts()`. Taiga's own type is written as `font: var(...)` shorthands, which the engine drops, so the screen sets the face and size its text inherits.
- Taiga is imported from secondary entry points, because the `@taiga-ui/kit` barrel loads `TuiRating`, which the OXC linker leaves unlinked.
- Icons, Loader, Avatar and Tabs are left out. The README lists why under "Not yet".

`less` is a devDependency of the example only. Because it's an optional peer of Vite, the lockfile's Vite and Vitest entries gain a `less` peer suffix (same versions). `@angular/core` stays a single copy. Examples aren't released, so there's no version plan.

## How this was tested

- 9 Vitest `render()` tests in `src/app/app.test.ts`, one per piece, each pressing, typing, toggling, opening or selecting, plus app teardown with a dialog and an alert open raising no error. Each was checked to fail with its feature broken, and the suite fails with any one of the four web-compat fixes reverted.
- `pnpm nx run-many -t lint,typecheck,test -p taiga-example`, and `tsc --noEmit` in the example.
- `pnpm nx run taiga-example:export`: iOS and Android release bundles build (Hermes). The canary's release-bundle assertions (no compiler symbols, no HMR wiring, no shimmed CSS or raw templates) hold for both.
- `pnpm nx affected -t lint,typecheck,test` against the fix 4 branch: all 36 projects green. `pnpm format:check` passes.

## Checklist

- [x] Tests added or updated
- [x] Docs updated (`apps/documentation`, package README, or both), following [docs/README.md](../docs/README.md): the example's README
- [ ] A version plan in `.nx/version-plans/`, if someone using the packages would notice the change: not needed, examples are private
- [x] `pnpm lint typecheck test` is green locally
- [x] Respects the rules in [ARCHITECTURE.md](../docs/ARCHITECTURE.md)
