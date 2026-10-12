---
'__default__': patch
---

A tab bar kept as one screen with `reuseScreen` under a route with a parameter, such as `org/:org`, opens a tab in the account in front.

Each tab remembers the url it was last on, and a tap on it, or Android's back to the first tab, went back to that url. Once the app moved from `/org/1/home` to `/org/2/home`, the same bar stayed on screen and a tap on Search still went to `/org/1/search/x`. A tab now goes back to its remembered url only while that url is still inside the bar, and to its own first page otherwise.
