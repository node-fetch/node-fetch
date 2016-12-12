# Upgrade to node-fetch v2

node-fetch v2 brings about many changes that increase the compliance of
WHATWG's Fetch Standard. However, many of these changes meant that apps written
for node-fetch v1 needs to be updated to work with node-fetch v2 and be
conformant with the Fetch Standard.

## `.text()` no longer tries to detect encoding

Currently, `response.text()` attempts to guess the text encoding of the input
material and decode it for the user. However, it runs counter to the Fetch
Standard which demands `.text()` to always use UTF-8.

In "response" to that, we have changed `.text()` to use UTF-8. A new function
**`response.textConverted()`** is created that maintains the behavior of
`.text()` last year.

## Internal methods hidden

Currently, the user can access internal methods such as `_clone()`,
`_decode()`, and `_convert()` on the `response` object. While these methods
should never have been used, node-fetch v2 makes these functions completely
inaccessible, and may break your app.

If you have a use case that requires these methods to be available, feel free
to file an issue and we will be happy to help you solve the problem.

## Headers

The `Headers` class has gotten a lot of updates to make it spec-compliant.

```js
//////////////////////////////////////////////////////////////////////////////
// If you are using an object as the initializer, all arrays will be reduced
// to a string.
const headers = new Headers({
  'Abc': 'string',
  'Multi': [ 'header1', 'header2' ]
});

// before                             after
headers.get('Multi') =>               headers.get('Multi') =>
  'header1';                            'header1,header2';
headers.getAll('Multi') =>            headers.getAll('Multi') =>
  [ 'header1', 'header2' ];             [ 'header1,header2' ];

// Instead, to preserve the older behavior, you can use the header pair array
// syntax.
const headers = new Headers([
  [ 'Abc', 'string' ],
  [ 'Multi', 'header1' ],
  [ 'Multi', 'header2' ]
]);


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

## 0.10.x support dropped

If you are still using Node.js v0.10, upgrade ASAP. Not only has Node.js
dropped support for that release branch, it has become too much work for us to
maintain. Therefore, we have dropped official support for v0.10 (it may still
work but don't expect them to do so).
