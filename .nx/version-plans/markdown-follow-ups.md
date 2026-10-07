---
'@ng-native/components': patch
'@ng-native/analog': patch
'@ng-native/router': patch
---

Fix four things in the Markdown and Analog support:

- `<markdown>` no longer breaks a paragraph where its source wrapped a line. A line break in a paragraph is a space, as CommonMark reads it; two spaces or a backslash at the end of a line still break the text there.
- `<markdown>` decodes every named HTML entity, such as `&rarr;`, `&eacute;`, `&euro;` and `&hearts;`, not only a short list of common ones.
- `injectContent()` and `contentFileResource()` from `@ng-native/analog` find a file whose slug has a space or an accent in it by the encoded slug `injectContentFiles()` lists it with, so a link to `post.slug` opens the post, as in Analog.
- `fileRoutes` tries a dotted static page such as `users.new.page.ts` before a `users` folder whose `[id].page.ts` would take `new`, as Analog does.
