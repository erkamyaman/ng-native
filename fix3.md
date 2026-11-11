> Stacked on #FIX2 (which is stacked on #FIX1).

## What changed and why

When the last app that asked for `@ng-native/web-compat` is destroyed, the package's own `DestroyRef` teardown deleted the window's `addEventListener`, `removeEventListener` and `dispatchEvent`. That hook is registered in the environment initializer, and `R3Injector.destroy()` runs hooks in the order they were registered, so it runs before the hooks of services the app created later. A root service that listened with `fromEvent(window, 'resize')` then found no `removeEventListener` as it unsubscribed. With `toSignal`, which Taiga UI's root uses, rxjs threw an `UnsubscriptionError` out of `ApplicationRef.destroy()` and `@ng-native/testing`'s `cleanup()`, so every Taiga app threw on destroy. With `takeUntilDestroyed`, the same error was silently dropped. Found while trying Taiga UI through web-compat.

The uninstall now leaves those three members on the window where `withWebCompat`'s stand-ins weren't there to put back (tests, or a Metro config without it). Where they were, the stand-ins go back as before. Every listener added to the window while an app was up is still removed with the last app (`unlistenAll`), so a late `removeEventListener` doesn't throw and does nothing. A listener added after teardown is kept for the next app, which is what the stand-ins already do on device. Everything else the package adds is still taken away. This is not fixed by ordering, because a hook can't be added once destroy has started and a deferred removal would still break a late timer.

The docs sentence "everything the provider adds is taken away again" and the supported-API listener bullet now state the exception. The `provide-web-compat` test that compared every global after teardown now checks that the three listening members stay, and compares everything else as before. `rxjs` is a new devDependency of the package, used by the test, and `@angular/core` still resolves to a single copy.

## How this was tested

- New `packages/web-compat/src/window-teardown.test.ts`:
  - a root service using `fromEvent` + `takeUntilDestroyed`, and a Taiga-style `toSignal(fromEvent(...))` one: teardown raises no error (thrown, unhandled or dropped) and the listener is really gone
  - late removal of a listener added during the app
  - a listener added after teardown is handed to the next app
  - two apps, the first and then the last destroyed
  - Metro's pre-app stand-ins under a root service and the next app
- Without the fix, four of the new tests fail (one with the exact `UnsubscriptionError`), and so does the updated provide-web-compat test. The stand-in test passes on base and guards that path. Six mutations of the fix are all killed.
- web-compat suite: 1235/1235 pass. Full integration suite: 8615 passed, 0 failed.
- WPT `--check` over the CI suites matches expectations exactly.
- `tsc --noEmit` in the package; Nx lint, typecheck, build and test for `@ng-native/web-compat`, and lint, typecheck and test for `documentation`, all with `--skip-nx-cache`; `pnpm format:check`.

## Checklist

- [x] Tests added or updated
- [x] Docs updated (`apps/documentation`, package README, or both), following [docs/README.md](../docs/README.md)
- [x] A version plan in `.nx/version-plans/`, if someone using the packages would notice the change
- [x] `pnpm lint typecheck test` is green locally
- [x] Respects the rules in [ARCHITECTURE.md](../docs/ARCHITECTURE.md)
