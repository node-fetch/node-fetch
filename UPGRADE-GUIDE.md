# Upgrade to node-fetch v2.x

node-fetch v2.x brings about many changes that increase the compliance of
WHATWG's [Fetch Standard][whatwg-fetch]. However, many of these changes mean
that apps written for node-fetch v1.x needs to be updated to work with
node-fetch v2.x and be conformant with the Fetch Standard. This document helps
you make this transition.

Note that this document is not an exhaustive list of all changes made in v2.x,
but rather that of the most important breaking changes. See our [changelog] for
other comparatively minor modifications.

## `.text()` no longer tries to detect encoding

In v1.x, `response.text()` attempts to guess the text encoding of the input
material and decode it for the user. However, it runs counter to the Fetch
Standard which demands `.text()` to always use UTF-8.

In "response" to that, we have changed `.text()` to use UTF-8. A new function
**`response.textConverted()`** is created that maintains the behavior of
`.text()` in v1.x.

## Internal methods hidden

In v1.x, the user can access internal methods such as `_clone()`, `_decode()`,
and `_convert()` on the `response` object. While these methods should never
have been used, node-fetch v2.x makes these functions completely inaccessible.
If your app makes use of these functions, it may break when upgrading to v2.x.

If you have a use case that requires these methods to be available, feel free
to file an issue and we will be happy to help you solve the problem.

## Headers

The main goal we have for the `Headers` class in v2.x is to make it completely
spec-compliant. These changes are done in conjunction with GitHub's
[`whatwg-fetch`][gh-fetch] polyfill, [Chrome][chrome-headers], and
[Firefox][firefox-headers].

```js
//////////////////////////////////////////////////////////////////////////////
// `get()` now returns **all** headers, joined by a comma, instead of only the
// first one. Its original behavior can be emulated using
// `get().split(',')[0]`.

const headers = new Headers({
  'Abc': 'string',
  'Multi': [ 'header1', 'header2' ]
});

// before                             after
headers.get('Abc') =>                 headers.get('Abc') =>
  'string'                              'string'
headers.get('Multi') =>               headers.get('Multi') =>
  'header1';                            'header1,header2';
                                      headers.get('Multi').split(',')[0] =>
                                        'header1';


//////////////////////////////////////////////////////////////////////////////
// `getAll()` is removed. Its behavior in v1 can be emulated with
// `get().split(',')`.

const headers = new Headers({
  'Abc': 'string',
  'Multi': [ 'header1', 'header2' ]
});

// before                             after
headers.getAll('Multi') =>            headers.getAll('Multi') =>
  [ 'header1', 'header2' ];             throws ReferenceError
                                      headers.get('Multi').split(',') =>
                                        [ 'header1', 'header2' ];


//////////////////////////////////////////////////////////////////////////////
// All method parameters are now stringified.
const headers = new Headers();
headers.set('null-header', null);
headers.set('undefined', undefined);

// before                             after
headers.get('null-header')            headers.get('null-header')
  => null                               => 'null'
headers.get(undefined)                headers.get(undefined)
  => throws                             => 'undefined'


//////////////////////////////////////////////////////////////////////////////
// Invalid HTTP header names and values are now rejected outright.
const headers = new Headers();
headers.set('Héy', 'ok');          // now throws
headers.get('Héy');                // now throws
new Headers({ 'Héy': 'ok' });      // now throws
```

## Node.js v0.x support dropped

If you are still using Node.js v0.10 or v0.12, upgrade ASAP. Not only has it
become too much work for us to maintain, Node.js has also dropped support for
those release branches in 2016. Check out Node.js' official [LTS plan] for more
information on Node.js' support lifetime.

[whatwg-fetch]: https://fetch.spec.whatwg.org/
[LTS plan]: https://github.com/nodejs/LTS#lts-plan
[gh-fetch]: https://github.com/github/fetch
[chrome-headers]: https://crbug.com/645492
[firefox-headers]: https://bugzilla.mozilla.org/show_bug.cgi?id=1278275
[changelog]: CHANGELOG.md
