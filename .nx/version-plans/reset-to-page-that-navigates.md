---
'__default__': patch
---

A reset or a replace to a page that navigates elsewhere as it is created, a sign-in check in its `ngOnInit`, takes out the screens it supersedes.

The page's own navigation cancelled the reset or the replace before the stack had marked what it supersedes, and the stack waited for that navigation to end, which it never did. Signing out to a page that sent a signed-out user to sign in left every screen of the session under the sign-in page.
