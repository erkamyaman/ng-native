---
title: Turborepo
summary: An app and a shared Angular library as packages of a Turborepo workspace, built and cached
  by turbo.
---

# Turborepo

An Angular Native app in a [Turborepo](https://turborepo.com) workspace is an ordinary workspace
package with its own `package.json`, the way the workspace's other apps are. Expo's Metro config
finds the workspace's packages, so the app's `metro.config.js` stays as the template writes it, and
a shared Angular library needs no build step: Metro compiles its components ahead of time with the
app's own. The steps below are for a pnpm workspace with `apps/*` and `packages/*`, the layout
`create-turbo` makes.

For an Nx workspace, use [`@ng-native/nx`](/packages/nx) instead.

## Add the app

From the workspace root, create the app from the template without installing, then install from the
root so pnpm links it into the workspace:

```sh
npx create-expo-app@latest apps/mobile --template @ng-native/template --no-install
pnpm install
```

Give the app the scripts Turborepo runs, in `apps/mobile/package.json`. The template already has
`typecheck`:

```json
{
  "name": "mobile",
  "scripts": {
    "dev": "expo start",
    "build": "expo export --output-dir dist"
  }
}
```

`metro.config.js` needs no change. `getDefaultConfig` reads `pnpm-workspace.yaml` and watches each
of the workspace's packages, so the dev server sees an edit to a library, and `withAngularNative`
compiles the components Metro reaches there. Its `workspaceRoot` option is for a layout Expo does
not detect (see [Metro configuration](/packages/metro/configuration)).

## Share an Angular library

A library in `packages/ui` exports its TypeScript source, and lists Angular and the `@ng-native`
packages it imports as peer dependencies and as dev dependencies:

```json
{
  "name": "@acme/ui",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "ngc -p tsconfig.json --noEmit" },
  "peerDependencies": {
    "@angular/core": "^22.0.0",
    "@ng-native/components": "0.25.0"
  },
  "devDependencies": {
    "@angular/compiler-cli": "^22.0.0",
    "@angular/core": "^22.0.0",
    "@ng-native/components": "0.25.0",
    "typescript": "~6.0.3"
  }
}
```

Use the versions in the app's `package.json`. Metro resolves the library's imports from
`packages/ui/node_modules`, where pnpm links its dev dependencies, so a version the app does not
have is a second copy in the bundle, and a second `@angular/core` fails at runtime far from the
cause.

Its components are written as in the app, with lowercase element names:

```ts
import { Component, input } from '@angular/core';
import { Text } from '@ng-native/components';

@Component({
  selector: 'acme-greeting',
  imports: [Text],
  template: `<text class="greeting">Hello from acme-ui, {{ name() }}</text>`,
  styles: `
    .greeting {
      color: rebeccapurple;
    }
  `,
})
export class Greeting {
  readonly name = input('world');
}
```

`src/index.ts` exports it:

```ts
export { Greeting } from './greeting.ts';
```

`ngc` needs a `tsconfig.json` in the library. `allowImportingTsExtensions` is for the `.ts` in the
import above:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "angularCompilerOptions": { "strictTemplates": true }
}
```

Add `"@acme/ui": "workspace:*"` to the app's `dependencies`, run `pnpm install`, and import the
component where the app uses it, in `apps/mobile/src/app/app.ts`:

```diff
 import { StatusBar } from '@ng-native/device';
+import { Greeting } from '@acme/ui';
@@
-  imports: [Pressable, SafeAreaProvider, SafeAreaView, Text, View],
+  imports: [Greeting, Pressable, SafeAreaProvider, SafeAreaView, Text, View],
@@
           <text class="title">Angular, natively</text>
+          <acme-greeting name="turbo" />
```

## Configure the tasks

In `turbo.json` at the workspace root:

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**"]
    },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

```sh
pnpm turbo run typecheck build
```

- **`outputs`** is where `expo export` writes the iOS and Android bundles, so a cache hit restores
  them.
- **`inputs`** adds `.env*` to the files Turborepo hashes. Expo inlines each `EXPO_PUBLIC_` variable
  into the bundle, and the template's `.gitignore` ignores `.env*.local`. Turborepo does not hash a
  file git ignores, so without this line a changed `.env.local` replays the bundle built with the
  old value. Run the build once with `--force` after adding the line: an entry cached before it was
  added can still be replayed.
- An `EXPO_PUBLIC_` variable set in the shell needs nothing in `turbo.json`. Turborepo recognises
  Expo from the app's dependencies, passes those variables to the task and hashes them.
- A change to the library's source rebuilds the app, although the library has no `build` of its
  own: Turborepo hashes a workspace dependency's files into the app's task.

Turborepo passes keystrokes only to a task marked `interactive`, so Expo's dev server shortcuts (`i`
and `a` for a simulator, `r` to reload) do not reach `turbo run dev`. Start Metro from the root with
`pnpm --filter mobile start` to use them.
