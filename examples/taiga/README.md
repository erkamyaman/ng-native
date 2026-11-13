# Taiga

An account screen built with Taiga UI, a component library written for the browser, rendered as
native views through `@ng-native/web-compat`. Taiga's components reach for the DOM on what they
render, and for the window and document around it, and web-compat gives the engine's nodes and the
runtime those members, so the library runs unchanged.

| Part                                               | What it shows                                                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Profile (`src/app/account/profile-form.ts`)        | Text fields, a checkbox and a switch bound with Signal Forms, an inline notification, and a button that shows an alert when it saves |
| Subscription (`src/app/account/plan-picker.ts`)    | A badge naming the plan, and a dropdown holding a data list that changes it                                                          |
| Help (`src/app/account/help-section.ts`)           | Tabs over an accordion of questions, and a dialog opened from `TuiDialogService`                                                     |
| Theme (`src/theme/taiga-theme.css`, `manrope.css`) | Taiga's theme tokens, compiled from its LESS, and its Manrope font                                                                   |
| Icons (`src/theme/taiga-icons.ts`)                 | A `tui-icon` beside the plan, a notification's symbol and an accordion's chevron: Taiga's icon masks, drawn as their SVGs            |

## What it takes

- `provideWebCompat()` and `provideTaiga()` in `src/app/app.config.ts`, and `withWebCompat()` last
  in `metro.config.js`, naming `@angular/cdk` and Taiga's `cdk`, `core` and `kit` so their
  stylesheets are read as a browser reads them. The app's own components stay native views.
- `provideEventPlugins()` from `@ng-native/web-compat/event-plugins`, which runs Taiga's
  `@taiga-ui/event-plugins`: its tabs listen for `tui-tab-activate.stop`, which one of them reads.
- `tui-root` around the screen (`src/app/account/account-page.ts`): Taiga presents its dialogs,
  dropdowns and alerts in it.
- Taiga's components imported from their secondary entry points, such as
  `@taiga-ui/kit/components/switch`, never from the `@taiga-ui/kit` barrel. The barrel loads every
  kit component, and the OXC linker silently leaves `TuiRating` unlinked: its template has a `<`
  inside an `@let`.
- An alert is `TuiNotificationService`: in Taiga 5, `TuiAlertService` is the base it extends.
- Taiga's theme ships as LESS, so `src/theme/taiga-theme.css` is it compiled, from the
  `@taiga-ui/styles` version `package.json` pins. After changing that version, run `pnpm theme`
  (`scripts/build-theme.mjs`), which fails if the installed copy is another version.
- Manrope from `@expo-google-fonts/manrope`, declared in `src/theme/manrope.css` and registered by
  `loadFonts()` before mounting. Taiga sets its type with `font` shorthands of its tokens, which
  the engine cannot split on a device, so the screen sets the face and size its text inherits.
- Taiga draws an icon as a CSS mask of `assets/taiga-ui/icons/<name>.svg`, which a browser fetches
  from the server the page came from. A device has none, so `src/theme/taiga-icons.ts` holds the
  markup of the icons the screen uses, from `@taiga-ui/icons`, and `tuiIconsProvider()` in
  `src/app/app.config.ts` gives them to Taiga as `data:` URLs, which web-compat draws in the
  icon's colour. After adding an icon to `scripts/build-icons.mjs` or changing the
  `@taiga-ui/icons` version, run `pnpm icons`.
- The theme is Taiga's light one: its dark palette applies under `tuiTheme="dark"`, which the app
  does not set, so `app.json` keeps the app light.

## Not yet

- **The checkbox's tick.** It is drawn once the box matches `:checked`, and a stylesheet's
  `:checked` matches the `checked` attribute in web-compat, not the state a tap gives the box, so
  the tick does not show. A repeated mask, a mask of a gradient, and Taiga's badge cut out of an
  icon (`mask-composite`) are not drawn either.
- **Loader.** Its spinner is an SVG circle whose radius, centre and dash are CSS properties (`r`,
  `cx`, `cy`, `stroke-dasharray`), animated by CSS, which the native SVG view does not take from a
  stylesheet.
- **Avatar.** Its initials are a pseudo-element's `content: attr(...)`, which draws no box.

## Run it

From the repository root, after `pnpm install`:

```sh
cd examples/taiga
pnpm start     # press i or a, or scan the QR code with Expo Go
pnpm test      # Vitest in Node, no simulator
```

`src/app/app.test.ts` drives each piece as a person would: types into the fields, ticks the
checkbox and flips the switch, saves and reads the alert, picks a plan from the dropdown, opens a
question and the dialog, and tears the app down with a dialog and an alert still open.
