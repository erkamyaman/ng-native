---
__default__: patch
---

An app made from the template now gets a deep link scheme from its own name, and no longer carries the template's `publishConfig`.

The scheme was `myapp` in every app. It is now `helloworld` in the template, which `create-expo-app` replaces with the app's name, as it does for Expo's own templates: `field-notes` gets `fieldnotes`, the scheme the nx generator already gives. The template's `publishConfig` only said to publish it publicly, which the release already does, and `create-expo-app` left it in the new app's `package.json`.
