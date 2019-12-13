# Upgrade to node-fetch v3.x

node-fetch v3.x brings about many changes that increase the compliance of
WHATWG's [Fetch Standard][whatwg-fetch]. However, many of these changes mean
that apps written for node-fetch v2.x needs to be updated to work with
node-fetch v3.x and be conformant with the Fetch Standard. This document helps
you make this transition.

Note that this document is not an exhaustive list of all changes made in v3.x,
but rather that of the most important breaking changes. See our [changelog] for
other comparatively minor modifications.

- [Breaking Changes](#breaking)
- [Enhancements](#enhancements)

---

<a id="breaking"></a>

# Breaking Changes

## Minimum supported Node.js version is now 10

Since Node.js will deprecate version 8 at the end of 2019, we decided that node-fetch v3.x will not only drop support for Node.js 4 and 6 (which were supported in v2.x), but also for Node.js 8. We strongly encourage you to upgrade, if you still haven't done so. Check out Node.js' official [LTS plan] for more information on Node.js' support lifetime.

## `Response.statusText` no longer sets a default message derived from the HTTP status code

If the server didn't respond with status text, node-fetch would set a default message derived from the HTTP status code. This behavior was not spec-compliant and now the `statusText` will remain blank instead.

## Dropped the `browser` field in package.json

Prior to v3.x, we included a `browser` field in the package.json file. Since node-fetch is intended to be used on the server, we have removed this field. If you are using node-fetch client-side, consider switching to something like [cross-fetch].

## Dropped the `res.textConverted()` function

If you want charset encoding detection, please use the [fetch-charset-detection] package ([documentation][fetch-charset-detection-docs]).

```js
const fetch = require("node-fetch");
const convertBody = require("fetch-charset-detection");

fetch("https://somewebsite.com").then(res => {
	const text = convertBody(res.buffer(), res.headers);
});
```

## JSON parsing errors from `res.json()` are of type `SyntaxError` instead of `FetchError`

When attemping to parse invalid json via `res.json()`, a `SyntaxError` will now be thrown instead of a `FetchError` to align better with the spec.

```js
const fetch = require("node-fetch");

fetch("https://somewebsitereturninginvalidjson.com").then(res => res.json())
// Throws 'Uncaught SyntaxError: Unexpected end of JSON input' or similar.
```

# Enhancements

## Data URI support

Previously, node-fetch only supported http url scheme. However, the Fetch Standard recently introduced the `data:` URI support. Following the specification, we implemented this feature in v3.x. Read more about `data:` URLs [here][data-url].

## New & exposed Blob implementation

Blob implementation is now [fetch-blob] and hence is exposed, unlikely previously, where Blob type was only internal and not exported.

## Better UTF-8 URL handling

We now use the new Node.js [WHATWG-compliant URL API][whatwg-nodejs-url], so UTF-8 URLs are handled properly.

## Request errors are now piped using `stream.pipeline`

Since the v3.x required at least Node.js 10, we can utilise the new API.

## `AbortError` now uses a w3c defined message

To stay spec-compliant, we changed the `AbortError` message to `The operation was aborted.`.

## Bundled TypeScript types

Since v3.x you no longer need to install `@types/node-fetch` package in order to use `node-fetch` with TypeScript.

[whatwg-fetch]: https://fetch.spec.whatwg.org/
[data-url]: https://fetch.spec.whatwg.org/#data-url-processor
[LTS plan]: https://github.com/nodejs/LTS#lts-plan
[cross-fetch]: https://github.com/lquixada/cross-fetch
[fetch-charset-detection]: https://github.com/Richienb/fetch-charset-detection
[fetch-charset-detection-docs]: https://richienb.github.io/fetch-charset-detection/globals.html#convertbody
[fetch-blob]: https://github.com/bitinn/fetch-blob#readme
[whatwg-nodejs-url]: https://nodejs.org/api/url.html#url_the_whatwg_url_api
[changelog]: CHANGELOG.md
