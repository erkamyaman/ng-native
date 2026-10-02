---
__default__: patch
---

`<dom-component>` acts only on messages from the page it loaded, so a page its web view is taken to by a link cannot fire the app's outputs or be sent its changed inputs. The inputs it is given before its page loads are still handed to whatever page the web view shows, so they should hold nothing secret. A message that is not JSON is dropped instead of throwing, and an output named after an object member such as `constructor` does nothing. The Metro preset looks for a lazy chunk from outside the server root only in the server root and the watch folders, which are all Metro bundles, rather than in every directory up to the root of the disk, and refuses a chunk name that decodes to a `..` segment, a root or a backslash.
