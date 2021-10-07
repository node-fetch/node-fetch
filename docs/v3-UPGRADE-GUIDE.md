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

## Minimum supported Node.js version is now 12.20

Since Node.js 10 has been deprecated since May 2020, we have decided that node-fetch v3 will drop support for Node.js 4, 6, 8, and 10 (which were previously supported). We strongly encourage you to upgrade if you still haven't done so. Check out the Node.js official [LTS plan] for more information.

## Converted to ES Module

This module was converted to be a ESM only package in version `3.0.0-beta.10`.
`node-fetch` is an ESM-only module - you are not able to import it with `require`. We recommend you stay on v2 which is built with CommonJS unless you use ESM yourself. We will continue to publish critical bug fixes for it.

Alternatively, you can use the async `import()` function from CommonJS to load `node-fetch` asynchronously:

```js
// mod.cjs
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
```

## The `timeout` option was removed.

Since this was never part of the fetch specification, it was removed. AbortSignal offers more fine grained control of request timeouts, and is standardized in the Fetch spec. For convenience, you can use [timeout-signal](https://github.com/node-fetch/timeout-signal) as a workaround:

```js
import timeoutSignal from 'timeout-signal';
import fetch from 'node-fetch';

const {AbortError} = fetch

fetch('https://www.google.com', { signal: timeoutSignal(5000) })
    .then(response => {
        // Handle response
    })
    .catch(error => {
        if (error instanceof AbortError) {
            // Handle timeout
        }
    })
```

## `Response.statusText` no longer sets a default message derived from the HTTP status code

If the server didn't respond with status text, node-fetch would set a default message derived from the HTTP status code. This behavior was not spec-compliant and now the `statusText` will remain blank instead.

## Dropped the `browser` field in package.json

Prior to v3.x, we included a `browser` field in the package.json file. Since node-fetch is intended to be used on the server, we have removed this field. If you are using node-fetch client-side, consider switching to something like [cross-fetch].

## Dropped the `res.textConverted()` function

If you want charset encoding detection, please use the [fetch-charset-detection] package ([documentation][fetch-charset-detection-docs]).

```js
import fetch from 'node-fetch';
import convertBody from 'fetch-charset-detection';

fetch('https://somewebsite.com').then(async res => {
    const buf = await res.arrayBuffer();
    const text = convertBody(buf, res.headers);
});
```

## JSON parsing errors from `res.json()` are of type `SyntaxError` instead of `FetchError`

When attempting to parse invalid json via `res.json()`, a `SyntaxError` will now be thrown instead of a `FetchError` to align better with the spec.

```js
import fetch from 'node-fetch';

fetch('https://somewebsitereturninginvalidjson.com').then(res => res.json())
// Throws 'Uncaught SyntaxError: Unexpected end of JSON input' or similar.
```

## A stream pipeline is now used to forward errors

If you are listening for errors via `res.body.on('error', () => ...)`, replace it with `res.body.once('error', () => ...)` so that your callback is not [fired twice](https://github.com/node-fetch/node-fetch/issues/668#issuecomment-569386115) in NodeJS >=13.5.

## `req.body` can no longer be a string

We are working towards changing body to become either null or a stream.

## Changed default user agent

The default user agent has been changed from `node-fetch/1.0 (+https://github.com/node-fetch/node-fetch)` to `node-fetch (+https://github.com/node-fetch/node-fetch)`.

## Arbitrary URLs are no longer supported

Since in 3.x we are using the WHATWG's `new URL()`, arbitrary URL parsing will fail due to lack of base.

# Enhancements

## Data URI support

Previously, node-fetch only supported http url scheme. However, the Fetch Standard recently introduced the `data:` URI support. Following the specification, we implemented this feature in v3.x. Read more about `data:` URLs [here][data-url].

## New & exposed Blob implementation

Blob implementation is now [fetch-blob] and hence is exposed, unlikely previously, where Blob type was only internal and not exported.

## Better UTF-8 URL handling

We now use the new Node.js [WHATWG-compliant URL API][whatwg-nodejs-url], so UTF-8 URLs are handled properly.

## Request errors are now piped using `stream.pipeline`

Since the v3.x requires at least Node.js 12.20.0, we can utilise the new API.

## Creating Request/Response objects with relative URLs is no longer supported

We introduced Node.js `new URL()` API in 3.x, because it offers better UTF-8 support and is WHATWG URL compatible. The drawback is, given current limit of the API (nodejs/node#12682), it's not possible to support relative URL parsing without hacks.
Due to the lack of a browsing context in Node.js, we opted to drop support for relative URLs on Request/Response object, and it will now throw errors if you do so.
The main `fetch()` function will support absolute URLs and data url.

## Bundled TypeScript types

Since v3.x you no longer need to install `@types/node-fetch` package in order to use `node-fetch` with TypeScript.

[whatwg-fetch]: https://fetch.spec.whatwg.org/
[data-url]: https://fetch.spec.whatwg.org/#data-url-processor
[LTS plan]: https://github.com/nodejs/LTS#lts-plan
[cross-fetch]: https://github.com/lquixada/cross-fetch
[fetch-charset-detection]: https://github.com/Richienb/fetch-charset-detection
[fetch-charset-detection-docs]: https://richienb.github.io/fetch-charset-detection/globals.html#convertbody
[fetch-blob]: https://github.com/node-fetch/fetch-blob#readme
[whatwg-nodejs-url]: https://nodejs.org/api/url.html#url_the_whatwg_url_api
[changelog]: CHANGELOG.md
