---
'__default__': patch
---

A release build from a warm Metro cache ships a `templateUrl` or `styleUrl` file edited since the last build.

Metro caches a transform against the file's own content, and a component's template and sheet are compiled into its own module, so two `npx expo export` runs with only the `.html` or `.css` edited between them shipped the old template or styles until `--clear`. The transform worker now records the templates and stylesheets a component's transform read, and the cache stores `withAngularNative` wraps treat that transform as a miss once one of them has changed or been deleted. Set your own `cacheStores` before calling `withAngularNative`, so they are wrapped too.
