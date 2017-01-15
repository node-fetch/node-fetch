# Upgrade to node-fetch v2

node-fetch v2 brings about many changes that increase the compliance of
WHATWG's [Fetch Standard][whatwg-fetch]. However, many of these changes meant
that apps written for node-fetch v1 needs to be updated to work with node-fetch
v2 and be conformant with the Fetch Standard.

## `.text()` no longer tries to detect encoding

In v1, `response.text()` attempts to guess the text encoding of the input
material and decode it for the user. However, it runs counter to the Fetch
Standard which demands `.text()` to always use UTF-8.

In "response" to that, we have changed `.text()` to use UTF-8. A new function
**`response.textConverted()`** is created that maintains the behavior of
`.text()` last year.

## Internal methods hidden

In v1, the user can access internal methods such as `_clone()`, `_decode()`,
and `_convert()` on the `response` object. While these methods should never
have been used, node-fetch v2 makes these functions completely inaccessible.
If your app makes use of these functions, it may break when upgrading to v2.

If you have a use case that requires these methods to be available, feel free
to file an issue and we will be happy to help you solve the problem.

## Headers

The main goal we have for the `Headers` class in v2 is to make it completely
spec-compliant. However, due to changes in the Fetch Standard itself, total
spec compliance would mean incompatibility with all current major browser
implementations.

Therefore, in v2, only a limited set of changes was applied to preserve
compatibility with browsers by default. See [#181] for more information on why
a feature is enabled or disabled.

```js
//////////////////////////////////////////////////////////////////////////////
// If you are using an object as the initializer, all values will be
// stringified. For arrays, the members will be joined with a comma.
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
maintain. Therefore, we have dropped official support for v0.10.

That being said, node-fetch may still work with v0.10, but as we are not
actively trying to support that version, it is in the user's best interest to
upgrade.

[whatwg-fetch]: https://fetch.spec.whatwg.org/
[#181]: https://github.com/bitinn/node-fetch/issues/181
