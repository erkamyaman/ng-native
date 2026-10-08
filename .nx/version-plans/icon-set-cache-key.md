---
'__default__': patch
---

Upgrading or removing an `@ng-icons` set rebuilds the files that import it, without a `--clear`.

Metro reads the icons out of the set while it builds the app's own file, and the set's version was not in Metro's cache key. After an upgrade that redrew an icon, a release build, or a dev server after a restart, kept the old icon until the cache was cleared by hand. The installed sets and their versions are in the key now, found in the app's `node_modules` folders and in pnpm's store.
